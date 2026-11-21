"""
Tests for importing parsed reference-file images into project materials.
"""
from pathlib import Path
from urllib.parse import quote

from PIL import Image

from conftest import assert_success_response
from models import ReferenceFile, db
from services.material_import_service import (
    _resolve_local_mineru_image,
    import_reference_markdown_images_to_materials,
)


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


def test_associate_imports_if_parsing_completes_during_refresh(client, app, monkeypatch):
    project_id = _create_project(client)

    upload_folder = Path(app.config["UPLOAD_FOLDER"])
    source_image = upload_folder / "mineru_files" / "race123" / "images" / "chart.png"
    _write_test_image(source_image)

    markdown = "正文\n![刷新后完成](/files/mineru/race123/images/chart.png)\n"
    with app.app_context():
        reference_file = ReferenceFile(
            filename="race.pdf",
            file_path="reference_files/race.pdf",
            file_size=456,
            file_type="pdf",
            parse_status="parsing",
            markdown_content=None,
        )
        db.session.add(reference_file)
        db.session.commit()
        file_id = reference_file.id

    original_refresh = db.session.refresh

    def refresh_with_completed_parse(instance, *args, **kwargs):
        original_refresh(instance, *args, **kwargs)
        if isinstance(instance, ReferenceFile) and instance.id == file_id:
            instance.parse_status = "completed"
            instance.markdown_content = markdown

    monkeypatch.setattr(db.session, "refresh", refresh_with_completed_parse)

    response = client.post(f"/api/reference-files/{file_id}/associate", json={"project_id": project_id})
    assert_success_response(response)

    data = assert_success_response(client.get(f"/api/projects/{project_id}/materials"))
    materials = data["data"]["materials"]
    assert len(materials) == 1
    assert materials[0]["caption"] == "刷新后完成"


def test_associate_succeeds_if_material_import_fails(client, app, monkeypatch):
    project_id = _create_project(client)

    with app.app_context():
        reference_file = ReferenceFile(
            filename="report.pdf",
            file_path="reference_files/report.pdf",
            file_size=123,
            file_type="pdf",
            parse_status="completed",
            markdown_content="![图](/files/mineru/extract/images/missing.png)",
        )
        db.session.add(reference_file)
        db.session.commit()
        file_id = reference_file.id

    def fail_import(*args, **kwargs):
        raise RuntimeError("import failed")

    monkeypatch.setattr(
        "controllers.reference_file_controller.import_reference_markdown_images_to_materials",
        fail_import,
    )

    response = client.post(f"/api/reference-files/{file_id}/associate", json={"project_id": project_id})
    assert_success_response(response)

    with app.app_context():
        reference_file = ReferenceFile.query.get(file_id)
        assert reference_file.project_id == project_id


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

def test_import_reference_markdown_images_deduplicates_repeated_urls(client, app):
    project_id = _create_project(client)

    upload_folder = Path(app.config["UPLOAD_FOLDER"])
    source_image = upload_folder / "mineru_files" / "extract789" / "images" / "chart.png"
    _write_test_image(source_image)

    imported_count = import_reference_markdown_images_to_materials(
        project_id=project_id,
        markdown_content="\n".join([
            "![图表](/files/mineru/extract789/images/chart.png)",
            "![图表](/files/mineru/extract789/images/chart.png)",
        ]),
        upload_folder=app.config["UPLOAD_FOLDER"],
    )
    db.session.commit()

    assert imported_count == 1
    data = assert_success_response(client.get(f"/api/projects/{project_id}/materials"))
    assert len(data["data"]["materials"]) == 1


def test_import_reference_markdown_images_deduplicates_per_project(client, app):
    first_project_id = _create_project(client)
    second_project_id = _create_project(client)

    upload_folder = Path(app.config["UPLOAD_FOLDER"])
    source_image = upload_folder / "mineru_files" / "extract_shared" / "images" / "chart.png"
    _write_test_image(source_image)
    markdown = "![共享图](/files/mineru/extract_shared/images/chart.png)"

    first_count = import_reference_markdown_images_to_materials(
        project_id=first_project_id,
        markdown_content=markdown,
        upload_folder=app.config["UPLOAD_FOLDER"],
    )
    second_count = import_reference_markdown_images_to_materials(
        project_id=second_project_id,
        markdown_content=markdown,
        upload_folder=app.config["UPLOAD_FOLDER"],
    )
    db.session.commit()

    assert first_count == 1
    assert second_count == 1

    first_data = assert_success_response(client.get(f"/api/projects/{first_project_id}/materials"))
    second_data = assert_success_response(client.get(f"/api/projects/{second_project_id}/materials"))
    first_material = first_data["data"]["materials"][0]
    second_material = second_data["data"]["materials"][0]

    assert len(first_data["data"]["materials"]) == 1
    assert len(second_data["data"]["materials"]) == 1
    assert first_material["filename"] != second_material["filename"]
    assert first_material["relative_path"].startswith(f"{first_project_id}/materials/")
    assert second_material["relative_path"].startswith(f"{second_project_id}/materials/")


