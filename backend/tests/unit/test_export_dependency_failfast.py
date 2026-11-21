"""Required export dependencies abort the DAG, even while siblings are blocked."""
from concurrent.futures import ThreadPoolExecutor
import json
from pathlib import Path
from threading import Event
import time
from types import SimpleNamespace
from unittest.mock import Mock
from zipfile import ZipFile

import pytest
from PIL import Image

from services.export_control import (
    ExportThreadPoolExecutor, as_completed, check_export, dependency_failed,
    export_scope, export_sleep,
)
from services.export_service import ExportError, ExportService
from services.image_editability.data_models import BBox, EditableElement, EditableImage
from services.image_editability.extractors import ExtractionResult, ExtractorRegistry, MinerUElementExtractor
from services.image_editability.factories import ServiceConfig
from services.image_editability.inpaint_providers import InpaintProviderRegistry, BaiduInpaintProvider
from services.image_editability.service import ImageEditabilityService
from services.image_editability.text_attribute_extractors import TextStyleResult


def image_file(tmp_path, name='page.png'):
    path = tmp_path / name
    Image.new('RGB', (320, 180), 'white').save(path)
    return str(path)


def element(kind='text', image=None, content='Editable text'):
    return EditableElement('element', kind, BBox(10, 10, 100, 40),
                           BBox(10, 10, 100, 40), content=content, image_path=image)


def service_config(tmp_path, extractor=None, inpaint=None, **kwargs):
    extractors = ExtractorRegistry()
    extractors.register_default(extractor or SimpleNamespace(extract=lambda **_: ExtractionResult(
        elements=[{'type': 'text', 'bbox': [10, 10, 100, 40], 'content': 'Editable text'}])))
    providers = InpaintProviderRegistry()
    providers.register_default(inpaint or SimpleNamespace(inpaint_regions=lambda **_: Image.new('RGB', (320, 180), 'white')))
    return ServiceConfig(tmp_path, extractors, providers, **kwargs)


class Styles:
    def extract_batch_with_full_image(self, full_image, text_elements):
        return {item['element_id']: TextStyleResult(confidence=.9) for item in text_elements}

    def extract(self, image, text_content):
        return TextStyleResult(confidence=.9)


def test_failure_returns_before_blocked_sibling_and_never_runs_queue():
    started, release, finished = Event(), Event(), Event()
    queued = Mock()

    def slow():
        started.set()
        assert release.wait(5)
        return 'late result'

    def fail():
        assert started.wait(2)
        dependency_failed('quota exhausted', 'inpaint')

    def export():
        with export_scope():
            with ExportThreadPoolExecutor(max_workers=2) as pool:
                futures = [pool.submit(slow), pool.submit(fail)]
                # Failure can race submission; either way queued work must not run.
                futures.extend(pool.submit(queued) for _ in range(20))
                list(as_completed(futures))

    with ThreadPoolExecutor(max_workers=1) as caller:
        future = caller.submit(export)
        try:
            with pytest.raises(ExportError, match='quota exhausted'):
                future.result(timeout=2)
            assert not release.is_set()
            queued.assert_not_called()
        finally:
            release.set()


def test_hybrid_layout_error_does_not_wait_for_other_provider(tmp_path):
    from services.image_editability.hybrid_extractor import HybridElementExtractor
    started, release = Event(), Event()
    extractor = HybridElementExtractor.__new__(HybridElementExtractor)

    def slow(*args, **kwargs):
        started.set()
        assert release.wait(5)
        return ExtractionResult(elements=[])

    def fail(*args, **kwargs):
        assert started.wait(2)
        return ExtractionResult(elements=[], error='Baidu API error [17]: daily limit')

    extractor._mineru_extractor = SimpleNamespace(extract=slow)
    extractor._baidu_ocr_extractor = SimpleNamespace(extract=fail)

    def export():
        with export_scope():
            return extractor.extract(image_file(tmp_path))

    with ThreadPoolExecutor(max_workers=1) as caller:
        future = caller.submit(export)
        try:
            with pytest.raises(ExportError) as exc:
                future.result(timeout=2)
            assert exc.value.error_code == 'EXPORT_QUOTA_EXHAUSTED'
        finally:
            release.set()


