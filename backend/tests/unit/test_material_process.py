import io
from unittest.mock import patch

import pytest
from PIL import Image

from conftest import assert_success_response
from services.task_manager import _aspect_ratio_from_size, _blend_region_into_source


def _make_image_bytes(color: str = 'red') -> io.BytesIO:
    img = Image.new('RGB', (120, 90), color=color)
    buffer = io.BytesIO()
    img.save(buffer, format='PNG')
    buffer.seek(0)
    return buffer


@pytest.mark.unit
def test_blend_region_into_source_changes_only_selected_area():
    source = Image.new('RGB', (80, 60), color='red')
    edited = Image.new('RGB', (80, 60), color='blue')

    result = _blend_region_into_source(source, edited, (20, 15, 60, 45), feather_radius=0)

    assert result.getpixel((5, 5)) == (255, 0, 0)
    assert result.getpixel((40, 30)) == (0, 0, 255)


@pytest.mark.unit
def test_aspect_ratio_from_size_maps_to_supported_ratio():
    assert _aspect_ratio_from_size(1706, 1279) == '4:3'
    assert _aspect_ratio_from_size(2048, 2048) == '1:1'
    assert _aspect_ratio_from_size(1920, 1080) == '16:9'


@pytest.mark.unit
def test_process_material_requires_source_for_region_edit(client, sample_project):
    project_id = sample_project['project_id']

    response = client.post(
        f'/api/projects/{project_id}/materials/process',
        data={
            'operation': 'region_edit',
            'prompt': 'make it glossy',
            'selection': '{"x": 10, "y": 10, "width": 20, "height": 20, "image_width": 120, "image_height": 90}',
        },
        content_type='multipart/form-data',
    )

    assert response.status_code == 400


@pytest.mark.unit
@patch('controllers.material_controller.get_ai_service')
@patch('controllers.material_controller.task_manager.submit_task')
def test_process_material_region_edit_enqueues_task(mock_submit_task, mock_get_ai_service, client, sample_project):
    project_id = sample_project['project_id']
    mock_get_ai_service.return_value = object()

    response = client.post(
        f'/api/projects/{project_id}/materials/process',
        data={
            'operation': 'region_edit',
            'prompt': 'change the button to glass',
            'apply_mode': 'overlay_selection',
            'selection': '{"x": 10, "y": 12, "width": 40, "height": 30, "image_width": 120, "image_height": 90}',
            'source_image': (_make_image_bytes('green'), 'source.png'),
            'ref_image': (_make_image_bytes('blue'), 'ref.png'),
        },
        content_type='multipart/form-data',
    )

    data = assert_success_response(response, 202)
    assert data['data']['status'] == 'PENDING'
    assert mock_submit_task.called

    submit_args = mock_submit_task.call_args[0]
    assert submit_args[2] == project_id
    assert submit_args[3] == 'region_edit'
    assert submit_args[4] == 'change the button to glass'
