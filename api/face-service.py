"""Authenticated Python inference endpoint, called only by the Node gateway."""
import os
import sys
import threading
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from starlette.concurrency import run_in_threadpool

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "face-service"))
from app import create_handler, log_unavailable
from vercel_models import runtime

app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)
private_handler = None
lock = threading.Lock()


def initialize():
    global private_handler
    with lock:
        if private_handler is None:
            # Missing settings/models fail closed. Never fall back to ephemeral SQLite.
            private_handler = create_handler(require_postgres=True,
                                             model_env=lambda: {**os.environ, **runtime()})
    return private_handler


@app.post("/api/face-service")
async def face(request: Request):
    import hmac

    secret = os.environ.get("FACE_SERVICE_SECRET", "")
    headers = {"Cache-Control": "no-store"}
    if len(secret) < 32 or not hmac.compare_digest(
            request.headers.get("authorization", "").encode(), f"Bearer {secret}".encode()):
        return JSONResponse({"code": "unavailable"}, status_code=401, headers=headers)
    try:
        backend = await run_in_threadpool(initialize)
    except Exception as error:
        log_unavailable("initialize", error)
        return JSONResponse({"code": "unavailable"}, status_code=503, headers=headers)
    return await backend(request)
