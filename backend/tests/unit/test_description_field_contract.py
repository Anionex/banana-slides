"""页面描述字段契约 v2 的回归测试。

契约：页面文字（逐字上屏）/ 配图与素材（放什么）/ 版式与重点（怎么排）/ 演讲者备注（怎么讲）。
覆盖：字段指令的定义与排他性、大纲论断规则的注入范围、旧字段名兼容、精修保字段。
"""

import json

import pytest

from models import Settings, db
from services import prompts
from services.prompts import (
    EXTRA_FIELD_INSTRUCTIONS,
    _format_extra_field_instructions,
    get_all_descriptions_stream_prompt,
    get_description_to_outline_prompt,
    get_description_to_outline_prompt_markdown,
    get_outline_generation_prompt,
    get_outline_generation_prompt_markdown,
    get_outline_parsing_prompt,
    get_outline_parsing_prompt_markdown,
    get_outline_refinement_prompt,
    get_page_description_prompt,
)
from services.task_manager import _append_extra_fields


class _Ctx:
    """最小 ProjectContext 替身，只提供 prompt 构造用到的属性。"""

    creation_type = 'idea'
    idea_prompt = '介绍 AI 发展史'
    outline_text = ''
    description_text = '第一页：AI 的起源\n讲达特茅斯会议'
    reference_files_content = None
    outline_requirements = None
    description_requirements = None


@pytest.fixture
def ctx():
    return _Ctx()


# --- 字段指令 ---

def test_default_fields_render_full_instructions():
    result = _format_extra_field_instructions(list(Settings.DEFAULT_EXTRA_FIELDS))

    for name in Settings.DEFAULT_EXTRA_FIELDS:
        assert EXTRA_FIELD_INSTRUCTIONS[name] in result


def test_field_instructions_state_exclusion_rules():
    """字段之间必须互斥：越界的内容要被明确推给别的字段。"""
    materials = EXTRA_FIELD_INSTRUCTIONS['配图与素材']
    assert '不要写正文文字' in materials
    assert '不要写摆放位置' in materials

    layout = EXTRA_FIELD_INSTRUCTIONS['版式与重点']
    assert '不引入新内容' in layout
    assert '不复述页面文字' in layout

    notes = EXTRA_FIELD_INSTRUCTIONS['演讲者备注']
    assert '不会渲染到页面上' in notes


def test_field_instructions_carry_length_budget():
    """长度预算是硬约束：文生图的文字渲染预算有限，字段冗长会挤占它。"""
    assert '最多 3 项' in EXTRA_FIELD_INSTRUCTIONS['配图与素材']
    assert '不超过两句' in EXTRA_FIELD_INSTRUCTIONS['版式与重点']


def test_custom_field_falls_back_to_generic_instruction():
    result = _format_extra_field_instructions(['品牌规范'])

    assert '品牌规范：[关于品牌规范的建议，只写其他字段未覆盖的信息]' in result


def test_legacy_field_names_do_not_borrow_new_definitions():
    """两个旧字段都等价到版式与重点，若套用新定义会产生重复输出。"""
    result = _format_extra_field_instructions(['视觉焦点', '排版布局'])

    assert EXTRA_FIELD_INSTRUCTIONS['版式与重点'] not in result
    assert '视觉焦点：[关于视觉焦点的建议' in result
    assert '排版布局：[关于排版布局的建议' in result


def test_empty_field_list_renders_nothing():
    assert _format_extra_field_instructions([]) == ''
    assert _format_extra_field_instructions(None) == ''


# --- 描述生成 prompt ---

def test_page_description_prompt_drops_standalone_material_section(ctx):
    prompt = get_page_description_prompt(
        ctx, outline=[], page_outline={'title': 'AI 的起源'}, page_index=2,
        extra_fields=list(Settings.DEFAULT_EXTRA_FIELDS),
    )

    assert '图片素材:' not in prompt
    assert '图片素材：' not in prompt
    assert EXTRA_FIELD_INSTRUCTIONS['配图与素材'] in prompt


def test_page_description_prompt_states_verbatim_and_title_rules(ctx):
    prompt = get_page_description_prompt(
        ctx, outline=[], page_outline={'title': 'AI 的起源'}, page_index=2,
        extra_fields=list(Settings.DEFAULT_EXTRA_FIELDS),
    )

    assert '逐字渲染' in prompt
    assert '论断句' in prompt
    assert 'takeaway' in prompt


