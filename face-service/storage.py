"""Transactional face storage: SQLite locally, private Postgres on Vercel."""
import os
import sqlite3
from contextlib import contextmanager
from pathlib import Path


class SQLiteStore:
    def __init__(self, path):
        self.path = str(path)
        Path(path).parent.mkdir(mode=0o700, parents=True, exist_ok=True)
        descriptor = os.open(path, os.O_CREAT | os.O_RDWR, 0o600)
        os.close(descriptor)
        os.chmod(path, 0o600)
        with self.connect() as db:
            db.executescript("""
                CREATE TABLE IF NOT EXISTS accounts (user_id TEXT PRIMARY KEY, epoch INTEGER NOT NULL);
                CREATE TABLE IF NOT EXISTS templates (
                    user_id TEXT PRIMARY KEY, encrypted BLOB NOT NULL,
                    model_version TEXT NOT NULL, consent_version TEXT NOT NULL, consented_at INTEGER NOT NULL
                );
                CREATE TABLE IF NOT EXISTS devices (
                    user_id TEXT NOT NULL, device_id TEXT NOT NULL, public_key TEXT NOT NULL,
                    PRIMARY KEY (user_id, device_id)
                );
                CREATE TABLE IF NOT EXISTS challenges (
                    id TEXT PRIMARY KEY, user_id TEXT NOT NULL, device_id TEXT NOT NULL,
                    operation TEXT NOT NULL, message TEXT NOT NULL, expires INTEGER NOT NULL, epoch INTEGER NOT NULL
                );
                CREATE TABLE IF NOT EXISTS attempts (user_id TEXT NOT NULL, created INTEGER NOT NULL);
                CREATE INDEX IF NOT EXISTS attempts_user ON attempts(user_id, created);
            """)
            db.execute("BEGIN IMMEDIATE")
            primary = [row["name"] for row in db.execute("PRAGMA table_info(devices)") if row["pk"]]
            if primary == ["user_id"]:
                db.execute("""CREATE TABLE devices_multi (
                    user_id TEXT NOT NULL, device_id TEXT NOT NULL, public_key TEXT NOT NULL,
                    PRIMARY KEY (user_id, device_id))""")
                db.execute("INSERT INTO devices_multi SELECT user_id, device_id, public_key FROM devices")
                db.execute("DROP TABLE devices")
                db.execute("ALTER TABLE devices_multi RENAME TO devices")

    @contextmanager
    def connect(self, user=None):
        db = sqlite3.connect(self.path, timeout=30)
        db.row_factory = sqlite3.Row
        try:
            db.execute("PRAGMA secure_delete = ON")
            with db:
                if user is not None:
                    db.execute("BEGIN IMMEDIATE")
                yield db
        finally:
            db.close()


class PostgresConnection:
    """Adapt parameter markers for the protocol's fixed, internal SQL statements."""
    def __init__(self, connection):
        self.connection = connection

    def execute(self, statement, parameters=()):
        return self.connection.execute(statement.replace("?", "%s"), parameters)


class PostgresStore:
    def __init__(self, url):
        from psycopg.conninfo import conninfo_to_dict

        self.url = url
        options = conninfo_to_dict(url)
        # Only isolated local integration tests may use an unencrypted connection.
        local = options.get("host") in ("127.0.0.1", "localhost", "::1")
        # Supabase's Postgres CA is not in the system trust store. Use the
        # provider's public root for its database hosts; still verify hostnames.
        supabase = options.get("host", "").endswith((".pooler.supabase.com", ".supabase.co"))
        self.tls = {} if local else {"sslmode": "verify-full", "sslrootcert":
            str(Path(__file__).with_name("supabase-ca.crt")) if supabase else "system"}

    @contextmanager
    def connect(self, user=None):
        import psycopg
        from psycopg.rows import dict_row

        # Short-lived connections fit Supabase's transaction pooler. No prepared
        # statements or process-local locks/state are relied upon across requests.
        with psycopg.connect(self.url, connect_timeout=5, prepare_threshold=None,
                             row_factory=dict_row, **self.tls) as connection:
            connection.execute("SET LOCAL search_path = face_auth, pg_catalog")
            connection.execute("SET LOCAL statement_timeout = '5s'")
            connection.execute("SET LOCAL lock_timeout = '3s'")
            db = PostgresConnection(connection)
            if user is not None:
                db.execute("INSERT INTO accounts VALUES (?, 0) ON CONFLICT DO NOTHING", (user,))
                # Serialize account mutations across all Vercel function instances.
                db.execute("SELECT epoch FROM accounts WHERE user_id = ? FOR UPDATE", (user,))
            yield db