def test_import_reference_markdown_images_handles_parentheses_in_urls(client, app):
    project_id = _create_project(client)

    upload_folder = Path(app.config["UPLOAD_FOLDER"])
    source_image = upload_folder / "mineru_files" / "extract_parens" / "images" / "chart (1).png"
    _write_test_image(source_image)

    imported_count = import_reference_markdown_images_to_materials(
        project_id=project_id,
        markdown_content="![括号图](/files/mineru/extract_parens/images/chart (1).png)",
        upload_folder=app.config["UPLOAD_FOLDER"],
    )
    db.session.commit()

    assert imported_count == 1
    data = assert_success_response(client.get(f"/api/projects/{project_id}/materials"))
    material = data["data"]["materials"][0]
    assert material["caption"] == "括号图"
    assert material["original_filename"] == "chart (1).png"


def test_import_reference_markdown_images_strips_caption_html(client, app):
    project_id = _create_project(client)

    upload_folder = Path(app.config["UPLOAD_FOLDER"])
    source_image = upload_folder / "mineru_files" / "extract_html" / "images" / "chart.png"
    _write_test_image(source_image)

    imported_count = import_reference_markdown_images_to_materials(
        project_id=project_id,
        markdown_content="![Chart <img src=x onerror=alert(1)>](/files/mineru/extract_html/images/chart.png)",
        upload_folder=app.config["UPLOAD_FOLDER"],
    )
    db.session.commit()

    assert imported_count == 1
    data = assert_success_response(client.get(f"/api/projects/{project_id}/materials"))
    material = data["data"]["materials"][0]
    assert material["caption"] == "Chart "


def test_import_reference_markdown_images_decodes_urls_and_truncates_caption(client, app):
    project_id = _create_project(client)

    upload_folder = Path(app.config["UPLOAD_FOLDER"])
    source_image = upload_folder / "mineru_files" / "extract_cn" / "images" / "图 表.png"
    _write_test_image(source_image)

    encoded_url = quote("/files/mineru/extract_cn/images/图 表.png", safe="/")
    long_caption = "图" * 600
    imported_count = import_reference_markdown_images_to_materials(
        project_id=project_id,
        markdown_content=f"![{long_caption}]({encoded_url})",
        upload_folder=app.config["UPLOAD_FOLDER"],
    )
    db.session.commit()

    assert imported_count == 1
    data = assert_success_response(client.get(f"/api/projects/{project_id}/materials"))
    material = data["data"]["materials"][0]
    assert material["original_filename"] == "图 表.png"
    assert material["caption"] == "图" * 500


def test_import_reference_markdown_images_strips_query_and_fragment(client, app):
    project_id = _create_project(client)

    upload_folder = Path(app.config["UPLOAD_FOLDER"])
    source_image = upload_folder / "mineru_files" / "extract_query" / "images" / "chart.png"
    _write_test_image(source_image)

    imported_count = import_reference_markdown_images_to_materials(
        project_id=project_id,
        markdown_content="![图表](/files/mineru/extract_query/images/chart.png?v=1#page)",
        upload_folder=app.config["UPLOAD_FOLDER"],
    )
    db.session.commit()

    assert imported_count == 1
    data = assert_success_response(client.get(f"/api/projects/{project_id}/materials"))
    assert len(data["data"]["materials"]) == 1

    duplicate_count = import_reference_markdown_images_to_materials(
        project_id=project_id,
        markdown_content="\n".join([
            "![图表](/files/mineru/extract_query/images/chart.png?v=2)",
            "![图表](/files/mineru/extract_query/images/chart.png#another-page)",
        ]),
        upload_folder=app.config["UPLOAD_FOLDER"],
    )
    db.session.commit()

    assert duplicate_count == 0
    data = assert_success_response(client.get(f"/api/projects/{project_id}/materials"))
    assert len(data["data"]["materials"]) == 1


def test_resolve_local_mineru_image_rejects_traversal(app):
    upload_folder = Path(app.config["UPLOAD_FOLDER"])

    assert _resolve_local_mineru_image("/files/mineru/../secret.png", upload_folder) is None
    assert _resolve_local_mineru_image("/files/mineru/extract/../../secret.png", upload_folder) is None


def test_import_reference_markdown_images_rejects_encoded_traversal(client, app):
    project_id = _create_project(client)

    imported_count = import_reference_markdown_images_to_materials(
        project_id=project_id,
        markdown_content="![bad](/files/mineru/%2e%2e/secret.png)",
        upload_folder=app.config["UPLOAD_FOLDER"],
    )

    assert imported_count == 0


def test_resolve_local_mineru_image_returns_none_when_parent_missing(app):
    upload_folder = Path(app.config["UPLOAD_FOLDER"])

    assert _resolve_local_mineru_image("/files/mineru/missing/images/chart.png", upload_folder) is None
