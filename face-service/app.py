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
from storage import PostgresStore


def create_handler(*, require_postgres=False, model_env=None):
    secret = os.environ["FACE_SERVICE_SECRET"]
    if len(secret) < 32:
        raise ValueError("Use a random FACE_SERVICE_SECRET of at least 32 characters")
    encryption_key = base64.b64decode(os.environ["FACE_ENCRYPTION_KEY"], validate=True)
    # Removal and status continue to work even if inference assets become unavailable.
    class LazyEngine:
        def __init__(self):
            self.instance = None
            self.lock = threading.Lock()

        def get(self):
            with self.lock:
                if self.instance is None:
                    values = model_env() if callable(model_env) else model_env
                    self.instance = Engine(values if values is not None else os.environ)
                return self.instance

        @property
        def version(self):
            return self.get().version

        def enroll(self, frames):
            return self.get().enroll(frames)

        def verify(self, frames, enrolled):
            return self.get().verify(frames, enrolled)

    database_url = os.environ.get("FACE_DATABASE_URL")
    if require_postgres and not database_url:
        raise ValueError("Vercel requires FACE_DATABASE_URL; local SQLite is not persistent there")
    store = PostgresStore(database_url) if database_url else None
    trial = FaceTrial(None if store else os.environ["FACE_DB_PATH"], encryption_key, LazyEngine(), store=store)
    # Bound concurrent captures; overload is retriable, never an unbounded inference queue.
    slots = threading.BoundedSemaphore(2)

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

    return face


def create_app():
    app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)
    app.add_api_route("/v1/face", create_handler(), methods=["POST"])
    return app
