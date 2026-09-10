"""导出过程的元素级进度与心跳验证。

客户反馈的"卡在 88% 很久"需要一个能定位到元素、并且能被看门狗感知的进度信号：
* 构建阶段每处理 N 个元素上报一次（页内进度）
* 每个元素/子任务都打一次心跳（不写库）
* 任务进度里写入 heartbeat_at，重启后据此判断任务是否真的还在跑
"""
from datetime import datetime
from pathlib import Path

from PIL import Image

from models import Page, Project, Task, db
from services.export_service import ELEMENT_PROGRESS_INTERVAL, ExportService
from services.image_editability.data_models import BBox, EditableElement, EditableImage
from services.image_editability.text_attribute_extractors import TextStyleResult
from services.task_manager import export_editable_pptx_with_recursive_analysis_task


class StubExtractor:
    """最小可用的样式提取器桩，避免真实模型调用。"""

    def extract_batch_with_full_image(self, full_image, text_elements):
        return {
            element['element_id']: TextStyleResult(is_bold=False, confidence=0.9)
            for element in text_elements
        }

    def extract(self, image, text_content):
        return TextStyleResult(font_color_rgb=(0, 0, 0), confidence=0.9)


def _make_image(path: Path, size=(320, 180)) -> str:
    Image.new('RGB', size, color='white').save(path)
    return str(path)


def _text_element(element_id: str, bbox, content='示例文本 ABC', image_path=None) -> EditableElement:
    return EditableElement(
        element_id=element_id,
        element_type='text',
        bbox=bbox,
        bbox_global=bbox,
        content=content,
        image_path=image_path,
    )


def _build_slide(tmp_path: Path, *, count: int, name: str = 'slide') -> EditableImage:
    raw = _make_image(tmp_path / f'{name}.png')
    clean = _make_image(tmp_path / f'{name}_clean.png')
    elements = []
    for index in range(count):
        col, row = divmod(index, 10)
        x0 = 20 + col * 60
        y0 = 20 + row * 14
        elements.append(_text_element(
            f'{name}-t{index}',
            BBox(x0, y0, x0 + 54, y0 + 12),
            image_path=raw,
        ))
    return EditableImage(
        image_id=name,
        image_path=raw,
        width=320,
        height=180,
        elements=elements,
        clean_background=clean,
    )


def test_add_elements_fires_hook_per_element_including_children(tmp_path):
    raw = _make_image(tmp_path / 'parent.png')
    clean = _make_image(tmp_path / 'parent_clean.png')
    child = _text_element('child-1', BBox(10, 10, 60, 30), image_path=raw)
    nested = EditableElement(
        element_id='group-1',
        element_type='image',
        bbox=BBox(0, 0, 200, 120),
        bbox_global=BBox(0, 0, 200, 120),
        image_path=raw,
        children=[child],
        inpainted_background_path=clean,
    )
    top = _text_element('top-1', BBox(10, 130, 120, 150), image_path=raw)

    calls = []
    builder = __import__('utils.pptx_builder', fromlist=['PPTXBuilder']).PPTXBuilder()
    builder.create_presentation()
    builder.setup_presentation_size(320, 180)
    slide = builder.add_blank_slide()

    ExportService._add_editable_elements_to_slide(
        builder=builder,
        slide=slide,
        elements=[nested, top],
        scale_x=1.0,
        scale_y=1.0,
        depth=0,
        text_styles_cache={},
        warnings=None,
        fail_fast=True,
        on_element=lambda: calls.append(1),
    )

    # 顶层 2 个 + 递归子元素 1 个
    assert len(calls) == 3


def test_build_reports_element_level_progress_and_heartbeat(tmp_path):
    count = ELEMENT_PROGRESS_INTERVAL + 7
    slide = _build_slide(tmp_path, count=count)

    progress = []
    heartbeats = []

    ExportService.create_editable_pptx_with_recursive_analysis(
        editable_images=[slide],
        output_file=str(tmp_path / 'out.pptx'),
        slide_width_pixels=320,
        slide_height_pixels=180,
        text_attribute_extractor=None,
        progress_callback=lambda step, message, percent: progress.append((step, message, percent)),
        heartbeat_callback=lambda step: heartbeats.append(step),
        fail_fast=True,
    )

    element_reports = [(step, message) for step, message, _ in progress if '已处理' in message]
    assert any(
        f'已处理 {ELEMENT_PROGRESS_INTERVAL} 个元素' in message
        for _, message in element_reports
    )
    assert all(step == '构建PPTX' for step, _ in element_reports)
    # 每个元素都打心跳
    assert heartbeats.count('构建PPTX') >= count


def test_style_extraction_reports_progress_per_task(tmp_path):
    element_count = 12
    slide = _build_slide(tmp_path, count=element_count, name='style')
    progress = []
    heartbeats = []

    ExportService.create_editable_pptx_with_recursive_analysis(
        editable_images=[slide],
        output_file=str(tmp_path / 'style.pptx'),
        slide_width_pixels=320,
        slide_height_pixels=180,
        text_attribute_extractor=StubExtractor(),
        progress_callback=lambda step, message, percent: progress.append((step, message, percent)),
        heartbeat_callback=lambda step: heartbeats.append(step),
        fail_fast=True,
    )

    style_messages = [m for step, m, _ in progress if step == '样式提取']
    total_tasks = 1 + element_count  # 1 个全局识别 + N 个单元素识别
    assert len(style_messages) >= 2, '样式提取阶段应多次上报进度'
    assert any(f'（{total_tasks}/{total_tasks}）' in m for m in style_messages)
    assert heartbeats.count('样式提取') >= total_tasks


def test_export_task_writes_heartbeat_into_progress(app, db_session, tmp_path, monkeypatch):
    """任务进度里必须写入 heartbeat_at，重启后的对账依赖它。"""
    image_path = _make_image(tmp_path / 'page.png')

    project = Project(creation_type='idea', idea_prompt='demo')
    db.session.add(project)
    db.session.flush()
    db.session.add(Page(
        project_id=project.id,
        order_index=0,
        generated_image_path='pages/page.png',
    ))
    task = Task(project_id=project.id, task_type='EXPORT_EDITABLE_PPTX', status='PENDING')
    db.session.add(task)
    db.session.commit()
    task_id = task.id

    class FileServiceStub:
        def get_absolute_path(self, _relative_path):
            return image_path

    monkeypatch.setattr(
        'services.image_editability.TextAttributeExtractorFactory.create_caption_model_extractor',
        lambda: StubExtractor(),
    )

    def fake_export(*_args, progress_callback=None, heartbeat_callback=None, **_kwargs):
        progress_callback('构建PPTX', '构建第 1/1 页...', 88)
        heartbeat_callback('构建PPTX')
        return b'pptx-bytes', None

    monkeypatch.setattr(
        ExportService,
        'create_editable_pptx_with_recursive_analysis',
        staticmethod(fake_export),
    )

    export_editable_pptx_with_recursive_analysis_task(
        task_id=task_id,
        project_id=project.id,
        filename='demo.pptx',
        file_service=FileServiceStub(),
        app=app,
    )

    db.session.expire_all()
    stored = Task.query.get(task_id)
    progress = stored.get_progress()
    assert progress['heartbeat_at']
    heartbeat = datetime.fromisoformat(progress['heartbeat_at'])
    assert (datetime.utcnow() - heartbeat).total_seconds() < 60
    assert stored.status == 'COMPLETED'
