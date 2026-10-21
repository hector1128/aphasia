"""Bundle models during installation; load immutable model settings at runtime."""
import json
from pathlib import Path

PREFIXES = ("FACE_DETECTOR", "FACE_RECOGNIZER", "FACE_PAD", "FACE_PAD_SECOND")
BUNDLE = Path(__file__).resolve().parent / "bundled-models"


def build(folder=BUNDLE):
    from prepare_models import prepare_models

    values = prepare_models(folder)
    manifest = {prefix: {"file": Path(values[prefix + "_MODEL"]).name,
                         "sha256": values[prefix + "_SHA256"]} for prefix in PREFIXES}
    (folder / "model-config.json").write_text(json.dumps(manifest, indent=2) + "\n")


def runtime(folder=BUNDLE):
    # Read-only: no preparation calls, network requests, conversion or local state.
    manifest = json.loads((folder / "model-config.json").read_text())
    values = {}
    for prefix in PREFIXES:
        record = manifest[prefix]
        filename, digest = record["file"], record["sha256"]
        if (not isinstance(filename, str) or not filename or Path(filename).name != filename or filename in (".", "..")
                or not isinstance(digest, str) or len(digest) != 64
                or any(char not in "0123456789abcdef" for char in digest)):
            raise ValueError("Invalid bundled model manifest")
        values[prefix + "_MODEL"] = str(folder / filename)
        values[prefix + "_SHA256"] = digest
    return values


if __name__ == "__main__":
    build()
