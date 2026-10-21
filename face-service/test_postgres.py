"""Run against an isolated local database named aphasia_face_test* only."""
import os
import base64
import importlib.util
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import unittest
from unittest.mock import patch
from fastapi.testclient import TestClient

import test_core
from core import FaceTrial, Rejected
from storage import PostgresStore

URL = os.environ.get("FACE_TEST_DATABASE_URL")


@unittest.skipUnless(URL, "Set FACE_TEST_DATABASE_URL to an isolated local Postgres test database")
class PostgresTests(unittest.TestCase):
    # Reuse the synthetic capture/key fixture; no real camera or recognition models.
    new_browser = test_core.TrialTests.new_browser
    submission = test_core.TrialTests.submission
    request = test_core.TrialTests.request
    reject = test_core.TrialTests.reject
    enroll = test_core.TrialTests.enroll

    @classmethod
    def setUpClass(cls):
        import psycopg
        from psycopg.conninfo import conninfo_to_dict, make_conninfo

        options = conninfo_to_dict(URL)
        if options.get("host") not in ("127.0.0.1", "localhost", "::1") or not options.get("dbname", "").startswith("aphasia_face_test"):
            raise ValueError("Tests require an isolated local aphasia_face_test database")
        cls.psycopg = psycopg
        cls.role_url = make_conninfo(URL, user="face_auth_service")
        cls.migration = (Path(__file__).resolve().parents[1] / "supabase" / "face-auth.sql").read_text()
        with psycopg.connect(URL, autocommit=True) as db:
            db.execute("CREATE SCHEMA IF NOT EXISTS auth")
            db.execute("CREATE TABLE IF NOT EXISTS auth.users (id uuid PRIMARY KEY)")
            for role in ("anon", "authenticated"):
                if not db.execute("SELECT 1 FROM pg_roles WHERE rolname = %s", (role,)).fetchone():
                    db.execute(f"CREATE ROLE {role}")
            db.execute(cls.migration, prepare=False)
            db.execute(cls.migration, prepare=False)  # Repeatable migration.

    def setUp(self):
        with self.psycopg.connect(URL) as db:
            db.execute("TRUNCATE auth.users CASCADE")
            db.execute("INSERT INTO auth.users VALUES (%s), (%s)", (test_core.USER, test_core.OTHER))
        self.now = 1000
        self.engine = test_core.FakeEngine()
        self.key = b"k" * 32
        self.trial = self.instance()
        self.new_browser()

    def instance(self):
        return FaceTrial(None, self.key, self.engine, clock=lambda: self.now,
                         store=PostgresStore(self.role_url))

    def test_encryption_persistence_account_isolation_and_removal(self):
        self.enroll()
        self.trial = self.instance()
        self.assertEqual(self.trial.handle(self.submission("login")), {"verified": True, "userId": test_core.USER})
        with self.trial.connect() as db:
            encrypted = db.execute("SELECT encrypted FROM templates WHERE user_id = ?", (test_core.USER,)).fetchone()["encrypted"]
        self.assertNotIn(b"synthetic-face-template", encrypted)
        self.assertFalse(self.trial.handle({"action": "status", "userId": test_core.OTHER})["enrolled"])
        self.request("remove")
        self.assertFalse(self.instance().handle({"action": "status", "userId": test_core.USER})["enrolled"])

    def test_parallel_replay_is_consumed_once_across_instances(self):
        self.enroll()
        body = self.submission("login")
        before = self.engine.calls
        def finish(_):
            try:
                return self.instance().handle(body)
            except Rejected as error:
                return error.code
        with ThreadPoolExecutor(max_workers=8) as workers:
            results = list(workers.map(finish, range(8)))
        self.assertEqual(results.count({"verified": True, "userId": test_core.USER}), 1)
        self.assertEqual(results.count("expired"), 7)
        self.assertEqual(self.engine.calls, before + 1)

    def test_parallel_rate_limit_and_removal_cannot_reset_it(self):
        body = {"action": "begin", "userId": test_core.USER, "operation": "enroll", "deviceId": self.device_id}
        def begin(_):
            try:
                self.instance().handle(body)
                return "ok"
            except Rejected as error:
                return error.code
        with ThreadPoolExecutor(max_workers=12) as workers:
            results = list(workers.map(begin, range(12)))
        self.assertEqual(results.count("ok"), 6)
        self.assertEqual(results.count("limited"), 6)
        self.request("remove")
        self.reject("limited", body)
        self.now += 61
        self.assertIn("message", self.instance().handle(body))

    def test_removal_during_inference_invalidates_result(self):
        self.enroll()
        body = self.submission("login")
        self.engine.before_return = lambda: self.instance().handle({"userId": test_core.USER, "action": "remove"})
        self.reject("expired", body)
        self.assertFalse(self.request("status")["enrolled"])

    def test_browser_registration_preserves_other_browser_and_reenrollment_revokes_all(self):
        self.enroll()
        original = self.device_id, self.private, self.public
        self.new_browser()
        self.assertEqual(self.trial.handle(self.submission("register")), {"ok": True})
        second = self.device_id
        self.assertTrue(self.instance().handle({"action": "status", "userId": test_core.USER, "deviceId": original[0]})["registered"])
        self.assertEqual(self.trial.handle(self.submission("login"))["verified"], True)
        self.device_id, self.private, self.public = original
        pending = self.submission("login")
        self.enroll()
        self.reject("expired", pending)
        self.assertFalse(self.request("status", deviceId=second)["registered"])

    def test_signature_failure_is_not_replayable(self):
        body = self.submission()
        self.reject("device", {**body, "signature": "invalid"})
        self.reject("expired", body)
        self.assertEqual(self.engine.calls, 0)

    def test_vercel_http_status_and_removal_use_postgres_without_models(self):
        self.enroll()
        spec = importlib.util.spec_from_file_location("postgres_vercel_test", Path(__file__).resolve().parents[1] / "api" / "face-service.py")
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        secret = "synthetic-private-secret-" * 3
        with patch.dict(os.environ, {"FACE_DATABASE_URL": self.role_url, "FACE_SERVICE_SECRET": secret,
                                    "FACE_ENCRYPTION_KEY": base64.b64encode(self.key).decode()}), \
                patch.object(module, "runtime", side_effect=AssertionError("status/removal must not load models")), \
                TestClient(module.app) as client:
            headers = {"Authorization": f"Bearer {secret}"}
            status = client.post("/api/face-service", json={"action": "status", "userId": test_core.USER,
                                                          "deviceId": self.device_id}, headers=headers)
            self.assertEqual(status.json(), {"enrolled": True, "registered": True})
            removed = client.post("/api/face-service", json={"action": "remove", "userId": test_core.USER}, headers=headers)
            self.assertEqual(removed.json(), {"ok": True})
        self.assertFalse(self.request("status")["enrolled"])

    def test_auth_user_deletion_cascades_all_face_records(self):
        self.enroll()
        with self.psycopg.connect(URL) as db:
            db.execute("DELETE FROM auth.users WHERE id = %s", (test_core.USER,))
            for table in ("accounts", "templates", "devices", "challenges", "attempts"):
                self.assertEqual(db.execute(f"SELECT COUNT(*) FROM face_auth.{table}").fetchone()[0], 0)

    def test_browser_roles_cannot_read_or_write_and_backend_cannot_read_auth_users(self):
        for role in ("anon", "authenticated"):
            for statement in ("SELECT * FROM face_auth.templates", "DELETE FROM face_auth.templates"):
                with self.psycopg.connect(URL) as db:
                    db.execute(f"SET LOCAL ROLE {role}")
                    with self.assertRaises(self.psycopg.errors.InsufficientPrivilege):
                        db.execute(statement)
        with self.psycopg.connect(self.role_url) as db:
            with self.assertRaises(self.psycopg.errors.InsufficientPrivilege):
                db.execute("SELECT * FROM auth.users")
