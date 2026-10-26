import base64
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient

from app import create_app


class HttpBoundaryTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.user = "00000000-0000-4000-8000-000000000001"
        self.secret = "synthetic-secret-" * 4
        with patch.dict(os.environ, {"FACE_SERVICE_SECRET": self.secret,
                                    "FACE_ENCRYPTION_KEY": base64.b64encode(b"k" * 32).decode(),
                                    "FACE_DB_PATH": str(Path(self.directory.name) / "trial.sqlite")}):
            self.client = TestClient(create_app())

    def tearDown(self):
        self.client.close()
        self.directory.cleanup()

    def test_private_authentication_and_input_limits(self):
        self.assertEqual(self.client.post("/v1/face", json={}).status_code, 401)
        headers = {"Authorization": f"Bearer {self.secret}"}
        self.assertEqual(self.client.post("/v1/face", json=[], headers=headers).status_code, 400)
        self.assertEqual(self.client.post("/v1/face", json={"x": "x" * 1000001}, headers=headers).status_code, 413)

    def test_status_and_removal_work_without_models(self):
        headers = {"Authorization": f"Bearer {self.secret}"}
        for action, expected in (("status", {"enrolled": False, "registered": False}), ("remove", {"ok": True})):
            response = self.client.post("/v1/face", json={"userId": self.user, "action": action}, headers=headers)
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json(), expected)
            self.assertEqual(response.headers["cache-control"], "no-store")

    def test_storage_failure_returns_unavailable_and_logs_only_its_type(self):
        with patch("app.FaceTrial.handle", side_effect=RuntimeError("synthetic-private-capture-or-credential")), \
                self.assertLogs("face-service", level="ERROR") as logs:
            response = self.client.post("/v1/face", json={"userId": self.user, "action": "status"},
                                        headers={"Authorization": f"Bearer {self.secret}"})
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json(), {"code": "unavailable"})
        self.assertIn("stage=request error_type=RuntimeError", logs.output[0])
        self.assertNotIn("synthetic-private", "".join(logs.output))

    def test_api_schema_is_not_exposed(self):
        self.assertEqual(self.client.get("/docs").status_code, 404)
        self.assertEqual(self.client.get("/openapi.json").status_code, 404)

    def test_gateway_can_check_any_account_without_an_allowlist(self):
        headers = {"Authorization": f"Bearer {self.secret}"}
        for user in (self.user, "00000000-0000-4000-8000-000000000099"):
            response = self.client.post("/v1/face", json={"userId": user, "action": "status"}, headers=headers)
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json(), {"enrolled": False, "registered": False})
        response = self.client.post("/v1/face", json={"userId": "not-a-uuid", "action": "status"}, headers=headers)
        self.assertEqual(response.status_code, 400)


if __name__ == "__main__":
    unittest.main()
