"""Pinned MiniFASNet ensemble adapter: upstream crops, BGR 0..255, class 1 live."""
import hashlib
from pathlib import Path

import numpy as np
import onnxruntime as ort

from core import Rejected
from vendor.minifasnet.generate_patches import CropImage

ort.disable_telemetry_events()

PROFILE = "minifasnet-ensemble-v1"
REVISION = "b6d5f04ad78778917853b25c778acef6d5626d15"
MODELS = (
    {"architecture": "MiniFASNetV2", "scale": 2.7, "prefix": "FACE_PAD", "file": "minifasnet-v2.onnx",
     "weight": "2.7_80x80_MiniFASNetV2.pth", "sha256": "a5eb02e1843f19b5386b953cc4c9f011c3f985d0ee2bb9819eea9a142099bec0"},
    {"architecture": "MiniFASNetV1SE", "scale": 4.0, "prefix": "FACE_PAD_SECOND", "file": "minifasnet-v1se.onnx",
     "weight": "4_0_0_80x80_MiniFASNetV1SE.pth", "sha256": "84ee1d37d96894d5e82de5a57df044ef80a58be2b218b5ed7cdfd875ec2f5990"},
)


def checked_model(env, prefix):
    path = Path(env[prefix + "_MODEL"])
    digest = hashlib.sha256(path.read_bytes()).hexdigest()
    if digest != env[prefix + "_SHA256"]:
        raise ValueError(f"{prefix} model checksum mismatch")
    return str(path), digest


def model_metadata(spec):
    return {"profile": PROFILE, "source_revision": REVISION, "architecture": spec["architecture"],
            "crop_scale": str(spec["scale"]), "color": "BGR", "input_range": "0..255", "live_class": "1",
            "source_weights_sha256": spec["sha256"], "license": "Apache-2.0"}


class MiniFASLiveness:
    def __init__(self, env):
        options = ort.SessionOptions()
        options.intra_op_num_threads = 1
        self.sessions = []
        fingerprints = [PROFILE]
        for spec in MODELS:
            path, digest = checked_model(env, spec["prefix"])
            session = ort.InferenceSession(path, options, providers=["CPUExecutionProvider"])
            inputs, outputs = session.get_inputs(), session.get_outputs()
            if (len(inputs) != 1 or inputs[0].shape != [1, 3, 80, 80] or inputs[0].type != "tensor(float)"
                    or len(outputs) != 1 or outputs[0].shape != [1, 3] or outputs[0].type != "tensor(float)"):
                raise ValueError("MiniFASNet must accept float32 [1,3,80,80] and return float32 [1,3] logits")
            metadata = session.get_modelmeta().custom_metadata_map
            if any(metadata.get(key) != value for key, value in model_metadata(spec).items()):
                raise ValueError("Incorrect MiniFASNet export metadata; run prepare_liveness.py")
            self.sessions.append((spec, session, inputs[0].name))
            fingerprints.append(digest)
        self.version = hashlib.sha256(":".join(fingerprints).encode()).hexdigest()

    def probabilities(self, image, bbox):
        if len(self.sessions) != len(MODELS):
            raise Rejected("unavailable")
        if (image.dtype != np.uint8 or image.ndim != 3 or image.shape[2] != 3
                or len(bbox) != 4 or not np.isfinite(bbox).all()):
            raise Rejected("capture")
        height, width = image.shape[:2]
        x, y, w, h = map(int, bbox)
        if min(w, h) <= 0 or x < 0 or y < 0 or x + w > width or y + h > height:
            raise Rejected("capture")
        predictions = []
        for spec, session, name in self.sessions:
            # Use the upstream boundary shifting/inclusive crop, not a clipped 1.5x crop.
            crop = CropImage().crop(image, [x, y, w, h], spec["scale"], 80, 80)
            tensor = np.ascontiguousarray(crop.transpose(2, 0, 1)[None], dtype=np.float32)
            logits = session.run(None, {name: tensor})[0]
            if logits.shape != (1, 3) or not np.isfinite(logits).all():
                raise Rejected("unavailable")
            scores = np.exp(logits.astype(np.float64) - logits.max())
            predictions.append(scores[0] / scores.sum())
        return np.mean(predictions, axis=0)

    def check(self, image, bbox, threshold):
        if not 0 < threshold < 1:
            raise Rejected("unavailable")
        probabilities = self.probabilities(image, bbox)
        if probabilities.shape != (3,) or not np.isfinite(probabilities).all():
            raise Rejected("unavailable")
        # Class 1 must win as in upstream, plus our explicitly configured threshold.
        # Reject ties rather than accepting an ambiguous label.
        if probabilities[1] <= max(probabilities[0], probabilities[2]) or probabilities[1] < threshold:
            raise Rejected("capture")
