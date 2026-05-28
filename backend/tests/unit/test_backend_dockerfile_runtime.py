from pathlib import Path


def test_backend_container_uses_prebuilt_virtualenv_at_runtime():
    dockerfile = Path(__file__).resolve().parents[2] / "Dockerfile"
    content = dockerfile.read_text(encoding="utf-8")

    cmd_lines = [line for line in content.splitlines() if line.startswith("CMD ")]

    assert len(cmd_lines) == 1
    assert "/app/.venv/bin/alembic upgrade head" in cmd_lines[0]
    assert "exec /app/.venv/bin/python app.py" in cmd_lines[0]
    assert "uv run" not in cmd_lines[0]