def test_stream_description_prompt_matches_contract(ctx):
    prompt = get_all_descriptions_stream_prompt(
        ctx, outline=[], flat_pages=[{'title': 'AI 的起源', 'points': ['达特茅斯会议']}],
        extra_fields=list(Settings.DEFAULT_EXTRA_FIELDS),
    )

    assert '图片素材：' not in prompt
    assert '逐字渲染' in prompt
    assert '论断句' in prompt
    # 流式解析依赖的标记不能被改动
    for marker in ('<!-- BEGIN -->', '<!-- PAGE_END -->', '<!-- END -->'):
        assert marker in prompt


# --- 大纲论断规则 ---

@pytest.mark.parametrize('build', [
    lambda c: get_outline_generation_prompt(c),
    lambda c: get_outline_generation_prompt_markdown(c),
    lambda c: get_outline_refinement_prompt([], '加一页总结', c),
])
def test_generation_and_refinement_prompts_carry_takeaway_rule(ctx, build):
    prompt = build(ctx)

    assert 'takeaway' in prompt.lower()
    assert 'never a topic phrase' in prompt or 'topic phrase' in prompt


def test_takeaway_rule_exempts_functional_pages(ctx):
    prompt = get_outline_generation_prompt(ctx)

    assert 'functional pages' in prompt
    assert 'do not force assertions' in prompt


def test_takeaway_rule_requires_coherent_storyline(ctx):
    prompt = get_outline_generation_prompt(ctx)

    assert 'storyline' in prompt


@pytest.mark.parametrize('build', [
    lambda c: get_outline_generation_prompt(c),
    lambda c: get_outline_generation_prompt_markdown(c),
    lambda c: get_outline_refinement_prompt([], '加一页总结', c),
])
def test_cover_and_toc_are_exempt_from_part_grouping(ctx, build):
    """封面/目录属于整个 deck，不应被套上章节（part）标签。"""
    prompt = build(ctx)

    assert 'table of contents' in prompt or '目录' in prompt
    assert 'never to a part' in prompt or '不嵌入任何' in prompt


def test_outline_json_format_example_keeps_cover_outside_part():
    """JSON 大纲格式的示例本身不能把封面嵌进 part 分组，否则示例会教反规则。"""
    assert '"part": "Part 1: Introduction"' in prompts._OUTLINE_JSON_FORMAT
    # "Welcome"（封面）必须出现在第一个 part 分组的花括号之前
    welcome_pos = prompts._OUTLINE_JSON_FORMAT.index('"Welcome"')
    part1_pos = prompts._OUTLINE_JSON_FORMAT.index('"part": "Part 1: Introduction"')
    assert welcome_pos < part1_pos


@pytest.mark.parametrize('build', [
    lambda c: get_description_to_outline_prompt(c),
    lambda c: get_description_to_outline_prompt_markdown(c),
])
def test_description_derived_outlines_exempt_cover_from_part(ctx, build):
    prompt = build(ctx)
    assert 'never to a part' in prompt


@pytest.mark.parametrize('build', [
    lambda c: get_outline_parsing_prompt(c),
    lambda c: get_outline_parsing_prompt_markdown(c),
])
def test_outline_parsing_prompts_do_not_inject_part_exemption(ctx, build):
    """解析用户自带大纲必须保真，不能注入封面免 part 的结构性规则。"""
    prompt = build(ctx)
    assert 'never to a part' not in prompt


@pytest.mark.parametrize('build', [
    lambda c: get_description_to_outline_prompt(c),
    lambda c: get_description_to_outline_prompt_markdown(c),
])
def test_description_derived_outlines_use_conditional_takeaway(ctx, build):
    """从用户文本提大纲：论断必须源自用户内容，不能凭空发明。"""
    prompt = build(ctx)

    assert 'takeaway assertion' in prompt
    assert "implied by the user's text" in prompt


@pytest.mark.parametrize('build', [
    lambda c: get_outline_parsing_prompt(c),
    lambda c: get_outline_parsing_prompt_markdown(c),
])
def test_outline_parsing_prompts_stay_faithful(ctx, build):
    """解析用户自带大纲时保真优先，不得注入论断改写规则。"""
    prompt = build(ctx)

    assert 'takeaway' not in prompt.lower()