def test_style_failure_aborts_while_global_request_is_blocked(tmp_path):
    started, release = Event(), Event()
    path = image_file(tmp_path)
    slide = EditableImage('page', path, 320, 180, [element(image=path)], path)

    class FailedLocal(Styles):
        def extract_batch_with_full_image(self, **kwargs):
            started.set()
            assert release.wait(5)
            return super().extract_batch_with_full_image(**kwargs)

        def extract(self, **kwargs):
            assert started.wait(2)
            return TextStyleResult(confidence=0, metadata={'error': 'daily quota exhausted'})

    with ThreadPoolExecutor(max_workers=1) as caller:
        future = caller.submit(ExportService.create_editable_pptx_with_recursive_analysis,
                               editable_images=[slide], text_attribute_extractor=FailedLocal(),
                               output_file=str(tmp_path / 'bad.pptx'))
        try:
            with pytest.raises(ExportError):
                future.result(timeout=2)
            assert not (tmp_path / 'bad.pptx').exists()
        finally:
            release.set()


@pytest.mark.parametrize('code', [17, 19, 110, 111])
def test_baidu_permanent_error_is_not_retried(tmp_path, monkeypatch, code):
    from services.ai_providers.image.baidu_inpainting_provider import BaiduInpaintingProvider
    response = Mock()
    response.json.return_value = {'error_code': code, 'error_msg': 'upstream failure'}
    post = Mock(return_value=response)
    monkeypatch.setattr('services.ai_providers.image.baidu_inpainting_provider.requests.post', post)
    low_level = BaiduInpaintingProvider('test-token')
    wrapper = BaiduInpaintProvider(low_level)
    service = ImageEditabilityService(service_config(tmp_path, inpaint=wrapper))
    with export_scope(), pytest.raises(ExportError):
        service.make_image_editable(image_file(tmp_path))
    assert post.call_count == 1


def test_cancelled_retry_never_sends_another_request(tmp_path, monkeypatch):
    from services.ai_providers.image.baidu_inpainting_provider import BaiduInpaintingProvider
    from requests.exceptions import Timeout
    sleeping = Event()
    provider = BaiduInpaintingProvider('test-token')
    post = Mock(side_effect=Timeout('network timeout'))
    monkeypatch.setattr('services.ai_providers.image.baidu_inpainting_provider.requests.post', post)

    def sleep(seconds):
        sleeping.set()
        export_sleep(30)

    monkeypatch.setattr(provider.inpaint.retry, 'sleep', sleep)
    with export_scope() as control:
        with ExportThreadPoolExecutor(max_workers=1) as pool:
            future = pool.submit(provider.inpaint, Image.new('RGB', (50, 50)),
                                 [{'left': 0, 'top': 0, 'width': 10, 'height': 10}])
            assert sleeping.wait(2)
            control.fail(ExportError('other required node failed'))
            with pytest.raises(ExportError):
                future.result(timeout=2)
    assert post.call_count == 1


@pytest.mark.parametrize('content', [None, 'invalid-json'])
def test_missing_or_corrupt_mineru_result_is_fatal(tmp_path, content):
    if content is not None:
        (tmp_path / 'layout.json').write_text(content)
        (tmp_path / 'page_content_list.json').write_text('[]')
    extractor = MinerUElementExtractor.__new__(MinerUElementExtractor)
    with export_scope(), pytest.raises(ExportError, match='MinerU'):
        extractor._extract_from_result(str(tmp_path), (320, 180), 0)


