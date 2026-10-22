import os
from pathlib import Path
import re
import subprocess
import sys
import unittest
from unittest.mock import patch

import build_vercel


class BuildVercelTests(unittest.TestCase):
    def test_vercel_runtime_requirements_are_self_contained(self):
        path = build_vercel.SERVICE.parent / "requirements.txt"
        requirements = [line.strip() for line in path.read_text().splitlines()
                        if line.strip() and not line.lstrip().startswith("#")]
        self.assertFalse(any(line.startswith("-") for line in requirements),
                         "Vercel's requirements parser cannot resolve our nested -r include")
        packages = {re.split(r"[<>=!~;\s@]", line, maxsplit=1)[0] for line in requirements}
        self.assertTrue({"cryptography", "fastapi", "uvicorn", "psycopg[binary]",
                         "numpy", "onnxruntime", "opencv-python-headless"} <= packages)
        self.assertTrue(packages.isdisjoint({"torch", "onnx"}),
                         "Export dependencies must stay out of the function runtime")

    def test_build_uses_unseeded_environment_and_installs_only_into_it(self):
        environment = {"PATH": "/synthetic/tools", "FACE_SERVICE_SECRET": "synthetic",
                       "SUPABASE_SECRET_KEY": "synthetic", "POSTGRES_PASSWORD": "synthetic",
                       "PGPASSWORD": "synthetic"}
        with patch.dict(os.environ, environment, clear=True), \
                patch("venv.EnvBuilder._setup_pip", side_effect=AssertionError("ensurepip is unavailable")), \
                patch.object(build_vercel.subprocess, "run") as run:
            build_vercel.main()

        commands = [call.args[0] for call in run.call_args_list]
        self.assertEqual(len(commands), 4)
        temporary = commands[0][-1]
        python = str(Path(temporary) / "bin" / "python")
        self.assertEqual(commands[0], ["uv", "venv", "--python", sys.executable, temporary])
        for command in commands[1:3]:
            self.assertEqual(command[:5], ["uv", "pip", "install", "--python", python])
        self.assertIn("torch==2.12.0", commands[1])
        self.assertIn("https://download.pytorch.org/whl/cpu", commands[1])
        self.assertEqual(commands[3], [python, str(build_vercel.SERVICE / "vercel_models.py")])
        for call in run.call_args_list:
            self.assertTrue(call.kwargs["check"])
            self.assertEqual(call.kwargs["env"], {"PATH": "/synthetic/tools"})
        self.assertFalse(Path(temporary).exists())

    def test_install_failure_stops_export_and_removes_temporary_environment(self):
        temporary = None

        def execute(command, **_kwargs):
            nonlocal temporary
            if command[:2] == ["uv", "venv"]:
                temporary = Path(command[-1])
                self.assertTrue(temporary.is_dir())
                return
            raise subprocess.CalledProcessError(1, command)

        with patch.object(build_vercel.subprocess, "run", side_effect=execute) as run:
            with self.assertRaises(subprocess.CalledProcessError):
                build_vercel.main()
        self.assertEqual(run.call_count, 2)
        self.assertIsNotNone(temporary)
        self.assertFalse(temporary.exists())


if __name__ == "__main__":
    unittest.main()
