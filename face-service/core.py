"""Private face protocol and encryption, independent of Supabase Auth sessions."""
import base64
import hashlib
import json
import secrets
import time
import uuid

from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.asymmetric.utils import encode_dss_signature
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from storage import SQLiteStore

CONSENT_VERSION = "face-trial-v1"


class Rejected(Exception):
    def __init__(self, code):
        self.code = code


def identifier(value):
    try:
        if str(uuid.UUID(value)) != value:
            raise ValueError()
        return value
    except (ValueError, TypeError, AttributeError):
        raise Rejected("invalid") from None


def decode_frames(frames):
    if not isinstance(frames, list) or len(frames) != 3:
        raise Rejected("invalid")
    result = []
    for frame in frames:
        if not isinstance(frame, str) or not 100 <= len(frame) <= 300000:
            raise Rejected("invalid")
        try:
            result.append(base64.b64decode(frame, validate=True))
        except ValueError:
            raise Rejected("invalid") from None
    return result


def capture_message(challenge, frames):
    return (challenge + "\n" + "\n".join(hashlib.sha256(frame).hexdigest() for frame in frames)).encode()


def public_key(jwk):
    try:
        if not isinstance(jwk, dict) or jwk.get("kty") != "EC" or jwk.get("crv") != "P-256" or "d" in jwk:
            raise ValueError()
        coordinates = []
        for field in ("x", "y"):
            encoded = jwk[field]
            if not isinstance(encoded, str) or len(encoded) != 43:
                raise ValueError()
            raw = base64.b64decode(encoded + "=", altchars=b"-_", validate=True)
            if len(raw) != 32:
                raise ValueError()
            coordinates.append(int.from_bytes(raw, "big"))
        return ec.EllipticCurvePublicNumbers(*coordinates, ec.SECP256R1()).public_key()
    except (ValueError, KeyError, TypeError):
        raise Rejected("device") from None


def check_signature(jwk, signature, message):
    key = public_key(jwk)
    try:
        if not isinstance(signature, str) or len(signature) > 100:
            raise ValueError()
        raw = base64.b64decode(signature, validate=True)
        if len(raw) != 64:
            raise ValueError()
        # WebCrypto returns IEEE P1363 r||s; cryptography accepts ASN.1 DER.
        der = encode_dss_signature(int.from_bytes(raw[:32], "big"), int.from_bytes(raw[32:], "big"))
        key.verify(der, message, ec.ECDSA(hashes.SHA256()))
    except (ValueError, InvalidSignature):
        raise Rejected("device") from None


