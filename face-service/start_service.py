"""Deployment entrypoint: prepare missing models, then start the private API."""
import argparse
import os
from pathlib import Path

import uvicorn

from prepare_models import SERVICE, prepare_models


def start(folder, host, port):
    values = prepare_models(folder)
    # Platforms supply secrets/thresholds as environment variables. Add only the
    # verified model paths/checksums; do not generate/source a replacement .env.
    os.environ.update(values)
    uvicorn.run("app:create_app", factory=True, host=host, port=port, workers=1, access_log=False)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--models-dir", type=Path, default=Path(os.environ.get("FACE_MODELS_DIR", SERVICE / "models")))
    parser.add_argument("--host", default="127.0.0.1", help="Bind address; use 0.0.0.0 for a private container network")
    parser.add_argument("--port", type=int, default=int(os.environ.get("PORT", "8001")))
    args = parser.parse_args()
    start(args.models_dir, args.host, args.port)


if __name__ == "__main__":
    main()
