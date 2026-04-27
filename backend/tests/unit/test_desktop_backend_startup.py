import json
import os
import socket
import sqlite3
import subprocess
import sys
import time
import urllib.request
from pathlib import Path


def _free_port():
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]


def _start_desktop_backend(tmp_path, db_path):
    backend_dir = Path(__file__).resolve().parents[2]
    port = _free_port()
    uploads_dir = tmp_path / "uploads"
    exports_dir = tmp_path / "exports"
    run_cwd = tmp_path / "cwd"
    run_cwd.mkdir()

    env = os.environ.copy()
    env.update(
        {
            "PYTHONPATH": str(backend_dir),
            "DATABASE_PATH": str(db_path),
            "UPLOAD_FOLDER": str(uploads_dir),
            "EXPORT_FOLDER": str(exports_dir),
            "BACKEND_PORT": str(port),
            "FLASK_ENV": "production",
            "USE_MOCK_AI": "true",
            "GOOGLE_API_KEY": env.get("GOOGLE_API_KEY", "mock-api-key-for-testing"),
        }
    )

    return port, subprocess.Popen(
        [sys.executable, str(backend_dir / "app.py")],
        cwd=run_cwd,
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
    )


def _wait_for_health(proc, port, db_path):
    output = ""
    deadline = time.time() + 20
    while time.time() < deadline:
        if proc.poll() is not None:
            output += proc.stdout.read() if proc.stdout else ""
            raise AssertionError(f"backend exited early with code {proc.returncode}\n{output}")
        try:
            with urllib.request.urlopen(f"http://127.0.0.1:{port}/health", timeout=1) as response:
                assert response.status == 200
                assert db_path.exists()
                return
        except Exception:
            time.sleep(0.25)
    output += proc.stdout.read() if proc.stdout else ""
    raise AssertionError(f"backend did not become healthy on port {port}\n{output}")


def _stop_backend(proc):
    proc.terminate()
    try:
        proc.wait(timeout=5)
    except subprocess.TimeoutExpired:
        proc.kill()
        proc.wait(timeout=5)


def test_desktop_backend_starts_from_non_backend_cwd_with_database_path(tmp_path):
    db_path = tmp_path / "data" / "database.db"
    port, proc = _start_desktop_backend(tmp_path, db_path)
    try:
        _wait_for_health(proc, port, db_path)
    finally:
        _stop_backend(proc)


def test_desktop_backend_repairs_old_settings_schema_before_update(tmp_path):
    db_path = tmp_path / "data" / "database.db"
    db_path.parent.mkdir(parents=True)
    with sqlite3.connect(db_path) as conn:
        conn.execute(
            """
            CREATE TABLE settings (
                id INTEGER PRIMARY KEY,
                ai_provider_format VARCHAR(20),
                api_base_url VARCHAR(500),
                api_key VARCHAR(500),
                image_resolution VARCHAR(20),
                image_aspect_ratio VARCHAR(10),
                max_description_workers INTEGER,
                max_image_workers INTEGER,
                created_at DATETIME,
                updated_at DATETIME
            )
            """
        )
        conn.execute(
            """
            INSERT INTO settings (
                id, ai_provider_format, image_resolution, image_aspect_ratio,
                max_description_workers, max_image_workers
            ) VALUES (1, 'gemini', '2K', '16:9', 5, 8)
            """
        )
        conn.execute("CREATE TABLE alembic_version (version_num VARCHAR(32) NOT NULL)")
        conn.executemany(
            "INSERT INTO alembic_version (version_num) VALUES (?)",
            [('267dcee7b580',), ('016_add_narration_text_to_pages',)],
        )

    port, proc = _start_desktop_backend(tmp_path, db_path)
    try:
        _wait_for_health(proc, port, db_path)
        payload = json.dumps({
            "enable_text_reasoning": True,
            "text_thinking_budget": 2048,
            "image_resolution": "2K",
        }).encode("utf-8")
        request = urllib.request.Request(
            f"http://127.0.0.1:{port}/api/settings",
            data=payload,
            headers={"Content-Type": "application/json"},
            method="PUT",
        )
        with urllib.request.urlopen(request, timeout=5) as response:
            body = json.loads(response.read().decode("utf-8"))
        assert response.status == 200
        assert body["success"] is True

        with sqlite3.connect(db_path) as conn:
            columns = {row[1] for row in conn.execute("PRAGMA table_info(settings)")}
            assert "enable_text_reasoning" in columns
            assert "text_thinking_budget" in columns
            value = conn.execute("SELECT enable_text_reasoning FROM settings WHERE id = 1").fetchone()[0]
            assert value == 1
    finally:
        _stop_backend(proc)
