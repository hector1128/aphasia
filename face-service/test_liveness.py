import hashlib
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

import cv2
import numpy as np

from core import Rejected
from liveness import MODELS, MiniFASLiveness, model_metadata


class FakeSession:
    def __init__(self, spec, logits=None):
        self.metadata = model_metadata(spec)
        self.input_shape = [1, 3, 80, 80]
        self.output_shape = [1, 3]
        self.logits = np.array([[0, 8, 0]], dtype=np.float32) if logits is None else logits
        self.captures = []

    def get_inputs(self):
        return [SimpleNamespace(shape=self.input_shape, name="input", type="tensor(float)")]

    def get_outputs(self):
        return [SimpleNamespace(shape=self.output_shape, type="tensor(float)")]

    def get_modelmeta(self):
        return SimpleNamespace(custom_metadata_map=self.metadata)

    def run(self, outputs, feed):
        self.captures.append(feed["input"].copy())
        return [self.logits]


class LivenessTests(unittest.TestCase):
    def setUp(self):
        self.pad = MiniFASLiveness.__new__(MiniFASLiveness)
        self.sessions = [FakeSession(spec) for spec in MODELS]
        self.pad.sessions = [(spec, session, "input") for spec, session in zip(MODELS, self.sessions)]
        self.image = np.zeros((480, 640, 3), dtype=np.uint8)
        self.image[:, :, 0] = 17
        self.image[:, :, 1] = 91
        self.image[:, :, 2] = 233
        self.bbox = [200, 140, 100, 120]

    def test_upstream_bgr_range_and_shape(self):
        self.pad.check(self.image, self.bbox, 0.9)
        for session in self.sessions:
            tensor = session.captures[0]
            self.assertEqual(tensor.shape, (1, 3, 80, 80))
            self.assertEqual(tensor.dtype, np.float32)
            self.assertTrue(tensor.flags.c_contiguous)
            for channel, expected in enumerate((17, 91, 233)):
                np.testing.assert_array_equal(tensor[0, channel], expected)

    def test_scales_preserve_context_and_upstream_edge_shifting(self):
        y, x = np.indices((480, 640))
        self.image[:, :, 0] = x % 256
        self.image[:, :, 1] = y % 256
        # A face near the left edge must shift the expanded crop, not clip it.
        self.bbox = [0, 100, 100, 100]
        self.pad.check(self.image, self.bbox, 0.9)
        # Upstream formula: 2.7x is x=0..270, y=15..285 inclusive;
        # 4x is x=0..400, y=0..400 after boundary shifting, inclusive.
        for session, region in zip(self.sessions, (self.image[15:286, 0:271], self.image[0:401, 0:401])):
            expected = cv2.resize(region, (80, 80)).transpose(2, 0, 1)[None].astype(np.float32)
            np.testing.assert_array_equal(session.captures[0], expected)

    def test_live_is_class_one_and_ensemble_averages_probabilities(self):
        self.sessions[0].logits = np.array([[8, 0, 0]], dtype=np.float32)
        self.sessions[1].logits = np.array([[0, 8, 0]], dtype=np.float32)
        # One confident live model cannot bypass the disagreeing model at 0.9.
        with self.assertRaises(Rejected):
            self.pad.check(self.image, self.bbox, 0.9)
        for spoof_class in (0, 2):
            for session in self.sessions:
                session.logits = np.full((1, 3), -8, dtype=np.float32)
                session.logits[0, spoof_class] = 8
            with self.assertRaises(Rejected):
                self.pad.check(self.image, self.bbox, 0.5)

    def test_ties_and_nonfinite_outputs_rejected(self):
        for logits in (np.zeros((1, 3)), np.array([[0, np.nan, 0]]), np.array([[0, np.inf, 0]]), np.zeros((1, 2))):
            for session in self.sessions:
                session.logits = logits
            with self.assertRaises(Rejected):
                self.pad.check(self.image, self.bbox, 0.1)

    def test_threshold_cannot_be_disabled(self):
        for threshold in (0, -1, 1, float("nan")):
            with self.assertRaises(Rejected):
                self.pad.check(self.image, self.bbox, threshold)

    def test_out_of_bounds_and_missing_ensemble_rejected(self):
        for bbox in ((-1, 0, 100, 100), (0, 0, 0, 100), (600, 0, 100, 100)):
            with self.assertRaises(Rejected):
                self.pad.check(self.image, bbox, 0.9)
        self.pad.sessions.pop()
        with self.assertRaises(Rejected):
            self.pad.check(self.image, self.bbox, 0.9)

    def test_loader_checks_model_shape_metadata_and_checksums(self):
        with tempfile.TemporaryDirectory() as directory:
            env = {}
            for index, spec in enumerate(MODELS):
                path = Path(directory) / spec["file"]
                path.write_bytes(f"synthetic-{index}".encode())
                env[spec["prefix"] + "_MODEL"] = str(path)
                env[spec["prefix"] + "_SHA256"] = hashlib.sha256(path.read_bytes()).hexdigest()
            with patch("liveness.ort.InferenceSession", side_effect=self.sessions):
                self.assertIsInstance(MiniFASLiveness(env), MiniFASLiveness)
            self.sessions[0].metadata["live_class"] = "0"
            with patch("liveness.ort.InferenceSession", side_effect=self.sessions), self.assertRaises(ValueError):
                MiniFASLiveness(env)
            self.sessions[0].metadata = model_metadata(MODELS[0])
            self.sessions[0].input_shape = [1, 3, 128, 128]
            with patch("liveness.ort.InferenceSession", side_effect=self.sessions), self.assertRaises(ValueError):
                MiniFASLiveness(env)
            env["FACE_PAD_SHA256"] = "incorrect"
            with self.assertRaises(ValueError):
                MiniFASLiveness(env)


if __name__ == "__main__":
    unittest.main()