@pytest.mark.parametrize('failure', ['empty_background', 'crop_failure', 'recursive_error'])
def test_analysis_failure_never_produces_success(tmp_path, monkeypatch, failure):
    config = service_config(tmp_path, max_depth=2, min_image_size=1, min_image_area=1)
    if failure == 'empty_background':
        config.inpaint_registry.register_default(SimpleNamespace(inpaint_regions=lambda **_: None))
    elif failure == 'crop_failure':
        config.extractor_registry.register_default(SimpleNamespace(extract=lambda **_: ExtractionResult(
            elements=[{'type': 'text', 'bbox': [500, 500, 600, 600], 'content': 'missing'}])))
    else:
        def extract(**kwargs):
            if kwargs.get('depth'):
                return ExtractionResult(elements=[], error='nested OCR failed')
            return ExtractionResult(elements=[{'type': 'image', 'bbox': [10, 10, 100, 90]}])
        config.extractor_registry.register_default(SimpleNamespace(extract=extract))
    with export_scope(), pytest.raises(ExportError):
        ImageEditabilityService(config).make_image_editable(image_file(tmp_path))


@pytest.mark.parametrize('failure', ['missing_image', 'corrupt_image', 'missing_background', 'corrupt_background', 'formula', 'unknown'])
def test_invalid_render_dependency_does_not_publish_pptx(tmp_path, monkeypatch, failure):
    from utils.pptx_builder import PPTXBuilder
    source = image_file(tmp_path)
    broken = tmp_path / 'broken.png'
    broken.write_bytes(b'not an image')
    elem = element(image=source)
    background = source
    if failure in ('missing_image', 'corrupt_image'):
        elem = element('image', str(broken) if failure == 'corrupt_image' else str(tmp_path / 'missing.png'))
    elif failure in ('missing_background', 'corrupt_background'):
        background = str(broken) if failure == 'corrupt_background' else str(tmp_path / 'missing.png')
    elif failure == 'formula':
        elem.content = r'\frac{x}{y}'
        monkeypatch.setattr(PPTXBuilder, 'add_math_element', lambda *a, **kw: False)
    else:
        elem.element_type = 'unsupported'
    slide = EditableImage('page', source, 320, 180, [elem], background)
    output = tmp_path / 'export.pptx'
    with pytest.raises(ExportError):
        ExportService.create_editable_pptx_with_recursive_analysis(editable_images=[slide], output_file=str(output))
    assert not output.exists()


def test_legacy_style_extractor_error_is_required(tmp_path):
    path = image_file(tmp_path)
    slide = EditableImage('page', path, 320, 180, [element(image=path)], path)
    extractor = SimpleNamespace(extract=lambda **_: None)
    with pytest.raises(ExportError):
        ExportService.create_editable_pptx_with_recursive_analysis(
            editable_images=[slide], text_attribute_extractor=extractor,
            output_file=str(tmp_path / 'bad.pptx'))


def test_successful_full_pipeline_writes_editable_text(tmp_path, monkeypatch):
    config = service_config(tmp_path)
    config.inpaint_registry.register_default(SimpleNamespace(
        inpaint_regions=lambda **_: Image.new('RGB', (320, 180), '#f0f0f0')))
    monkeypatch.setattr(ServiceConfig, 'from_defaults', lambda **_: config)
    output = tmp_path / 'success.pptx'
    _, warnings = ExportService.create_editable_pptx_with_recursive_analysis(
        image_paths=[image_file(tmp_path)], text_attribute_extractor=Styles(), output_file=str(output))
    assert not warnings.has_warnings()
    with ZipFile(output) as pptx:
        xml = pptx.read('ppt/slides/slide1.xml').decode()
        assert '<a:t>Editable text</a:t>' in xml
    assert not list(tmp_path.glob('*.tmp'))


@pytest.mark.parametrize('strict', [True, False])
def test_unchanged_inpaint_background_never_gets_editable_overlay(tmp_path, monkeypatch, strict):
    config = service_config(tmp_path, inpaint=SimpleNamespace(inpaint_regions=lambda image, **_: image.copy()))
    monkeypatch.setattr(ServiceConfig, 'from_defaults', lambda **_: config)
    source = image_file(tmp_path)
    output = tmp_path / 'unchanged.pptx'
    options = dict(image_paths=[source], output_file=str(output), fail_fast=strict)
    if strict:
        with pytest.raises(ExportError, match='背景修复返回原图'):
            ExportService.create_editable_pptx_with_recursive_analysis(**options)
        assert not output.exists()
    else:
        _, warnings = ExportService.create_editable_pptx_with_recursive_analysis(**options)
        with ZipFile(output) as deck:
            assert deck.read('ppt/media/image1.png') == Path(source).read_bytes()
            assert b'<a:t>' not in deck.read('ppt/slides/slide1.xml')
        assert any('已保留原图' in warning for warning in warnings.to_summary())


