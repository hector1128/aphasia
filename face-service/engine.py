"""YuNet + SFace + the pinned MiniFASNet passive-liveness ensemble.

No model downloads and no bypass when a model or calibration is missing.
"""
import hashlib
import os
import threading

from core import Rejected
from liveness import MiniFASLiveness, checked_model


def jpeg_size(raw):
    """Bound dimensions before handing attacker-controlled JPEGs to a decoder."""
    if not raw.startswith(b"\xff\xd8"):
        raise Rejected("capture")
    offset = 2
    while offset + 4 <= len(raw):
        if raw[offset] != 0xFF:
            break
        while offset < len(raw) and raw[offset] == 0xFF:
            offset += 1
        if offset >= len(raw):
            break
        marker = raw[offset]
        offset += 1
        if marker in (0xD8, 0xD9, 0xDA):
            break
        size = int.from_bytes(raw[offset:offset + 2], "big")
        if size < 2 or offset + size > len(raw):
            break
        if marker in (0xC0, 0xC2):
            if size < 8 or raw[offset + 2] != 8:
                break
            height = int.from_bytes(raw[offset + 3:offset + 5], "big")
            width = int.from_bytes(raw[offset + 5:offset + 7], "big")
            if 160 <= width <= 1280 and 160 <= height <= 1280 and width * height <= 921600:
                return width, height
            break
        offset += size
    raise Rejected("capture")


class Engine:
    def __init__(self, env=os.environ):
        # Import heavy dependencies only for the real inference service.
        import cv2
        import numpy as np

        self.cv2, self.np = cv2, np
        detector, detector_hash = checked_model(env, "FACE_DETECTOR")
        recognizer, recognizer_hash = checked_model(env, "FACE_RECOGNIZER")
        self.match_threshold = float(env["FACE_MATCH_THRESHOLD"])
        self.pad_threshold = float(env["FACE_PAD_THRESHOLD"])
        if not 0 < self.match_threshold < 1 or not 0 < self.pad_threshold < 1:
            raise ValueError("Explicit calibrated thresholds must be between 0 and 1")
        self.liveness = MiniFASLiveness(env)
        settings = f"{detector_hash}:{recognizer_hash}:{self.liveness.version}:{self.match_threshold}:{self.pad_threshold}"
        self.version = hashlib.sha256(settings.encode()).hexdigest()
        self.detector = cv2.FaceDetectorYN.create(detector, "", (640, 480), 0.9, 0.3, 5000)
        self.recognizer = cv2.FaceRecognizerSF.create(recognizer, "")
        self.lock = threading.Lock()

    def embeddings(self, frames):
        cv2, np = self.cv2, self.np
        vectors = []
        with self.lock:
            for raw in frames:
                width, height = jpeg_size(raw)
                image = cv2.imdecode(np.frombuffer(raw, dtype=np.uint8), cv2.IMREAD_COLOR)
                if image is None or image.shape[:2] != (height, width):
                    raise Rejected("capture")
                self.detector.setInputSize((width, height))
                _, faces = self.detector.detect(image)
                if faces is None or len(faces) != 1 or not np.isfinite(faces).all():
                    raise Rejected("capture")
                face = faces[0]
                x, y, w, h = map(float, face[:4])
                if min(w, h) < 100 or x < 0 or y < 0 or x + w > width or y + h > height:
                    raise Rejected("capture")
                self.liveness.check(image, [int(x), int(y), int(w), int(h)], self.pad_threshold)
                aligned = self.recognizer.alignCrop(image, face)
                if cv2.Laplacian(cv2.cvtColor(aligned, cv2.COLOR_BGR2GRAY), cv2.CV_64F).var() < 40:
                    raise Rejected("capture")
                vector = self.recognizer.feature(aligned).flatten().astype(np.float32)
                norm = float(np.linalg.norm(vector))
                if vector.size != 128 or not np.isfinite(vector).all() or norm < 1e-6:
                    raise Rejected("unavailable")
                vectors.append(vector / norm)
        return vectors

    def enroll(self, frames):
        vectors = self.embeddings(frames)
        if any(float(a @ b) < self.match_threshold for i, a in enumerate(vectors) for b in vectors[i + 1:]):
            raise Rejected("capture")
        vector = self.np.mean(vectors, axis=0)
        vector /= self.np.linalg.norm(vector)
        return vector.astype("<f4").tobytes()

    def verify(self, frames, enrolled):
        template = self.np.frombuffer(enrolled, dtype="<f4")
        if template.size != 128 or not self.np.isfinite(template).all():
            raise Rejected("unavailable")
        return all(float(vector @ template) >= self.match_threshold for vector in self.embeddings(frames))
