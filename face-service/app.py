"""Private HTTP boundary. Bind to loopback or place behind authenticated TLS ingress."""
import base64
import hmac
import json
import os
import threading

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from starlette.concurrency import run_in_threadpool

from core import FaceTrial, Rejected
from engine import Engine


def create_app():
    secret = os.environ["FACE_SERVICE_SECRET"]
    if len(secret) < 32:
        raise ValueError("Use a random FACE_SERVICE_SECRET of at least 32 characters")
    allowed_users = [user.strip() for user in os.environ["FACE_TEST_USER_IDS"].split(",") if user.strip()]
    if not allowed_users:
        raise ValueError("Explicit test-account allowlist required")
    encryption_key = base64.b64decode(os.environ["FACE_ENCRYPTION_KEY"], validate=True)
    # Removal and status continue to work even if inference assets become unavailable.
    class LazyEngine:
        def __init__(self):
            self.instance = None
            self.lock = threading.Lock()

        def get(self):
            with self.lock:
                if self.instance is None:
                    self.instance = Engine()
                return self.instance

        @property
        def version(self):
            return self.get().version

        def enroll(self, frames):
            return self.get().enroll(frames)

        def verify(self, frames, enrolled):
            return self.get().verify(frames, enrolled)

    trial = FaceTrial(os.environ["FACE_DB_PATH"], encryption_key, LazyEngine(), allowed_users)
    app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)
    # Bound concurrent captures; overload is retriable, never an unbounded inference queue.
    slots = threading.BoundedSemaphore(2)

    @app.post("/v1/face")
    async def face(request: Request):
        headers = {"Cache-Control": "no-store"}
        def error(code, status):
            return JSONResponse({"code": code}, status_code=status, headers=headers)
        authorization = request.headers.get("authorization", "")
        if not hmac.compare_digest(authorization.encode(), f"Bearer {secret}".encode()):
            return error("unavailable", 401)
        if not request.headers.get("content-type", "").startswith("application/json"):
            return error("invalid", 415)
        if not slots.acquire(blocking=False):
            return error("limited", 429)
        try:
            raw = bytearray()
            async for chunk in request.stream():
                raw.extend(chunk)
                if len(raw) > 1000000:
                    return error("invalid", 413)
            try:
                body = json.loads(raw)
            except (ValueError, UnicodeError):
                return error("invalid", 400)
            try:
                result = await run_in_threadpool(trial.handle, body)
                return JSONResponse(result, headers=headers)
            except Rejected as rejection:
                return error(rejection.code, 429 if rejection.code == "limited" else 400)
            except Exception:
                # Do not leak/log frames, templates, model internals, or credentials.
                return error("unavailable", 503)
        finally:
            slots.release()

    return app
