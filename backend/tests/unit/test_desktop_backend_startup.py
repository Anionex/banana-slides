import os
import socket
import subprocess
import sys
import time
import urllib.request
from pathlib import Path


def _free_port():
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]


def test_desktop_backend_starts_from_non_backend_cwd_with_database_path(tmp_path):
    backend_dir = Path(__file__).resolve().parents[2]
    port = _free_port()
    data_dir = tmp_path / "data"
    uploads_dir = tmp_path / "uploads"
    exports_dir = tmp_path / "exports"
    run_cwd = tmp_path / "cwd"
    run_cwd.mkdir()

    env = os.environ.copy()
    env.update(
        {
            "PYTHONPATH": str(backend_dir),
            "DATABASE_PATH": str(data_dir / "database.db"),
            "UPLOAD_FOLDER": str(uploads_dir),
            "EXPORT_FOLDER": str(exports_dir),
            "BACKEND_PORT": str(port),
            "FLASK_ENV": "production",
            "USE_MOCK_AI": "true",
            "GOOGLE_API_KEY": env.get("GOOGLE_API_KEY", "mock-api-key-for-testing"),
        }
    )

    proc = subprocess.Popen(
        [sys.executable, str(backend_dir / "app.py")],
        cwd=run_cwd,
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
    )
    output = ""
    try:
        deadline = time.time() + 20
        while time.time() < deadline:
            if proc.poll() is not None:
                output += proc.stdout.read() if proc.stdout else ""
                raise AssertionError(f"backend exited early with code {proc.returncode}\n{output}")
            try:
                with urllib.request.urlopen(f"http://127.0.0.1:{port}/health", timeout=1) as response:
                    assert response.status == 200
                    assert data_dir.joinpath("database.db").exists()
                    return
            except Exception:
                time.sleep(0.25)
        output += proc.stdout.read() if proc.stdout else ""
        raise AssertionError(f"backend did not become healthy on port {port}\n{output}")
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            proc.kill()
            proc.wait(timeout=5)
