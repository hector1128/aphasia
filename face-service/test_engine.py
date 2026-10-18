"""Exercise image handling and acceptance logic with synthetic model outputs.

These tests do not measure recognition accuracy or spoof resistance of any model.
"""
import tempfile
import threading
import unittest
from pathlib import Path
from types import SimpleNamespace

import cv2
import numpy as np

from core import Rejected
from engine import Engine, checked_model


class EngineTests(unittest.TestCase):
    def setUp(self):
        self.engine = Engine.__new__(Engine)
        self.engine.cv2, self.engine.np = cv2, np
        self.engine.lock = threading.Lock()
        self.engine.match_threshold, self.engine.pad_threshold = 0.8, 0.9
        self.faces = np.array([[100, 100, 200, 200, 150, 150, 250, 150, 200, 200, 160, 250, 240, 250, 0.99]], dtype=np.float32)
        self.feature = np.ones((1, 128), dtype=np.float32)
        self.engine.detector = SimpleNamespace(setInputSize=lambda size: None, detect=lambda image: (None, self.faces))
        self.liveness_calls = 0
        self.engine.liveness = SimpleNamespace(check=self.check_liveness)
        self.engine.recognizer = SimpleNamespace(alignCrop=lambda image, face: image[100:300, 100:300], feature=lambda image: self.feature)
        image = np.random.default_rng(1).integers(0, 256, (480, 640, 3), dtype=np.uint8)
        success, encoded = cv2.imencode(".jpg", image)
        assert success
        self.frames = [encoded.tobytes()] * 3

    def check_liveness(self, image, bbox, threshold):
        self.liveness_calls += 1
        self.assertEqual(image.dtype, np.uint8)
        self.assertEqual(bbox, [100, 100, 200, 200])
        self.assertEqual(threshold, 0.9)

    def test_template_and_matching(self):
        template = self.engine.enroll(self.frames)
        self.assertEqual(self.liveness_calls, 3)
        self.assertEqual(len(template), 128 * 4)
        self.assertTrue(self.engine.verify(self.frames, template))
        self.feature = -self.feature
        self.assertFalse(self.engine.verify(self.frames, template))

    def test_liveness_failure_stops_enrollment_and_verification(self):
        template = self.engine.enroll(self.frames)
        def reject(*args):
            raise Rejected("capture")
        self.engine.liveness.check = reject
        with self.assertRaises(Rejected):
            self.engine.enroll(self.frames)
        with self.assertRaises(Rejected):
            self.engine.verify(self.frames, template)

    def test_missing_multiple_and_small_faces_rejected(self):
        for faces in (None, np.repeat(self.faces, 2, axis=0), self.faces * 0.1):
            self.faces = faces
            with self.assertRaises(Rejected):
                self.engine.enroll(self.frames)

    def test_model_assets_require_exact_checksums(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "model.onnx"
            path.write_bytes(b"synthetic model")
            with self.assertRaises(ValueError):
                checked_model({"FACE_PAD_MODEL": str(path), "FACE_PAD_SHA256": "wrong"}, "FACE_PAD")


if __name__ == "__main__":
    unittest.main()
