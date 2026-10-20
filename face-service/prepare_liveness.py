"""Download pinned weights, export to ONNX, verify parity, optionally configure paths.

Run before serving requests; HTTP handlers never download models or run PyTorch.
"""
import argparse
import json
import os
import tempfile
from pathlib import Path

import numpy as np
import onnxruntime as ort

from liveness import MODELS, REVISION, MiniFASLiveness, model_metadata
from model_files import checksum, download, write_env

SERVICE = Path(__file__).resolve().parent
SOURCE_HASHES = {
    "MiniFASNet.py": "e498c4ec5e1ddfaba62b941a126c19d65aa564999f3309661fe43ee8bf38acd7",
    "generate_patches.py": "cd33552d5ca920088143daafceba3c19b7a64bf9aac125241803e1b4af698d65",
}


def verify_source():
    for name, expected in SOURCE_HASHES.items():
        if checksum(SERVICE / "vendor" / "minifasnet" / name) != expected:
            raise ValueError(f"Vendored {name} differs from the reviewed pinned source")


def weights(spec, folder):
    path = folder / spec["weight"]
    url = f"https://raw.githubusercontent.com/minivision-ai/Silent-Face-Anti-Spoofing/{REVISION}/resources/anti_spoof_models/{spec['weight']}"
    return download(url, path, spec["sha256"], 10000000)


def load_original(spec, path):
    import torch

    verify_source()
    from vendor.minifasnet import MiniFASNet
    model = getattr(MiniFASNet, spec["architecture"])(conv6_kernel=(5, 5))
    state = torch.load(path, map_location="cpu", weights_only=True)
    state = {key.removeprefix("module."): value for key, value in state.items()}
    model.load_state_dict(state, strict=True)
    return model.eval()


def export(spec, source, target):
    import onnx
    import torch

    torch.set_num_threads(1)
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
                "source_weight": spec["weight"], "source_sha256": spec["sha256"], "max_logit_error": maximum_error,
                "exporter": {"torch": torch.__version__, "onnx": onnx.__version__, "onnxruntime": ort.__version__}}
    finally:
        Path(temporary).unlink(missing_ok=True)


def existing_export(spec, target, previous):
    result = next((entry for entry in previous.get("models", []) if entry.get("file") == target.name), {})
    if (previous.get("source_revision") != REVISION or result.get("source_sha256") != spec["sha256"]
            or result.get("source_weight") != spec["weight"] or result.get("architecture") != spec["architecture"]
            or result.get("sha256") != checksum(target)):
        raise ValueError(f"Cannot verify existing {target}. Restore its liveness-manifest.json and pinned file, or remove the export to regenerate it.")
    result = dict(result)
    result.setdefault("exporter", {key: previous[key] for key in ("torch", "onnx", "onnxruntime") if key in previous})
    return result


def save_manifest(folder, records):
    record = {"source_revision": REVISION, "license": "Apache-2.0", "models": list(records.values())}
    descriptor, temporary = tempfile.mkstemp(dir=folder)
    try:
        with os.fdopen(descriptor, "w") as output:
            output.write(json.dumps(record, indent=2) + "\n")
        os.replace(temporary, folder / "liveness-manifest.json")
    finally:
        Path(temporary).unlink(missing_ok=True)


def prepare(folder, if_missing=False):
    verify_source()
    folder.mkdir(parents=True, exist_ok=True)
    manifest_path = folder / "liveness-manifest.json"
    previous = json.loads(manifest_path.read_text()) if if_missing and manifest_path.exists() else {}
    # Check every existing export before changing anything. A damaged or unknown
    # file is an error, not a request to silently change enrolled templates.
    records = {spec["file"]: existing_export(spec, folder / spec["file"], previous)
               for spec in MODELS if if_missing and (folder / spec["file"]).exists()}
    values = {}
    for spec in MODELS:
        target = folder / spec["file"]
        if spec["file"] in records:
            result = records[spec["file"]]
            print(f"{spec['architecture']}: existing export verified; unchanged")
        else:
            source = weights(spec, folder / "source")
            try:
                result = export(spec, source, target)
            except ImportError as error:
                raise RuntimeError("Missing export dependencies. Install face-service/requirements-export.txt and rerun setup.") from error
            records[spec["file"]] = result
            # Save each completed export so an interrupted first deployment can
            # resume without discarding already verified work.
            save_manifest(folder, records)
            print(f"{spec['architecture']}: exported and parity checked; max logit error {result['max_logit_error']:.8f}")
        values[spec["prefix"] + "_MODEL"] = str(target)
        values[spec["prefix"] + "_SHA256"] = result["sha256"]
    MiniFASLiveness(values)  # Validate actual graph shapes and pinned preprocessing metadata too.
    for name in ("LICENSE", "NOTICE"):
        (folder / f"MINIFASNET-{name}").write_bytes((SERVICE / "vendor" / "minifasnet" / name).read_bytes())
    return values


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--write-env", type=Path, help="Update only model paths/checksums; preserve other settings")
    parser.add_argument("--if-missing", action="store_true", help="Verify and reuse existing exports instead of regenerating them")
    parser.add_argument("--models-dir", type=Path, default=SERVICE / "models")
    args = parser.parse_args()
    values = prepare(args.models_dir.resolve(), args.if_missing)
    if args.write_env:
        write_env(args.write_env, values)
        print(f"Saved liveness paths/checksums to {args.write_env}; thresholds and trial activation unchanged.")


if __name__ == "__main__":
    main()
