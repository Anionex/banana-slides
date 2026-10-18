"""Extract gallery reference styles with the app's exact extraction prompt.

Uses the existing glance CLI and its scoped VISION_* environment. Results are
cached by image + prompt + model so reruns do not repeat completed API calls.
"""
import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import shutil
import subprocess

ROOT = Path(__file__).resolve().parents[2]
IMAGES = {
    "illustration": "template_vector_illustration.png",
    "parchment": "template_y.png",
    "academic-image": "template_academic.jpg",
    "blue-tech": "template_b.png",
    "blue-white": "template_s.png",
}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--templates", nargs="+", choices=IMAGES, default=list(IMAGES))
    args = parser.parse_args()
    glance = shutil.which("glance")
    if not glance:
        parser.error("glance must be installed")
    model = os.environ.get("VISION_MODEL")
    if not model:
        parser.error("VISION_MODEL must identify the extraction model")
    spec = importlib.util.spec_from_file_location("app_prompts", ROOT / "backend/services/prompts.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    prompt = module.get_style_extraction_prompt()
    args.output.mkdir(parents=True, exist_ok=True)

    def extract(key):
        image = ROOT / "frontend/public/templates" / IMAGES[key]
        digest = hashlib.sha256(image.read_bytes() + prompt.encode() + model.encode()).hexdigest()
        target = args.output / f"{key}.json"
        if target.exists():
            cached = json.loads(target.read_text())
            if cached.get("fingerprint") == digest and cached.get("description"):
                return {"template": key, "status": "cached"}
        try:
            run = subprocess.run([glance, str(image), "-q", prompt], capture_output=True, text=True, timeout=150)
            description = run.stdout.strip()
            if run.returncode or len(description) < 60:
                return {"template": key, "status": "validation-failed", "exitCode": run.returncode}
            result = {"fingerprint": digest, "model": model, "image": str(image.relative_to(ROOT)),
                      "promptSource": "backend/services/prompts.py:get_style_extraction_prompt", "description": description}
            temporary = target.with_suffix(".tmp")
            temporary.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n")
            temporary.replace(target)
            return {"template": key, "status": "success"}
        except subprocess.TimeoutExpired:
            return {"template": key, "status": "timeout"}

    with ThreadPoolExecutor(max_workers=3) as pool:
        results = [future.result() for future in as_completed([pool.submit(extract, key) for key in args.templates])]
    print(json.dumps(results))
    return int(any(item["status"] not in ("success", "cached") for item in results))


if __name__ == "__main__":
    raise SystemExit(main())
