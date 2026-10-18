"""Download pinned weights, export to ONNX, verify parity, optionally configure paths.

Run explicitly; the HTTP service never downloads models or imports PyTorch.
"""
import argparse
import hashlib
import json
import os
import shlex
import tempfile
from pathlib import Path
from urllib.request import urlopen

import numpy as np
import onnx
import onnxruntime as ort
import torch

from liveness import MODELS, REVISION, model_metadata

SERVICE = Path(__file__).resolve().parent
SOURCE_HASHES = {
    "MiniFASNet.py": "e498c4ec5e1ddfaba62b941a126c19d65aa564999f3309661fe43ee8bf38acd7",
    "generate_patches.py": "cd33552d5ca920088143daafceba3c19b7a64bf9aac125241803e1b4af698d65",
}


def checksum(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def verify_source():
    for name, expected in SOURCE_HASHES.items():
        if checksum(SERVICE / "vendor" / "minifasnet" / name) != expected:
            raise ValueError(f"Vendored {name} differs from the reviewed pinned source")


def weights(spec, folder):
    path = folder / spec["weight"]
    if not path.exists():
        url = f"https://raw.githubusercontent.com/minivision-ai/Silent-Face-Anti-Spoofing/{REVISION}/resources/anti_spoof_models/{spec['weight']}"
        data = urlopen(url, timeout=30).read(10000000)
        if hashlib.sha256(data).hexdigest() != spec["sha256"]:
            raise ValueError("Downloaded weight checksum mismatch")
        folder.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
    if checksum(path) != spec["sha256"]:
        raise ValueError(f"Weight checksum mismatch: {path}")
    return path


def load_original(spec, path):
    verify_source()
    from vendor.minifasnet import MiniFASNet
    model = getattr(MiniFASNet, spec["architecture"])(conv6_kernel=(5, 5))
    state = torch.load(path, map_location="cpu", weights_only=True)
    state = {key.removeprefix("module."): value for key, value in state.items()}
    model.load_state_dict(state, strict=True)
    return model.eval()


def export(spec, source, target):
    model = load_original(spec, source)
    rng = np.random.default_rng(19)
    samples = [np.zeros((1, 3, 80, 80), dtype=np.float32),
               np.full((1, 3, 80, 80), 128, dtype=np.float32),
               rng.integers(0, 256, (1, 3, 80, 80)).astype(np.float32)]
    descriptor, temporary = tempfile.mkstemp(suffix=".onnx", dir=target.parent)
    os.close(descriptor)
    try:
        with torch.inference_mode():
            torch.onnx.export(model, torch.from_numpy(samples[0]), temporary, opset_version=17,
                              input_names=["input"], output_names=["logits"], dynamo=False, external_data=False)
        graph = onnx.load(temporary)
        onnx.helper.set_model_props(graph, model_metadata(spec))
        onnx.checker.check_model(graph, full_check=True)
        onnx.save(graph, temporary)
        session = ort.InferenceSession(temporary, providers=["CPUExecutionProvider"])
        maximum_error = 0.0
        for sample in samples:
            with torch.inference_mode():
                expected = model(torch.from_numpy(sample)).numpy()
            actual = session.run(None, {"input": sample})[0]
            if not np.isfinite(actual).all():
                raise ValueError("ONNX returned non-finite logits")
            np.testing.assert_allclose(actual, expected, rtol=1e-4, atol=1e-4)
            maximum_error = max(maximum_error, float(np.max(np.abs(actual - expected))))
        os.replace(temporary, target)
        return {"file": target.name, "sha256": checksum(target), "architecture": spec["architecture"],
                "source_weight": spec["weight"], "source_sha256": spec["sha256"], "max_logit_error": maximum_error}
    finally:
        Path(temporary).unlink(missing_ok=True)


def write_env(path, values):
    text = path.read_text() if path.exists() else (SERVICE / ".env.example").read_text()
    lines, seen = [], set()
    for line in text.splitlines():
        key = line.partition("=")[0].strip()
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


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--write-env", type=Path, help="Update only model paths/checksums; preserve other settings")
    args = parser.parse_args()
    verify_source()
    torch.set_num_threads(1)
    folder = SERVICE / "models"
    folder.mkdir(parents=True, exist_ok=True)
    manifest, values = [], {}
    for spec in MODELS:
        source = weights(spec, folder / "source")
        target = folder / spec["file"]
        result = export(spec, source, target)
        manifest.append(result)
        values[spec["prefix"] + "_MODEL"] = str(target)
        values[spec["prefix"] + "_SHA256"] = result["sha256"]
        print(f"{spec['architecture']}: exported and parity checked; max logit error {result['max_logit_error']:.8f}")
    record = {"source_revision": REVISION, "torch": torch.__version__, "onnx": onnx.__version__,
              "onnxruntime": ort.__version__, "license": "Apache-2.0", "models": manifest}
    (folder / "liveness-manifest.json").write_text(json.dumps(record, indent=2) + "\n")
    for name in ("LICENSE", "NOTICE"):
        (folder / f"MINIFASNET-{name}").write_bytes((SERVICE / "vendor" / "minifasnet" / name).read_bytes())
    if args.write_env:
        write_env(args.write_env, values)
        print(f"Saved liveness paths/checksums to {args.write_env}; thresholds and trial activation unchanged.")


if __name__ == "__main__":
    main()
