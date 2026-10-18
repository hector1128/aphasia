"""Offline smoke check of the configured real models; never enrolls a face."""
import argparse
import shlex
from pathlib import Path

import numpy as np

from liveness import MODELS, MiniFASLiveness


def model_config(path):
    allowed = {spec["prefix"] + suffix for spec in MODELS for suffix in ("_MODEL", "_SHA256")}
    config = {}
    for line in path.read_text().splitlines():
        key, separator, value = line.partition("=")
        key = key.strip()
        if separator and key in allowed:
            parts = shlex.split(value, comments=True)
            if len(parts) == 1:
                config[key] = parts[0]
    missing = allowed - config.keys()
    if missing:
        raise ValueError("Missing liveness settings: " + ", ".join(sorted(missing)))
    return config


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--env", type=Path, default=Path(__file__).resolve().parent / ".env")
    args = parser.parse_args()
    liveness = MiniFASLiveness(model_config(args.env))
    rng = np.random.default_rng(10)
    for image in (np.zeros((480, 640, 3), dtype=np.uint8), rng.integers(0, 256, (480, 640, 3), dtype=np.uint8)):
        scores = liveness.probabilities(image, [200, 100, 120, 160])
        if scores.shape != (3,) or not np.isfinite(scores).all() or not np.isclose(scores.sum(), 1):
            raise ValueError("Invalid liveness inference output")
    print("Both real MiniFASNet exports passed checksum, metadata and synthetic inference checks.")
    print("No face was enrolled. Recognition accuracy and spoof resistance have not been measured.")


if __name__ == "__main__":
    main()
