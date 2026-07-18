from pathlib import Path

try:
    import tomllib
except ModuleNotFoundError:
    import tomli as tomllib


def test_backend_container_uses_prebuilt_virtualenv_at_runtime():
    dockerfile = Path(__file__).resolve().parents[2] / "Dockerfile"
    content = dockerfile.read_text(encoding="utf-8")

    cmd_lines = [line for line in content.splitlines() if line.startswith("CMD ")]

    assert len(cmd_lines) == 1
    assert "/app/.venv/bin/alembic upgrade head" in cmd_lines[0]
    assert "exec /app/.venv/bin/python app.py" in cmd_lines[0]
    assert "uv run" not in cmd_lines[0]


def test_lazyllm_runtime_provider_dependencies_are_packaged():
    pyproject = Path(__file__).resolve().parents[3] / "pyproject.toml"
    data = tomllib.loads(pyproject.read_text(encoding="utf-8"))

    dependencies = data["project"]["dependencies"]

    assert "lazyllm>=0.7.3" in dependencies
    assert not any(dep.startswith("lazyllm[") for dep in dependencies)
    assert any(dep.startswith("volcengine-python-sdk") for dep in dependencies)
    assert any(dep.startswith("zhipuai>=") for dep in dependencies)
    assert any(dep.startswith("dashscope>=") for dep in dependencies)


def test_desktop_backend_collects_dynamic_lazyllm_suppliers():
    spec = Path(__file__).resolve().parents[2] / "banana-slides.spec"
    content = spec.read_text(encoding="utf-8")

    assert "collect_submodules('lazyllm.module.llms.onlinemodule.supplier')" in content
