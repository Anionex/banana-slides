"""
Tests for importing parsed reference-file images into project materials.
"""
from pathlib import Path

from PIL import Image

from conftest import assert_success_response
from models import ReferenceFile, db
from services.material_import_service import import_reference_markdown_images_to_materials


def _write_test_image(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    Image.new("RGB", (24, 24), color="green").save(path, format="PNG")


def _create_project(client) -> str:
    response = client.post(
        "/api/projects",
        json={"creation_type": "idea", "idea_prompt": "测试自动入库"},
    )
    data = assert_success_response(response, 201)
    return data["data"]["project_id"]


def test_associate_completed_reference_file_imports_mineru_images_to_project_materials(client, app):
    project_id = _create_project(client)

    upload_folder = Path(app.config["UPLOAD_FOLDER"])
    source_image = upload_folder / "mineru_files" / "extract123" / "images" / "chart-abcdef.png"
    _write_test_image(source_image)

    markdown = "正文\n![政策截图](/files/mineru/extract123/images/chart-abcdef.png)\n"
    with app.app_context():
        reference_file = ReferenceFile(
            filename="report.pdf",
            file_path="reference_files/report.pdf",
            file_size=123,
            file_type="pdf",
            parse_status="completed",
            markdown_content=markdown,
        )
        db.session.add(reference_file)
        db.session.commit()
        file_id = reference_file.id

    response = client.post(f"/api/reference-files/{file_id}/associate", json={"project_id": project_id})
    assert_success_response(response)

    materials_response = client.get(f"/api/projects/{project_id}/materials")
    data = assert_success_response(materials_response)
    materials = data["data"]["materials"]
    assert len(materials) == 1
    assert materials[0]["caption"] == "政策截图"
    assert materials[0]["original_filename"] == "chart-abcdef.png"
    assert materials[0]["relative_path"].startswith(f"{project_id}/materials/parsed_")
    assert materials[0]["url"].startswith(f"/files/{project_id}/materials/parsed_")
    assert (upload_folder / materials[0]["relative_path"]).is_file()

    duplicate_response = client.post(f"/api/reference-files/{file_id}/associate", json={"project_id": project_id})
    assert_success_response(duplicate_response)
    data = assert_success_response(client.get(f"/api/projects/{project_id}/materials"))
    assert len(data["data"]["materials"]) == 1


def test_import_reference_markdown_images_handles_mineru_prefix_paths(client, app):
    project_id = _create_project(client)

    upload_folder = Path(app.config["UPLOAD_FOLDER"])
    source_image = upload_folder / "mineru_files" / "extract456" / "images" / "very-long-image-name.png"
    _write_test_image(source_image)

    imported_count = import_reference_markdown_images_to_materials(
        project_id=project_id,
        markdown_content="![图表](/files/mineru/extract456/images/very-long-image.png)",
        upload_folder=app.config["UPLOAD_FOLDER"],
    )
    db.session.commit()

    assert imported_count == 1
    data = assert_success_response(client.get(f"/api/projects/{project_id}/materials"))
    assert len(data["data"]["materials"]) == 1
