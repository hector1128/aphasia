"""Checksum-pinned, atomic downloads and model-only environment updates."""
import hashlib
import os
from pathlib import Path
import shlex
import tempfile
from urllib.request import urlopen


def checksum(path):
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def download(url, path, expected, max_size):
    if path.exists():
        if checksum(path) != expected:
            raise ValueError(f"Checksum mismatch: {path}. Restore the pinned file or remove it and rerun setup.")
        return path
    path.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary = tempfile.mkstemp(suffix=".part", dir=path.parent)
    try:
        digest, size = hashlib.sha256(), 0
        with os.fdopen(descriptor, "wb") as output, urlopen(url, timeout=60) as response:
            while chunk := response.read(min(1024 * 1024, max_size - size + 1)):
                size += len(chunk)
                if size > max_size:
                    raise ValueError(f"Download too large: {path.name}")
                digest.update(chunk)
                output.write(chunk)
        if digest.hexdigest() != expected:
            raise ValueError(f"Downloaded checksum mismatch: {path.name}")
        os.replace(temporary, path)
        return path
    finally:
        Path(temporary).unlink(missing_ok=True)


def write_env(path, values):
    example = Path(__file__).resolve().parent / ".env.example"
    text = path.read_text() if path.exists() else example.read_text()
    lines, seen = [], set()
    for line in text.splitlines():
        key = line.partition("=")[0].strip().removeprefix("export ").strip()
        if key == "FACE_PAD_SIZE":
            continue  # Retired generic adapter; these models always use 80x80.
        if key in values:
            line = f"{key}={shlex.quote(values[key])}"
            seen.add(key)
        lines.append(line)
    lines.extend(f"{key}={shlex.quote(value)}" for key, value in values.items() if key not in seen)
    descriptor, temporary = tempfile.mkstemp(dir=path.parent)
    try:
        with os.fdopen(descriptor, "w") as output:
            output.write("\n".join(lines) + "\n")
        os.replace(temporary, path)
    finally:
        Path(temporary).unlink(missing_ok=True)
