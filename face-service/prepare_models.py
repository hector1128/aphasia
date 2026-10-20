"""Download missing pinned face models; verify and retain existing valid files.

Run before starting the private service. No face captures, templates or secrets
are uploaded. --write-env updates model paths/checksums only after full success.
"""
import argparse
from pathlib import Path

from model_files import download, write_env
from prepare_liveness import prepare

SERVICE = Path(__file__).resolve().parent
OPENCV_REVISION = "47534e27c9851bb1128ccc0102f1145e27f23f98"
MODELS = (
    {"prefix": "FACE_DETECTOR", "directory": "face_detection_yunet", "upstream": "face_detection_yunet_2023mar.onnx",
     "file": "yunet.onnx", "sha256": "8f2383e4dd3cfbb4553ea8718107fc0423210dc964f9f4280604804ed2552fa4",
     "max_size": 1000000, "license": "YUNET-LICENSE",
     "license_sha256": "c83b8120c50ccbd4c4f96edf53141bdd566ebb8f8e9227e415326aa1b1aba958"},
    {"prefix": "FACE_RECOGNIZER", "directory": "face_recognition_sface", "upstream": "face_recognition_sface_2021dec.onnx",
     "file": "sface.onnx", "sha256": "0ba9fbfa01b5270c96627c4ef784da859931e02f04419c829e83484087c34e79",
     "max_size": 50000000, "license": "SFACE-LICENSE",
     "license_sha256": "cfc7749b96f63bd31c3c42b5c471bf756814053e847c10f3eb003417bc523d30"},
)


def prepare_models(folder):
    folder = folder.resolve()
    values = {}
    for spec in MODELS:
        relative = f"models/{spec['directory']}"
        url = f"https://media.githubusercontent.com/media/opencv/opencv_zoo/{OPENCV_REVISION}/{relative}/{spec['upstream']}"
        target = folder / spec["file"]
        existed = target.exists()
        download(url, target, spec["sha256"], spec["max_size"])
        license_url = f"https://raw.githubusercontent.com/opencv/opencv_zoo/{OPENCV_REVISION}/{relative}/LICENSE"
        download(license_url, folder / spec["license"], spec["license_sha256"], 100000)
        values[spec["prefix"] + "_MODEL"] = str(target)
        values[spec["prefix"] + "_SHA256"] = spec["sha256"]
        print(f"{target.name}: {'existing file' if existed else 'downloaded'} verified")
    values.update(prepare(folder, if_missing=True))
    return values


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--models-dir", type=Path, default=SERVICE / "models", help="Persistent model directory")
    parser.add_argument("--write-env", type=Path, help="Update only model paths/checksums, preserving all other settings")
    args = parser.parse_args()
    values = prepare_models(args.models_dir)
    if args.write_env:
        write_env(args.write_env, values)
        print(f"Saved model paths/checksums to {args.write_env}; other settings unchanged.")
    print("All four face models are ready. Existing verified exports were retained.")


if __name__ == "__main__":
    main()