# --- 默认值与旧字段兼容 ---

def test_default_fields_are_orthogonal_trio():
    assert Settings.DEFAULT_EXTRA_FIELDS == ['配图与素材', '版式与重点', '演讲者备注']
    assert Settings.DEFAULT_IMAGE_PROMPT_FIELDS == ['配图与素材', '版式与重点']
    assert '演讲者备注' not in Settings.DEFAULT_IMAGE_PROMPT_FIELDS


def test_legacy_equiv_covers_all_retired_names():
    assert Settings.LEGACY_FIELD_EQUIV == {
        '视觉元素': '配图与素材',
        '视觉焦点': '版式与重点',
        '排版布局': '版式与重点',
        '排版建议': '版式与重点',
    }


# --- 论断质量：禁止伪论断、要点须为证据 ---

@pytest.mark.parametrize('build', [
    lambda c: get_outline_generation_prompt(c),
    lambda c: get_outline_generation_prompt_markdown(c),
])
def test_takeaway_rule_bans_topic_announcing_sentences(ctx, build):
    """伪论断（形如句子但只宣布结论存在、不给出结论）必须被明确点名禁止。"""
    prompt = build(ctx)
    # 负例被点名：'The break-even analysis reveals when to switch'
    assert 'reveals when to switch' in prompt


def test_takeaway_rule_requires_evidence_not_restatement(ctx):
    """后续要点须为证据（数据/案例/机制），不得复述论断。"""
    prompt = get_outline_generation_prompt(ctx)
    assert 'EVIDENCE' in prompt
    assert 'not a reworded restatement' in prompt


def test_outline_markdown_prompt_bans_deck_level_title(ctx):
    """markdown 版必须禁止输出 deck 级文档标题，避免污染封面 part。"""
    prompt = get_outline_generation_prompt_markdown(ctx)
    assert 'deck-level document title' in prompt


# --- 解析器：封面前的 deck 级 H1 不得被当成 part ---

def test_parse_outline_ignores_deck_title_before_cover():
    """整份 deck 的 H1 标题出现在封面前，不应污染封面页的 part；
    而封面之后合法的 # Part 分节仍需生效。"""
    from services.ai_service import AIService

    md = (
        "# 决策汇报：AI 推理架构的战略选择\n"
        "## 决策汇报：AI 推理架构的战略选择\n"
        "- 封面副标题与汇报人信息\n"
        "# 第一部分：经济性分析\n"
        "## 现有 AI 调用支出呈现指数级增长态势\n"
        "- 成本失控风险，亟需替代方案\n"
    )
    pages = AIService.parse_markdown_outline(md)

    assert len(pages) == 2
    # 封面页不被 deck 标题污染
    assert 'part' not in pages[0]
    assert pages[0]['title'] == '决策汇报：AI 推理架构的战略选择'
    # 封面之后的合法 part 仍然生效
    assert pages[1].get('part') == '第一部分：经济性分析'


def test_parse_outline_keeps_opening_chapter_without_cover():
    """无独立封面、直接以章节开头时，首个 H1 是真实 part，不能被误删。"""
    from services.ai_service import AIService

    md = (
        "# 第一章\n"
        "## 第一页\n"
        "- 要点1\n"
        "## 第二页\n"
        "- 要点2\n"
    )
    pages = AIService.parse_markdown_outline(md)

    assert len(pages) == 2
    assert pages[0].get('part') == '第一章'
    assert pages[1].get('part') == '第一章'


@pytest.mark.parametrize('legacy_name', ['视觉元素', '视觉焦点', '排版布局', '排版建议'])
def test_legacy_fields_still_reach_image_prompt(legacy_name):
    """存量项目重新生图时，旧字段名不能因为改名而静默失效。"""
    result = _append_extra_fields(
        '页面正文',
        {'extra_fields': {legacy_name: '某项要求'}},
        set(Settings.DEFAULT_IMAGE_PROMPT_FIELDS),
    )

    assert f'{legacy_name}：某项要求' in result


def test_legacy_speaker_notes_still_excluded():
    result = _append_extra_fields(
        '页面正文',
        {'extra_fields': {'演讲者备注': '口头补充'}},
        set(Settings.DEFAULT_IMAGE_PROMPT_FIELDS),
    )

    assert result == '页面正文'


