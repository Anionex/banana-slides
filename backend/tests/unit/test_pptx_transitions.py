import io
import zipfile

from PIL import Image

from services.export_service import ExportService


def _make_image(path, color):
    image = Image.new('RGB', (320, 180), color)
    image.save(path, format='JPEG')


def _slide_xml_nodes(pptx_bytes):
    with zipfile.ZipFile(io.BytesIO(pptx_bytes)) as pptx_zip:
        slide_names = sorted(
            [name for name in pptx_zip.namelist() if name.startswith('ppt/slides/slide') and name.endswith('.xml')],
            key=lambda name: int(name.removeprefix('ppt/slides/slide').removesuffix('.xml')),
        )
        return [pptx_zip.read(name).decode('utf-8') for name in slide_names]


def test_create_pptx_from_images_adds_selected_transition_effects(tmp_path):
    image_paths = []
    effects = ['fade', 'page_turn', 'push', 'wipe', 'split', 'blinds', 'checker', 'wheel']
    colors = ['red', 'green', 'blue', 'yellow', 'purple', 'orange', 'cyan', 'magenta']
    for index, color in enumerate(colors, start=1):
        path = tmp_path / f'slide-{index}.jpg'
        _make_image(path, color)
        image_paths.append(str(path))

    pptx_bytes = ExportService.create_pptx_from_images(
        image_paths,
        transition_effects=effects,
    )

    slide_xml = _slide_xml_nodes(pptx_bytes)

    assert all('<p:transition' in xml for xml in slide_xml)
    assert all(
        any(
            tag in xml
            for tag in ('<p:fade', '<p:cover', '<p:push', '<p:wipe', '<p:split', '<p:blinds', '<p:checker', '<p:wheel')
        )
        for xml in slide_xml
    )
    joined_xml = ''.join(slide_xml)
    assert '<p:fade' in joined_xml
    assert '<p:cover' in joined_xml
    assert '<p:push' in joined_xml
    assert '<p:wipe' in joined_xml
    assert '<p:split' in joined_xml
    assert '<p:blinds' in joined_xml
    assert '<p:checker' in joined_xml
    assert '<p:wheel' in joined_xml


def test_create_pptx_from_images_maps_page_turn_to_cover(tmp_path):
    path = tmp_path / 'slide.jpg'
    _make_image(path, 'red')

    pptx_bytes = ExportService.create_pptx_from_images(
        [str(path)],
        transition_effects=['page_turn'],
    )

    with zipfile.ZipFile(io.BytesIO(pptx_bytes)) as pptx_zip:
        slide_xml = pptx_zip.read('ppt/slides/slide1.xml').decode('utf-8')

    assert '<p:cover' in slide_xml
    assert '<p:pageCurl' not in slide_xml


def test_create_pptx_from_images_omits_transition_when_disabled(tmp_path):
    path = tmp_path / 'slide.jpg'
    _make_image(path, 'red')

    pptx_bytes = ExportService.create_pptx_from_images([str(path)])

    with zipfile.ZipFile(io.BytesIO(pptx_bytes)) as pptx_zip:
        slide_xml = pptx_zip.read('ppt/slides/slide1.xml').decode('utf-8')

    assert '<p:transition' not in slide_xml
