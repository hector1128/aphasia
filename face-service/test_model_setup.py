"""Deployment model setup tests use synthetic bytes; no downloads or real faces."""
import hashlib
import io
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from liveness import MODELS, REVISION
from model_files import checksum, download, write_env
import prepare_liveness
import prepare_models
import start_service


class DownloadTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.folder = Path(self.directory.name)
        self.path = self.folder / "model.onnx"
        self.data = b"synthetic-pinned-model"
        self.digest = hashlib.sha256(self.data).hexdigest()

    def tearDown(self):
        self.directory.cleanup()

    def test_download_is_verified_and_existing_file_needs_no_network(self):
        with patch("model_files.urlopen", return_value=io.BytesIO(self.data)) as request:
            download("https://example.com/model", self.path, self.digest, 100)
            request.assert_called_once()
        modified = self.path.stat().st_mtime_ns
        with patch("model_files.urlopen", side_effect=AssertionError("Unexpected download")):
            download("https://example.com/model", self.path, self.digest, 100)
        self.assertEqual(checksum(self.path), self.digest)
        self.assertEqual(self.path.stat().st_mtime_ns, modified)

    def test_existing_corruption_is_rejected_without_overwrite(self):
        self.path.write_bytes(b"damaged")
        with patch("model_files.urlopen") as request, self.assertRaises(ValueError):
            download("https://example.com/model", self.path, self.digest, 100)
        request.assert_not_called()
        self.assertEqual(self.path.read_bytes(), b"damaged")

    def test_bad_or_oversized_download_is_not_installed_and_can_be_retried(self):
        for content, maximum in ((b"incorrect", 100), (self.data, 2)):
            with patch("model_files.urlopen", return_value=io.BytesIO(content)), self.assertRaises(ValueError):
                download("https://example.com/model", self.path, self.digest, maximum)
            self.assertFalse(self.path.exists())
            self.assertEqual(list(self.folder.glob("*.part")), [])
        with patch("model_files.urlopen", return_value=io.BytesIO(self.data)):
            download("https://example.com/model", self.path, self.digest, 100)
        self.assertEqual(self.path.read_bytes(), self.data)

    def test_interrupted_download_cleans_up_partial_file(self):
        response = io.BytesIO(self.data)
        with patch.object(response, "read", side_effect=[self.data[:5], OSError("connection interrupted")]), \
                patch("model_files.urlopen", return_value=response), self.assertRaises(OSError):
            download("https://example.com/model", self.path, self.digest, 100)
        self.assertFalse(self.path.exists())
        self.assertEqual(list(self.folder.glob("*.part")), [])

    def test_env_update_preserves_secrets_database_thresholds_and_activation(self):
        path = self.folder / ".env"
        preserved = "FACE_SERVICE_SECRET=synthetic-secret\nFACE_ENCRYPTION_KEY=synthetic-key\nFACE_DB_PATH=/data/trial.sqlite\nFACE_MATCH_THRESHOLD=0.7\nFACE_PROTOTYPE_ENABLED=false\n"
        path.write_text(preserved + "FACE_PAD_SIZE=80\nFACE_PAD_MODEL=old\n")
        write_env(path, {"FACE_PAD_MODEL": "/models with spaces/pad.onnx", "FACE_PAD_SHA256": self.digest})
        self.assertTrue(path.read_text().startswith(preserved))
        self.assertNotIn("FACE_PAD_SIZE=", path.read_text())
        self.assertIn("FACE_PAD_MODEL='/models with spaces/pad.onnx'", path.read_text())
        self.assertEqual(path.stat().st_mode & 0o777, 0o600)


class LivenessPreparationTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.folder = Path(self.directory.name)

    def tearDown(self):
        self.directory.cleanup()

    def record(self, spec):
        target = self.folder / spec["file"]
        target.write_bytes(f"synthetic-{spec['file']}".encode())
        return {"file": spec["file"], "sha256": checksum(target), "architecture": spec["architecture"],
                "source_weight": spec["weight"], "source_sha256": spec["sha256"], "max_logit_error": 0.0}

    def save(self, records):
        path = self.folder / "liveness-manifest.json"
        path.write_text(json.dumps({"source_revision": REVISION, "models": records, "torch": "original-version"}))
        return path

    def test_existing_exports_and_legacy_manifest_stay_unchanged(self):
        records = [self.record(spec) for spec in MODELS]
        path = self.save(records)
        before = path.read_bytes()
        with patch("prepare_liveness.weights", side_effect=AssertionError("Unexpected download")), \
                patch("prepare_liveness.export", side_effect=AssertionError("Unexpected conversion")), \
                patch("prepare_liveness.MiniFASLiveness") as validate:
            values = prepare_liveness.prepare(self.folder, if_missing=True)
        validate.assert_called_once_with(values)
        self.assertEqual(path.read_bytes(), before)
        for spec, record in zip(MODELS, records):
            self.assertEqual(values[spec["prefix"] + "_SHA256"], record["sha256"])

    def test_corrupt_export_or_missing_manifest_fails_before_download_or_export(self):
        records = [self.record(spec) for spec in MODELS]
        path = self.save(records)
        (self.folder / MODELS[0]["file"]).write_bytes(b"damaged")
        for _ in range(2):
            with patch("prepare_liveness.weights") as weights, patch("prepare_liveness.export") as export, self.assertRaises(ValueError):
                prepare_liveness.prepare(self.folder, if_missing=True)
            weights.assert_not_called()
            export.assert_not_called()
            path.unlink(missing_ok=True)

    def test_interrupted_preparation_resumes_only_the_missing_export(self):
        def convert(spec, source, target):
            if spec == MODELS[1]:
                raise OSError("deployment interrupted")
            return self.record(spec)
        with patch("prepare_liveness.weights", return_value=self.folder / "source.pth"), \
                patch("prepare_liveness.export", side_effect=convert), self.assertRaises(OSError):
            prepare_liveness.prepare(self.folder, if_missing=True)
        self.assertTrue((self.folder / MODELS[0]["file"]).exists())
        self.assertTrue((self.folder / "liveness-manifest.json").exists())
        with patch("prepare_liveness.weights", return_value=self.folder / "source.pth") as weights, \
                patch("prepare_liveness.export", side_effect=lambda spec, source, target: self.record(spec)) as export, \
                patch("prepare_liveness.MiniFASLiveness"):
            prepare_liveness.prepare(self.folder, if_missing=True)
        self.assertEqual(export.call_count, 1)
        self.assertEqual(export.call_args.args[0], MODELS[1])
        self.assertEqual(weights.call_count, 1)


class DeploymentTests(unittest.TestCase):
    def test_opencv_models_use_pinned_official_urls_and_checksums(self):
        with tempfile.TemporaryDirectory() as directory, patch("prepare_models.download") as download, \
                patch("prepare_models.prepare", return_value={"FACE_PAD_MODEL": "verified-pad"}) as liveness:
            values = prepare_models.prepare_models(Path(directory))
        self.assertEqual(download.call_count, 4)
        self.assertIn("FACE_DETECTOR_MODEL", values)
        self.assertIn("FACE_RECOGNIZER_MODEL", values)
        self.assertEqual(values["FACE_PAD_MODEL"], "verified-pad")
        for call in download.call_args_list:
            self.assertIn(prepare_models.OPENCV_REVISION, call.args[0])
            self.assertEqual(len(call.args[2]), 64)
            self.assertTrue(call.args[0].startswith("https://"))
        liveness.assert_called_once_with(Path(directory).resolve(), if_missing=True)

    def test_service_receives_verified_model_config_and_preserves_platform_settings(self):
        values = {"FACE_DETECTOR_MODEL": "/data/models/yunet.onnx", "FACE_DETECTOR_SHA256": "pinned"}
        with patch.dict(os.environ, {"FACE_SERVICE_SECRET": "synthetic-secret", "FACE_MATCH_THRESHOLD": "0.7"}), \
                patch("start_service.prepare_models", return_value=values), patch("start_service.uvicorn.run") as serve:
            start_service.start(Path("/data/models"), "127.0.0.1", 8001)
            self.assertEqual(os.environ["FACE_SERVICE_SECRET"], "synthetic-secret")
            self.assertEqual(os.environ["FACE_MATCH_THRESHOLD"], "0.7")
            self.assertEqual(os.environ["FACE_DETECTOR_MODEL"], values["FACE_DETECTOR_MODEL"])
        serve.assert_called_once_with("app:create_app", factory=True, host="127.0.0.1", port=8001, workers=1, access_log=False)

    def test_service_never_starts_after_failed_model_preparation(self):
        with patch("start_service.prepare_models", side_effect=ValueError("checksum mismatch")), \
                patch("start_service.uvicorn.run") as serve, self.assertRaises(ValueError):
            start_service.start(Path("/data/models"), "127.0.0.1", 8001)
        serve.assert_not_called()


if __name__ == "__main__":
    unittest.main()