def test_new_fields_reach_image_prompt():
    result = _append_extra_fields(
        '页面正文',
        {'extra_fields': {'配图与素材': '折线图', '版式与重点': '左文右图'}},
        set(Settings.DEFAULT_IMAGE_PROMPT_FIELDS),
    )

    assert '配图与素材：折线图' in result
    assert '版式与重点：左文右图' in result


def test_unknown_custom_field_still_filtered():
    result = _append_extra_fields(
        '页面正文',
        {'extra_fields': {'品牌规范': '仅内部使用'}},
        set(Settings.DEFAULT_IMAGE_PROMPT_FIELDS),
    )

    assert result == '页面正文'


def test_settings_default_getters_return_new_fields(client):
    with client.application.app_context():
        settings = Settings.get_settings()
        settings.description_extra_fields = None
        settings.image_prompt_extra_fields = None
        db.session.commit()

        assert settings.get_description_extra_fields() == ['配图与素材', '版式与重点', '演讲者备注']
        assert settings.get_image_prompt_extra_fields() == ['配图与素材', '版式与重点']


def test_parseable_names_extend_instruction_names_with_legacy(client):
    """指令只用配置字段，解析额外接受旧字段名。"""
    from services.ai_service import AIService

    with client.application.app_context():
        settings = Settings.get_settings()
        settings.description_extra_fields = None
        db.session.commit()

        instructed = AIService._get_extra_field_names()
        parseable = AIService._get_parseable_field_names()

    assert instructed == list(Settings.DEFAULT_EXTRA_FIELDS)
    # 停用的字段名不能出现在给模型的指令里
    for legacy in Settings.LEGACY_FIELD_EQUIV:
        assert legacy not in instructed
        assert legacy in parseable
    for name in instructed:
        assert name in parseable


# --- 精修保留额外字段 ---

def test_refinement_prompt_includes_existing_extra_fields(ctx):
    prompt = prompts.get_descriptions_refinement_prompt(
        current_descriptions=[{
            'index': 0,
            'title': 'AI 的起源',
            'description_content': {
                'text': '- 达特茅斯会议',
                'extra_fields': {'版式与重点': '居中大标题'},
            },
        }],
        user_requirement='更简洁',
        project_context=ctx,
    )

    assert '版式与重点：居中大标题' in prompt
    assert '不要凭空删除' in prompt


def test_refine_descriptions_splits_extra_fields_back_out(client, monkeypatch):
    """精修返回的字段行必须切回 extra_fields，否则会被当页面文字渲染上屏。"""
    from services.ai_service import AIService

    service = AIService.__new__(AIService)
    monkeypatch.setattr(
        AIService, 'generate_json',
        lambda self, prompt, **kwargs: [
            '页面标题：AI 的起源\n页面文字：\n- 达特茅斯会议\n配图与素材：会议合影\n版式与重点：居中大标题',
        ],
    )
    monkeypatch.setattr(
        AIService, '_get_extra_field_names',
        staticmethod(lambda: list(Settings.DEFAULT_EXTRA_FIELDS)),
    )

    with client.application.app_context():
        result = service.refine_descriptions([], '更简洁', _Ctx())

    assert len(result) == 1
    assert result[0]['extra_fields'] == {'配图与素材': '会议合影', '版式与重点': '居中大标题'}
    assert '配图与素材' not in result[0]['text']
    assert '达特茅斯会议' in result[0]['text']


def test_refine_descriptions_splits_legacy_field_names(client, monkeypatch):
    from services.ai_service import AIService

    service = AIService.__new__(AIService)
    monkeypatch.setattr(
        AIService, 'generate_json',
        lambda self, prompt, **kwargs: ['页面文字：\n- 正文\n排版布局：左文右图'],
    )
    monkeypatch.setattr(
        AIService, '_get_extra_field_names',
        staticmethod(lambda: list(Settings.DEFAULT_EXTRA_FIELDS)),
    )

    with client.application.app_context():
        result = service.refine_descriptions([], '调整', _Ctx())

    assert result[0]['extra_fields'] == {'排版布局': '左文右图'}


