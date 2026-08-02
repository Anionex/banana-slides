import os

from PIL import Image

from utils.path_utils import convert_mineru_path_to_local, find_mineru_file_with_prefix


def _save_image(path):
    path.parent.mkdir(parents=True, exist_ok=True)
    Image.new("RGB", (4, 4), color="red").save(path)


def test_convert_mineru_path_blocks_traversal(tmp_path):
    assert convert_mineru_path_to_local(
        "/files/mineru/../../outside.png",
        project_root=tmp_path,
    ) is None


def test_find_mineru_file_allows_valid_file(tmp_path):
    image_path = tmp_path / "uploads" / "mineru_files" / "extract" / "image.png"
    _save_image(image_path)

    assert find_mineru_file_with_prefix(
        "/files/mineru/extract/image.png",
        project_root=tmp_path,
    ) == image_path


def test_find_mineru_file_uses_explicit_upload_folder(tmp_path):
    upload_folder = tmp_path / "desktop" / "uploads"
    image_path = upload_folder / "mineru_files" / "extract" / "image.png"
    _save_image(image_path)

    assert find_mineru_file_with_prefix(
        "/files/mineru/extract/image.png",
        upload_folder=upload_folder,
    ) == image_path


def test_convert_mineru_path_uses_upload_folder_env(tmp_path, monkeypatch):
    upload_folder = tmp_path / "env" / "uploads"
    monkeypatch.setenv("UPLOAD_FOLDER", str(upload_folder))

    assert convert_mineru_path_to_local(
        "/files/mineru/extract/image.png",
    ) == upload_folder / "mineru_files" / "extract" / "image.png"


def test_convert_mineru_path_strips_leading_slashes(tmp_path):
    expected_path = tmp_path / "uploads" / "mineru_files" / "extract" / "image.png"

    assert convert_mineru_path_to_local(
        "/files/mineru//extract/image.png",
        project_root=tmp_path,
    ) == expected_path


def test_find_mineru_file_blocks_symlink_escape(tmp_path):
    outside_image = tmp_path / "outside" / "flag.png"
    symlink_path = tmp_path / "uploads" / "mineru_files" / "extract" / "linked.png"
    _save_image(outside_image)
    symlink_path.parent.mkdir(parents=True, exist_ok=True)

    try:
        os.symlink(outside_image, symlink_path)
    except (OSError, NotImplementedError):
        return

    assert find_mineru_file_with_prefix(
        "/files/mineru/extract/linked.png",
        project_root=tmp_path,
    ) is None