def test_required_config_does_not_switch_provider(app, tmp_path, monkeypatch):
    from services.image_editability.factories import InpaintProviderFactory
    fallback = Mock()
    monkeypatch.setattr(InpaintProviderFactory, 'create_baidu_inpaint_provider', lambda: None)
    monkeypatch.setattr(InpaintProviderFactory, 'create_generative_edit_provider', fallback)
    with app.app_context(), export_scope(), pytest.raises(ExportError):
        ServiceConfig.from_defaults(mineru_token='test', upload_folder=str(tmp_path),
                                    extractor_method='mineru', inpaint_method='baidu')
    fallback.assert_not_called()


def test_failure_is_scoped_to_one_export():
    failed, proceed = Event(), Event()

    def bad_export():
        with export_scope():
            try:
                dependency_failed('one export failed', 'inpaint')
            finally:
                failed.set()
                assert proceed.wait(2)

    with ThreadPoolExecutor(max_workers=1) as caller:
        future = caller.submit(bad_export)
        try:
            assert failed.wait(2)
            with export_scope():
                check_export()  # a different request remains healthy
        finally:
            proceed.set()
        with pytest.raises(ExportError):
            future.result(timeout=2)


def test_explicit_partial_export_still_allows_image_placeholder(tmp_path):
    path = image_file(tmp_path)
    slide = EditableImage('page', path, 320, 180, [element('image', str(tmp_path / 'missing.png'))], path)
    output = tmp_path / 'partial.pptx'
    ExportService.create_editable_pptx_with_recursive_analysis(
        editable_images=[slide], output_file=str(output), fail_fast=False)
    assert ZipFile(output).testzip() is None


def test_task_api_fails_before_sibling_returns_and_has_no_download(app, db_session, tmp_path, monkeypatch):
    from models import ExportRun, Page, Project, Task, db
    from export_runtime.process import WorkerFailed
    from services.task_manager import export_editable_pptx_with_recursive_analysis_task
    started, release, slow_done = Event(), Event(), Event()
    paths = [image_file(tmp_path, f'{i}.png') for i in range(2)]
    project = Project(creation_type='idea', idea_prompt='fail-fast acceptance')
    db.session.add(project)
    db.session.flush()
    for i, path in enumerate(paths):
        db.session.add(Page(project_id=project.id, order_index=i, generated_image_path=path))
    task = Task(project_id=project.id, task_type='EXPORT_EDITABLE_PPTX', status='PENDING')
    db.session.add(task)
    db.session.commit()
    project_id, task_id = project.id, task.id
    artifact = f'editable-run-{task_id}-failed.pptx'
    db.session.add(ExportRun(task_id=task_id, project_id=project_id,
        request_json=json.dumps({'pages': [{'id': str(index), 'path': path} for index, path in enumerate(paths)],
                                 'options': {'export_mode': 'full'}}),
        request_hash='fixture', artifact_filename=artifact, queue_deadline_at=time.time() + 30))
    db.session.commit()

    def extract(image_path, **_):
        if image_path == paths[0]:
            started.set()
            assert release.wait(5)
            slow_done.set()
            return ExtractionResult(elements=[])
        assert started.wait(2)
        return ExtractionResult(elements=[], error='Baidu API error [17]: daily request limit reached')

    config = service_config(tmp_path, extractor=SimpleNamespace(extract=extract))
    monkeypatch.setattr(ServiceConfig, 'from_defaults', lambda **_: config)

    def worker(payload, on_event, is_active):
        on_event({'event': 'running'})
        try:
            ExportService.create_editable_pptx_with_recursive_analysis(
                image_paths=[page['path'] for page in payload['pages']], max_workers=2,
                output_file=str(Path(payload['workspace']) / 'result.pptx'))
        except ExportError as exc:
            raise WorkerFailed({'message': str(exc), 'details': exc.to_dict()}) from exc

    monkeypatch.setattr('export_runtime.process.supervise', worker)
    with ThreadPoolExecutor(max_workers=1) as caller:
        future = caller.submit(export_editable_pptx_with_recursive_analysis_task, task_id=task_id, app=app)
        try:
            future.result(timeout=2)
            assert not slow_done.is_set()
            db.session.expire_all()
            with app.test_client() as client:
                result = client.get(f'/api/projects/{project_id}/tasks/{task_id}').get_json()['data']
            assert result['status'] == 'FAILED'
            assert result['progress']['error_code'] == 'EXPORT_QUOTA_EXHAUSTED'
            assert not result['progress'].get('download_url')
        finally:
            release.set()
    assert slow_done.wait(2)
    db.session.expire_all()
    assert db.session.get(Task, task_id).status == 'FAILED'
    assert not (Path(app.config['UPLOAD_FOLDER']) / project_id / 'exports' / artifact).exists()