class FaceTrial:
    def __init__(self, path, encryption_key, engine, clock=time.time, *, store=None):
        if len(encryption_key) != 32:
            raise ValueError("FACE_ENCRYPTION_KEY must decode to 32 bytes")
        self.store = store if store is not None else SQLiteStore(path)
        self.path = str(path) if path is not None else None
        self.cipher = AESGCM(encryption_key)
        self.engine = engine
        self.clock = clock

    def connect(self, user=None):
        return self.store.connect(user)

    def handle(self, body):
        if not isinstance(body, dict):
            raise Rejected("invalid")
        user = identifier(body.get("userId"))
        # The shared-secret HTTP boundary admits only the gateway. It authenticates
        # setup requests with Supabase and supplies the authenticated account UUID.
        action = body.get("action")
        if action == "status":
            with self.connect() as db:
                enrolled = db.execute("SELECT 1 FROM templates WHERE user_id = ?", (user,)).fetchone() is not None
                registered = db.execute("SELECT 1 FROM devices WHERE user_id = ? AND device_id = ?",
                                        (user, body.get("deviceId", ""))).fetchone() is not None
            return {"enrolled": enrolled, "registered": enrolled and registered}
        if action == "remove":
            with self.connect(user) as db:
                db.execute("INSERT INTO accounts VALUES (?, 1) ON CONFLICT(user_id) DO UPDATE SET epoch = accounts.epoch + 1", (user,))
                # Keep non-biometric rate counters: removal must not reset inference limits.
                for table in ("templates", "devices", "challenges"):
                    db.execute(f"DELETE FROM {table} WHERE user_id = ?", (user,))
            return {"ok": True}
        if action == "begin":
            return self.begin(user, body)
        if action in ("enroll", "register", "verify", "login"):
            return self.complete(user, body)
        raise Rejected("invalid")

    def begin(self, user, body):
        operation = body.get("operation")
        if operation not in ("enroll", "register", "verify", "login"):
            raise Rejected("invalid")
        device = identifier(body.get("deviceId"))
        now = int(self.clock())
        with self.connect(user) as db:
            db.execute("DELETE FROM attempts WHERE user_id = ? AND created <= ?", (user, now - 60))
            db.execute("DELETE FROM challenges WHERE user_id = ? AND expires <= ?", (user, now))
            if db.execute("SELECT COUNT(*) AS total FROM attempts WHERE user_id = ?", (user,)).fetchone()["total"] >= 6:
                raise Rejected("limited")
            if operation in ("verify", "login") and not db.execute("SELECT 1 FROM devices WHERE user_id = ? AND device_id = ?", (user, device)).fetchone():
                raise Rejected("device")
            if operation == "register" and not db.execute("SELECT 1 FROM templates WHERE user_id = ?", (user,)).fetchone():
                raise Rejected("device")
            db.execute("INSERT INTO accounts VALUES (?, 0) ON CONFLICT DO NOTHING", (user,))
            epoch = db.execute("SELECT epoch FROM accounts WHERE user_id = ?", (user,)).fetchone()["epoch"]
            challenge_id = str(uuid.uuid4())
            message = f"my-day-face-v1\n{operation}\n{user}\n{device}\n{secrets.token_urlsafe(32)}"
            db.execute("INSERT INTO attempts VALUES (?, ?)", (user, now))
            db.execute("INSERT INTO challenges VALUES (?, ?, ?, ?, ?, ?, ?)",
                       (challenge_id, user, device, operation, message, now + 120, epoch))
        return {"challengeId": challenge_id, "message": message}

    def complete(self, user, body):
        challenge_id = identifier(body.get("challengeId"))
        device_id = identifier(body.get("deviceId"))
        # Consume durably before checking proof or invoking inference. Failures cannot replay.
        with self.connect(user) as db:
            challenge = db.execute("SELECT * FROM challenges WHERE id = ? AND user_id = ?", (challenge_id, user)).fetchone()
            if challenge is None:
                raise Rejected("expired")
            db.execute("DELETE FROM challenges WHERE id = ?", (challenge_id,))
        if challenge["expires"] <= self.clock() or challenge["operation"] != body["action"] or challenge["device_id"] != device_id:
            raise Rejected("expired")
        with self.connect() as db:
            device = db.execute("SELECT * FROM devices WHERE user_id = ? AND device_id = ?", (user, device_id)).fetchone()
            template = db.execute("SELECT * FROM templates WHERE user_id = ?", (user,)).fetchone()
        enrolling = body["action"] == "enroll"
        registering = body["action"] == "register"
        if (enrolling or registering) and body.get("consentVersion") != CONSENT_VERSION:
            raise Rejected("invalid")
        if not enrolling and (template is None or (not registering and device is None)):
            raise Rejected("device")
        frames = decode_frames(body.get("frames"))
        jwk = body.get("publicKey") if enrolling or registering else json.loads(device["public_key"])
        check_signature(jwk, body.get("signature"), capture_message(challenge["message"], frames))
        # Raw captures never enter either database or application logs.
        vector = self.engine.enroll(frames) if enrolling else None
        if not enrolling:
            if template["model_version"] != self.engine.version:
                raise Rejected("unavailable")
            aad = f"{user}:{template['model_version']}".encode()
            encrypted = template["encrypted"]
            enrolled = self.cipher.decrypt(encrypted[:12], encrypted[12:], aad)
            if not self.engine.verify(frames, enrolled):
                raise Rejected("mismatch")
        with self.connect(user) as db:
            epoch = db.execute("SELECT epoch FROM accounts WHERE user_id = ?", (user,)).fetchone()
            # Removal or re-enrollment during inference invalidates an in-flight result.
            if epoch is None or epoch["epoch"] != challenge["epoch"] or challenge["expires"] <= self.clock():
                raise Rejected("expired")
            if enrolling:
                nonce = secrets.token_bytes(12)
                aad = f"{user}:{self.engine.version}".encode()
                encrypted = nonce + self.cipher.encrypt(nonce, vector, aad)
                db.execute("""INSERT INTO templates VALUES (?, ?, ?, ?, ?)
                           ON CONFLICT(user_id) DO UPDATE SET encrypted = excluded.encrypted,
                           model_version = excluded.model_version, consent_version = excluded.consent_version,
                           consented_at = excluded.consented_at""",
                           (user, encrypted, self.engine.version, CONSENT_VERSION, int(self.clock())))
                db.execute("DELETE FROM devices WHERE user_id = ?", (user,))
                db.execute("UPDATE accounts SET epoch = epoch + 1 WHERE user_id = ?", (user,))
                db.execute("DELETE FROM challenges WHERE user_id = ?", (user,))
            if enrolling or registering:
                safe_jwk = {key: jwk[key] for key in ("kty", "crv", "x", "y")}
                # Adding a browser must never replace another browser's key, even
                # when two registration requests finish concurrently.
                db.execute("INSERT INTO devices VALUES (?, ?, ?) ON CONFLICT DO NOTHING", (user, device_id, json.dumps(safe_jwk)))
                saved = db.execute("SELECT public_key FROM devices WHERE user_id = ? AND device_id = ?", (user, device_id)).fetchone()
                if json.loads(saved["public_key"]) != safe_jwk:
                    raise Rejected("device")
        if body["action"] == "login":
            return {"verified": True, "userId": user}
        return {"ok": True} if enrolling or registering else {"verified": True}
