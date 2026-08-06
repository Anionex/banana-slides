from pathlib import Path

from PIL import Image

from services.visual_design_service import (
    ARCHETYPES,
    bounded_repair_ids,
    ensure_project_design_spec,
    ordered_generation_references,
    review_local_consistency,
    structured_prompt_block,
)


class ProjectStub:
    generation_mode = 'STRUCTURED_VISUAL'
    project_title = '季度复盘'
    idea_prompt = '增长与产品策略'
    outline_text = None
    description_text = None
    design_spec_hash = None
    design_spec_version = 0
    consistency_status = None

    def __init__(self, preferences=None):
        self.preferences = preferences or {}
        self.spec = None
        self.warnings = []

    def get_design_preferences(self):
        return self.preferences

    def get_design_spec(self):
        return self.spec

    def set_design_spec(self, value):
        self.spec = value

    def set_consistency_warnings(self, value):
        self.warnings = value


class PageStub:
    def __init__(self, page_id, order_index, image_path=None):
        self.id = page_id
        self.order_index = order_index
        self.generated_image_path = image_path
        self.plan = None

    def get_page_plan(self):
        return self.plan

    def set_page_plan(self, value):
        self.plan = value


class AiStub:
    def generate_json(self, *_args, **_kwargs):
        return {}


class FileStub:
    def __init__(self, root):
        self.root = Path(root)

    def get_absolute_path(self, value):
        return str(self.root / value)


def test_visual_bible_hash_and_page_plans_are_stable():
    pages_data = [
        {'title': '封面'},
        {'title': '关键数据'},
        {'title': '总结'},
    ]
    pages = [PageStub(f'p{index}', index) for index in range(3)]
    project = ProjectStub({'stylePreset': 'BUSINESS_CLEAN', 'primaryColor': '#12abef'})

    first = ensure_project_design_spec(project, pages_data, pages, AiStub())
    first_hash = project.design_spec_hash
    second = ensure_project_design_spec(project, pages_data, pages, AiStub())

    assert first == second
    assert project.design_spec_hash == first_hash
    assert project.design_spec_version == 1
    assert first['palette']['accent'] == '#12ABEF'
    assert all(page.plan['pageArchetype'] in ARCHETYPES for page in pages)
    assert all(first_hash in structured_prompt_block(project, page) for page in pages)


def test_repair_batch_is_deduplicated_and_capped_at_twenty_percent():
    assert bounded_repair_ids(['p1', 'p1', 'p2', 'p3'], 8) == ['p1', 'p2']
    assert bounded_repair_ids(['p1', 'p2'], 1) == ['p1']
    assert bounded_repair_ids(['p1'], 0) == []


def test_style_board_is_always_the_first_reference():
    primary, additional = ordered_generation_references(
        'style.png', 'page-template.png', ['material-a.png', 'material-b.png'])

    assert primary == 'style.png'
    assert additional == ['page-template.png', 'material-a.png', 'material-b.png']


def test_generated_contract_fields_are_normalized_before_hashing():
    class InvalidAiStub:
        def generate_json(self, *_args, **_kwargs):
            return {
                'visualBible': {
                    'typography': {'alignment': ''},
                    'grid': {'columns': 999, 'outerMargin': ''},
                    'density': 'chaotic',
                },
                'pagePlans': [{'pageIndex': 1, 'contentDensity': 'impossible'}],
            }

    project = ProjectStub()
    pages = [PageStub('p1', 0)]
    bible = ensure_project_design_spec(project, [{'title': '封面'}], pages, InvalidAiStub())

    assert bible['grid']['columns'] == 12
    assert bible['grid']['outerMargin'] == '6%'
    assert bible['typography']['alignment'] == 'left aligned except cover'
    assert bible['density'] == 'MEDIUM'
    assert pages[0].plan['contentDensity'] == 'LOW'


def test_local_review_detects_canvas_and_palette_drift(tmp_path):
    Image.new('RGB', (160, 90), '#185A63').save(tmp_path / 'one.png')
    Image.new('RGB', (160, 90), '#1A6068').save(tmp_path / 'two.png')
    Image.new('RGB', (120, 90), '#D02030').save(tmp_path / 'three.png')
    pages = [
        PageStub('p1', 0, 'one.png'),
        PageStub('p2', 1, 'two.png'),
        PageStub('p3', 2, 'three.png'),
    ]

    status, warnings, outliers = review_local_consistency(
        ProjectStub(), pages, FileStub(tmp_path))

    assert status == 'WARNING'
    assert any(item['code'] == 'CANVAS_SIZE_DRIFT' and item['pageId'] == 'p3' for item in warnings)
    assert 'p3' in outliers
