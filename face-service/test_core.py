"""Protocol/storage tests use synthetic bytes and a fake engine, never human faces."""
import base64
import tempfile
import unittest
import uuid
from pathlib import Path

from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.asymmetric.utils import decode_dss_signature

from core import CONSENT_VERSION, FaceTrial, Rejected, capture_message
from engine import jpeg_size

USER = "00000000-0000-4000-8000-000000000001"
OTHER = "00000000-0000-4000-8000-000000000002"


class FakeEngine:
    version = "synthetic-model-v1"

    def __init__(self):
        self.calls = 0
        self.match = True
        self.before_return = lambda: None

    def enroll(self, frames):
        self.calls += 1
        self.before_return()
        return b"synthetic-face-template-not-an-actual-biometric"

    def verify(self, frames, template):
        self.calls += 1
        self.before_return()
        return self.match and template == b"synthetic-face-template-not-an-actual-biometric"


class TrialTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.path = Path(self.directory.name) / "trial.sqlite"
        self.now = 1000
        self.engine = FakeEngine()
        self.key = b"k" * 32
        self.trial = FaceTrial(self.path, self.key, self.engine, [USER, OTHER], lambda: self.now)
        self.device_id = str(uuid.uuid4())
        self.private = ec.generate_private_key(ec.SECP256R1())
        numbers = self.private.public_key().public_numbers()
        encode = lambda n: base64.urlsafe_b64encode(n.to_bytes(32, "big")).decode().rstrip("=")
        self.public = {"kty": "EC", "crv": "P-256", "x": encode(numbers.x), "y": encode(numbers.y)}

    def tearDown(self):
        self.directory.cleanup()

    def request(self, action, **fields):
        return self.trial.handle({"userId": USER, "action": action, **fields})

    def submission(self, operation="enroll", **fields):
        challenge = self.request("begin", operation=operation, deviceId=self.device_id)
        frames = [b"synthetic-jpeg-bytes-" * 8 + bytes([i]) for i in range(3)]
        message = capture_message(challenge["message"], frames)
        der = self.private.sign(message, ec.ECDSA(hashes.SHA256()))
        r, s = decode_dss_signature(der)
        signature = base64.b64encode(r.to_bytes(32, "big") + s.to_bytes(32, "big")).decode()
        return {"userId": USER, "action": operation, "deviceId": self.device_id,
                "challengeId": challenge["challengeId"], "frames": [base64.b64encode(frame).decode() for frame in frames],
                "signature": signature, "publicKey": self.public, "consentVersion": CONSENT_VERSION, **fields}

    def reject(self, code, body):
        with self.assertRaises(Rejected) as caught:
            self.trial.handle(body)
        self.assertEqual(caught.exception.code, code)

    def enroll(self):
        self.assertEqual(self.trial.handle(self.submission()), {"ok": True})

    def test_enroll_encrypt_verify_and_remove(self):
        self.enroll()
        self.assertEqual(self.request("status", deviceId=self.device_id), {"enrolled": True, "registered": True})
        self.assertEqual(self.trial.handle(self.submission("verify")), {"verified": True})
        with self.trial.connect() as db:
            row = db.execute("SELECT * FROM templates").fetchone()
            self.assertEqual(row["consent_version"], CONSENT_VERSION)
            self.assertNotIn(b"synthetic-face-template", row["encrypted"])
            self.assertEqual(row["consented_at"], self.now)
        self.assertNotIn(b"synthetic-face-template", self.path.read_bytes())
        self.assertNotIn(b"synthetic-jpeg", self.path.read_bytes())
        self.assertEqual(self.request("remove"), {"ok": True})
        self.assertEqual(self.request("status", deviceId=self.device_id), {"enrolled": False, "registered": False})
        with self.trial.connect() as db:
            for table in ("templates", "devices", "challenges"):
                self.assertEqual(db.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0], 0)

    def test_single_use_even_when_signature_fails(self):
        body = self.submission()
        invalid = {**body, "signature": base64.b64encode(b"x" * 64).decode()}
        self.reject("device", invalid)
        self.reject("expired", body)
        self.assertEqual(self.engine.calls, 0)

    def test_login_requires_registered_device_and_a_fresh_login_challenge(self):
        self.enroll()
        body = self.submission("login")
        self.assertEqual(self.trial.handle(body), {"verified": True, "userId": USER})
        self.reject("expired", body)
        verification = self.submission("verify")
        self.reject("expired", {**verification, "action": "login"})

    def test_login_cannot_use_a_client_supplied_key_or_failed_face_match(self):
        self.enroll()
        self.engine.match = False
        self.reject("mismatch", self.submission("login"))
        self.engine.match = True
        self.private = ec.generate_private_key(ec.SECP256R1())
        self.reject("device", self.submission("login"))

    def test_removal_invalidates_outstanding_login_challenge(self):
        self.enroll()
        body = self.submission("login")
        self.request("remove")
        self.reject("expired", body)

    def test_capture_bytes_and_order_are_bound_to_signature(self):
        body = self.submission()
        body["frames"].reverse()
        self.reject("device", body)
        self.assertEqual(self.engine.calls, 0)

    def test_expired_challenge(self):
        body = self.submission()
        self.now += 121
        self.reject("expired", body)
        self.assertEqual(self.engine.calls, 0)

    def test_account_operation_and_device_binding(self):
        body = self.submission()
        self.reject("expired", {**body, "userId": OTHER})
        self.reject("expired", {**body, "action": "verify"})
        body = self.submission()
        self.reject("expired", {**body, "deviceId": str(uuid.uuid4())})
        self.assertEqual(self.engine.calls, 0)

    def test_missing_consent_and_unknown_test_account_rejected(self):
        self.reject("invalid", self.submission(consentVersion=""))
        self.reject("unavailable", {"userId": str(uuid.uuid4()), "action": "status"})
        self.assertEqual(self.engine.calls, 0)

    def test_cannot_verify_using_another_key(self):
        self.enroll()
        self.private = ec.generate_private_key(ec.SECP256R1())
        self.reject("device", self.submission("verify"))
        self.assertEqual(self.engine.calls, 1)

    def test_mismatch_and_model_changes_fail_closed(self):
        self.enroll()
        self.engine.match = False
        self.reject("mismatch", self.submission("verify"))
        self.engine.version = "different-model"
        self.reject("unavailable", self.submission("verify"))

    def test_rate_limit_survives_service_restart(self):
        for _ in range(6):
            self.request("begin", operation="enroll", deviceId=self.device_id)
        self.trial = FaceTrial(self.path, self.key, self.engine, [USER], lambda: self.now)
        self.reject("limited", {"userId": USER, "action": "begin", "operation": "enroll", "deviceId": self.device_id})
        self.now += 61
        self.assertIn("message", self.request("begin", operation="enroll", deviceId=self.device_id))

    def test_removal_during_enrollment_cannot_resurrect_template(self):
        self.engine.before_return = lambda: self.request("remove")
        self.reject("expired", self.submission())
        self.assertFalse(self.request("status")["enrolled"])

    def test_removal_does_not_reset_rate_limit(self):
        for _ in range(6):
            self.request("begin", operation="enroll", deviceId=self.device_id)
        self.request("remove")
        self.reject("limited", {"userId": USER, "action": "begin", "operation": "enroll", "deviceId": self.device_id})

    def test_removal_during_verification_invalidates_result(self):
        self.enroll()
        body = self.submission("verify")
        self.engine.before_return = lambda: self.request("remove")
        self.reject("expired", body)

    def test_reenrollment_revokes_previous_browser(self):
        self.enroll()
        previous = self.device_id
        self.device_id = str(uuid.uuid4())
        self.enroll()
        self.assertEqual(self.request("status", deviceId=previous), {"enrolled": True, "registered": False})
        self.assertTrue(self.request("status", deviceId=self.device_id)["registered"])


class ImageBoundaryTests(unittest.TestCase):
    def jpeg_header(self, width, height):
        return b"\xff\xd8\xff\xc0\x00\x08\x08" + height.to_bytes(2, "big") + width.to_bytes(2, "big") + b"\x03"

    def test_dimensions_checked_without_decoding(self):
        self.assertEqual(jpeg_size(self.jpeg_header(640, 480)), (640, 480))
        for raw in (b"not-jpeg", self.jpeg_header(65000, 65000), self.jpeg_header(20, 20), b"\xff\xd8\xff\xe1\xff\xff"):
            with self.assertRaises(Rejected):
                jpeg_size(raw)


if __name__ == "__main__":
    unittest.main()
