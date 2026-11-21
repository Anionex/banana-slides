from types import SimpleNamespace
from unittest.mock import Mock

from PIL import Image
import pytest

from export_runtime.checkpoints import CheckpointStore
from export_runtime.control import ExportControl, RemoteJobFailed
from services.ai_providers.image.openai_provider import OpenAIImageProvider
from services.file_parser_service import FileParserService


def test_async_image_job_resumes_polling_without_resubmitting(tmp_path):
    provider = OpenAIImageProvider.__new__(OpenAIImageProvider)
    provider.api_base = 'http://fixture/v1'
    submit = Mock(return_value=SimpleNamespace(json=lambda: {'data': [{'task_id': 'job-1'}]}))
    provider.client = SimpleNamespace(images=SimpleNamespace(with_raw_response=SimpleNamespace(generate=submit)))
    provider._poll_image_task = Mock(side_effect=[TimeoutError('poll interrupted'), Image.new('RGB', (8, 8))])
    first = CheckpointStore(tmp_path / 'first')
    with ExportControl(tmp_path / 'locks', store=first).bind(), pytest.raises(TimeoutError):
        provider._images_response('generate', {'model': 'image', 'prompt': 'erase'})
    second = CheckpointStore(tmp_path / 'second', ancestors=[first.root])
    with ExportControl(tmp_path / 'locks', store=second).bind():
        assert provider._images_response('generate', {'model': 'image', 'prompt': 'erase'}).size == (8, 8)
    assert submit.call_count == 1
    assert [call.args[0] for call in provider._poll_image_task.call_args_list] == ['job-1', 'job-1']


def test_mineru_resume_preserves_job_and_upload_and_skips_irrelevant_captions(tmp_path):
    source = tmp_path / 'source.pdf'
    source.write_bytes(b'fixture PDF')
    service = FileParserService(mineru_token='fixture')
    service._get_upload_url = Mock(return_value=('batch-1', 'http://fixture/upload', None))
    service._upload_file = Mock(return_value=None)
    service._poll_result = Mock(side_effect=[TimeoutError('poll interrupted'), ('markdown', 'extract-1', None)])
    service._can_generate_captions = Mock(side_effect=AssertionError('not required for layout extraction'))
    first = CheckpointStore(tmp_path / 'first')
    # Call the non-retrying adapter to simulate termination at the polling boundary.
    parse = FileParserService.parse_file.__wrapped__
    with ExportControl(tmp_path / 'locks', store=first).bind(), pytest.raises(TimeoutError):
        parse(service, str(source), 'source.pdf', enhance_captions=False)
    second = CheckpointStore(tmp_path / 'second', ancestors=[first.root])
    with ExportControl(tmp_path / 'locks', store=second).bind():
        assert parse(service, str(source), 'renamed.pdf', enhance_captions=False)[2] == 'extract-1'
    assert service._get_upload_url.call_count == service._upload_file.call_count == 1


def test_terminal_remote_failure_is_replaced_only_on_explicit_resume(tmp_path):
    provider = OpenAIImageProvider.__new__(OpenAIImageProvider)
    provider.api_base = 'http://fixture/v1'
    submit = Mock(side_effect=[SimpleNamespace(json=lambda: {'data': [{'task_id': 'failed-job'}]}),
                               SimpleNamespace(json=lambda: {'data': [{'task_id': 'new-job'}]})])
    provider.client = SimpleNamespace(images=SimpleNamespace(with_raw_response=SimpleNamespace(generate=submit)))
    provider._poll_image_task = Mock(side_effect=[RemoteJobFailed('failed upstream'), Image.new('RGB', (8, 8))])
    first = CheckpointStore(tmp_path / 'first')
    from export_runtime.control import request
    def generate():
        return request('image', lambda: provider._images_response('generate', {'model': 'image', 'prompt': 'erase'}))
    with ExportControl(tmp_path / 'locks', store=first).bind(), pytest.raises(RemoteJobFailed):
        generate()
    assert submit.call_count == 1
    with ExportControl(tmp_path / 'locks', store=CheckpointStore(tmp_path / 'second', ancestors=[first.root])).bind():
        generate()
    assert submit.call_count == 2