def test_watchdog_discards_late_file_and_preserves_failure(app, db_session, tmp_path, monkeypatch):
    from models import ExportRun, Page, Project, Task, db
    from export_runtime.checkpoints import file_hash
    from pptx import Presentation
    from services.task_manager import export_editable_pptx_with_recursive_analysis_task
    from services.task_watchdog import mark_task_failed
    path = image_file(tmp_path)
    project = Project(creation_type='idea', idea_prompt='late result')
    db.session.add(project)
    db.session.flush()
    db.session.add(Page(project_id=project.id, order_index=0, generated_image_path=path))
    task = Task(project_id=project.id, task_type='EXPORT_EDITABLE_PPTX', status='PENDING')
    db.session.add(task)
    db.session.commit()
    task_id = task.id
    artifact = f'editable-run-{task_id}-late.pptx'
    db.session.add(ExportRun(task_id=task_id, project_id=project.id,
        request_json=json.dumps({'pages': [{'id': 'page', 'path': path}], 'options': {'export_mode': 'full'}}),
        request_hash='fixture', artifact_filename=artifact, queue_deadline_at=time.time() + 30))
    db.session.commit()

    def late_export(payload, on_event, is_active):
        on_event({'event': 'running'})
        mark_task_failed(db.session.get(Task, task_id), error_code='TASK_STALLED', message='stalled')
        deck = Presentation()
        deck.slides.add_slide(deck.slide_layouts[6])
        output = Path(payload['workspace']) / 'result.pptx'
        deck.save(output)
        return {'path': str(output), 'sha256': file_hash(output), 'pages': 1,
                'warnings': [], 'warning_details': {}, 'reused_nodes': 0}

    monkeypatch.setattr('export_runtime.process.supervise', late_export)
    export_editable_pptx_with_recursive_analysis_task(task_id=task_id, app=app)
    db.session.expire_all()
    stored = db.session.get(Task, task_id)
    assert stored.status == 'FAILED'
    assert stored.error_message == 'stalled'
    assert 'download_url' not in stored.get_progress()
    assert not (Path(app.config['UPLOAD_FOLDER']) / project.id / 'exports' / artifact).exists()


def test_missing_source_page_does_not_export_remaining_pages(app, db_session, tmp_path, monkeypatch):
    from models import Page, Project, Task, db
    project = Project(creation_type='idea', idea_prompt='missing source')
    db.session.add(project)
    db.session.flush()
    directory = Path(app.config['UPLOAD_FOLDER']) / project.id / 'pages'
    directory.mkdir(parents=True)
    image_file(directory)
    for index, filename in enumerate(['page.png', 'missing.png']):
        db.session.add(Page(project_id=project.id, order_index=index,
                            generated_image_path=f'{project.id}/pages/{filename}'))
    db.session.commit()
    submit = Mock()
    monkeypatch.setattr('services.task_manager.task_manager.submit_task', submit)
    with app.test_client() as client:
        response = client.post(f'/api/projects/{project.id}/export/editable-pptx', json={})
    assert response.status_code == 400, response.json
    assert 'page image is missing' in response.json['error']['message']
    assert Task.query.filter_by(project_id=project.id).count() == 0
    submit.assert_not_called()