def test_refine_descriptions_without_fields_returns_text_only(client, monkeypatch):
    from services.ai_service import AIService

    service = AIService.__new__(AIService)
    monkeypatch.setattr(
        AIService, 'generate_json',
        lambda self, prompt, **kwargs: ['页面文字：\n- 只有正文'],
    )
    monkeypatch.setattr(
        AIService, '_get_extra_field_names',
        staticmethod(lambda: list(Settings.DEFAULT_EXTRA_FIELDS)),
    )

    with client.application.app_context():
        result = service.refine_descriptions([], '调整', _Ctx())

    assert 'extra_fields' not in result[0]
    assert '只有正文' in result[0]['text']


def test_refine_descriptions_flattens_dict_items(client, monkeypatch):
    """模型返回对象而非字符串时，不能把 Python dict 字面量渲染到幻灯片上。"""
    from services.ai_service import AIService

    service = AIService.__new__(AIService)
    monkeypatch.setattr(
        AIService, 'generate_json',
        lambda self, prompt, **kwargs: [
            {'页面文字': '- 市场高速增长', '版式与重点': '左文右图'},
        ],
    )
    monkeypatch.setattr(
        AIService, '_get_extra_field_names',
        staticmethod(lambda: list(Settings.DEFAULT_EXTRA_FIELDS)),
    )

    with client.application.app_context():
        result = service.refine_descriptions([], '调整', _Ctx())

    assert result[0]['extra_fields'] == {'版式与重点': '左文右图'}
    assert '市场高速增长' in result[0]['text']
    assert '{' not in result[0]['text']


def test_parse_extra_fields_matches_field_at_text_start():
    """字段行位于文本开头时也要被识别，否则会残留在正文里渲染上屏。"""
    from services.ai_service import AIService

    text, fields = AIService._parse_extra_fields(
        '配图与素材：折线图\n版式与重点：左文右图',
        ['配图与素材', '版式与重点'],
    )

    assert fields == {'配图与素材': '折线图', '版式与重点': '左文右图'}
    assert text == ''


def test_refine_descriptions_flattens_dict_with_field_first(client, monkeypatch):
    """字典首个键就是字段名时，不能漏解析。"""
    from services.ai_service import AIService

    service = AIService.__new__(AIService)
    monkeypatch.setattr(
        AIService, 'generate_json',
        lambda self, prompt, **kwargs: [
            {'配图与素材': '折线图', '版式与重点': '左文右图'},
        ],
    )
    monkeypatch.setattr(
        AIService, '_get_extra_field_names',
        staticmethod(lambda: list(Settings.DEFAULT_EXTRA_FIELDS)),
    )

    with client.application.app_context():
        result = service.refine_descriptions([], '调整', _Ctx())

    assert result[0]['extra_fields'] == {'配图与素材': '折线图', '版式与重点': '左文右图'}
    assert result[0]['text'] == ''


def test_refine_descriptions_flattens_list_values(client, monkeypatch):
    """值为数组时要摊平成多行，不能输出 Python 列表字面量。"""
    from services.ai_service import AIService

    service = AIService.__new__(AIService)
    monkeypatch.setattr(
        AIService, 'generate_json',
        lambda self, prompt, **kwargs: [
            {'页面文字': ['- 要点一', '- 要点二'], '版式与重点': '左文右图'},
        ],
    )
    monkeypatch.setattr(
        AIService, '_get_extra_field_names',
        staticmethod(lambda: list(Settings.DEFAULT_EXTRA_FIELDS)),
    )

    with client.application.app_context():
        result = service.refine_descriptions([], '调整', _Ctx())

    assert result[0]['extra_fields'] == {'版式与重点': '左文右图'}
    assert '要点一' in result[0]['text'] and '要点二' in result[0]['text']
    assert '[' not in result[0]['text']


def test_refinement_prompt_tolerates_null_text(ctx):
    """description_content 里 text 为 null 时不应炸掉 prompt 构造。"""
    prompt = prompts.get_descriptions_refinement_prompt(
        current_descriptions=[{
            'index': 0,
            'title': '空页',
            'description_content': {'text': None, 'extra_fields': {'版式与重点': '居中'}},
        }],
        user_requirement='补充内容',
        project_context=ctx,
    )

    assert '版式与重点：居中' in prompt


def test_refine_descriptions_rejects_non_list(client, monkeypatch):
    from services.ai_service import AIService

    service = AIService.__new__(AIService)
    monkeypatch.setattr(AIService, 'generate_json', lambda self, prompt, **kwargs: {'oops': 1})

    with client.application.app_context():
        with pytest.raises(ValueError):
            service.refine_descriptions([], '调整', _Ctx())
