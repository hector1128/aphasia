import base64
import importlib.util
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient

import vercel_models
from storage import PostgresStore


class VercelTests(unittest.TestCase):
    def setUp(self):
        spec = importlib.util.spec_from_file_location("face_vercel_test", Path(__file__).resolve().parents[1] / "api" / "face-service.py")
        self.module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(self.module)
        self.client = TestClient(self.module.app)
        self.secret = "synthetic-shared-secret-" * 3

    def tearDown(self):
        self.client.close()

    def test_public_requests_cannot_initialize_private_service(self):
        with patch.object(self.module, "initialize", side_effect=AssertionError("must authenticate first")):
            self.assertEqual(self.client.post("/api/face-service", json={}).status_code, 401)
        self.assertEqual(self.client.get("/docs").status_code, 404)

    def test_missing_database_fails_closed_without_creating_sqlite(self):
        environment = {"FACE_SERVICE_SECRET": self.secret,
                       "FACE_ENCRYPTION_KEY": base64.b64encode(b"k" * 32).decode()}
        with patch.dict(os.environ, environment, clear=True), patch("app.FaceTrial") as trial:
            response = self.client.post("/api/face-service", json={}, headers={"Authorization": f"Bearer {self.secret}"})
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json(), {"code": "unavailable"})
        trial.assert_not_called()

    def test_bundled_model_settings_load_read_only_without_exporter_or_network(self):
        with tempfile.TemporaryDirectory() as directory:
            folder = Path(directory)
            manifest = {prefix: {"file": f"{prefix}.onnx", "sha256": "a" * 64} for prefix in vercel_models.PREFIXES}
            (folder / "model-config.json").write_text(json.dumps(manifest))
            with patch.dict("sys.modules", {"torch": None, "onnx": None}), patch("urllib.request.urlopen", side_effect=AssertionError("no network")):
                values = vercel_models.runtime(folder)
            self.assertEqual(values["FACE_PAD_SHA256"], "a" * 64)
            manifest["FACE_PAD"]["file"] = "../outside.onnx"
            (folder / "model-config.json").write_text(json.dumps(manifest))
            with self.assertRaises(ValueError):
                vercel_models.runtime(folder)

    def test_remote_database_requires_verified_tls(self):
        store = PostgresStore("postgresql://synthetic:password@pooler.example:6543/postgres?sslmode=disable")
        self.assertEqual(store.tls, {"sslmode": "verify-full", "sslrootcert": "system"})
