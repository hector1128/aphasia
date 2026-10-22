"""Vercel installation step: prepare models before any function is packaged."""
import os
import subprocess
import sys
import tempfile
from pathlib import Path

SERVICE = Path(__file__).resolve().parent


def main():
    # Export tooling must never be installed in Vercel's runtime environment.
    # No database connection, secret, encryption key or patient data is needed.
    with tempfile.TemporaryDirectory(prefix="aphasia-model-build-") as temporary:
        python = str(Path(temporary) / "bin" / "python")
        environment = {key: value for key, value in os.environ.items()
                       if not key.startswith(("FACE_", "SUPABASE_", "POSTGRES_", "PG"))}
        commands = [
            # uv creates an unseeded environment, avoiding ensurepip in Vercel's managed Python.
            ["uv", "venv", "--python", sys.executable, temporary],
            ["uv", "pip", "install", "--python", python, "torch==2.12.0", "--index-url", "https://download.pytorch.org/whl/cpu"],
            ["uv", "pip", "install", "--python", python, "-r", str(SERVICE / "requirements-vercel-build.txt")],
            [python, str(SERVICE / "vercel_models.py")],
        ]
        for command in commands:
            subprocess.run(command, check=True, env=environment)
    print("Face models prepared; temporary exporter environment removed.")


if __name__ == "__main__":
    main()
