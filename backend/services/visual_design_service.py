"""Project-level visual contracts for structured full-slide image generation."""
from __future__ import annotations

import hashlib
import json
import math
import os
import tempfile
from statistics import median
from typing import Any

from PIL import Image, ImageDraw


ARCHETYPES = {
    'COVER', 'AGENDA', 'SECTION_DIVIDER', 'KEY_STATEMENT', 'TEXT_IMAGE',
    'COMPARISON', 'PROCESS', 'TIMELINE', 'DATA', 'CONCLUSION',
}

STYLE_PRESETS = {
    'AUTO': {
        'palette': {'background': '#F7F9FC', 'text': '#152033', 'accent': '#16B8C8', 'support': '#DCE7EE'},
        'visualMedium': 'clean editorial vector illustration',
    },
    'BUSINESS_CLEAN': {
        'palette': {'background': '#F7F9FC', 'text': '#172033', 'accent': '#137C8B', 'support': '#D9E4EA'},
        'visualMedium': 'restrained corporate photography with linear icons',
    },
    'DATA_REPORT': {
        'palette': {'background': '#0E141B', 'text': '#F4F7FA', 'accent': '#20C6B7', 'support': '#334454'},
        'visualMedium': 'data-journalism charts and geometric infographics',
    },
    'SWISS_MINIMAL': {
        'palette': {'background': '#F5F5F2', 'text': '#111111', 'accent': '#E53935', 'support': '#D4D4CF'},
        'visualMedium': 'minimal Swiss grid with flat geometric forms',
    },
    'EDITORIAL': {
        'palette': {'background': '#FAFAF8', 'text': '#202020', 'accent': '#1E5B8F', 'support': '#D8D2C8'},
        'visualMedium': 'editorial photography with magazine-style rules',
    },
    'DARK_TECH': {
        'palette': {'background': '#090D14', 'text': '#F2F7FA', 'accent': '#22D3EE', 'support': '#273345'},
        'visualMedium': 'dark technical diagrams with luminous line icons',
    },
    'EDUCATIONAL': {
        'palette': {'background': '#FFFDF8', 'text': '#263238', 'accent': '#147D76', 'support': '#F2C14E'},
        'visualMedium': 'friendly flat educational illustration',
    },
}


def ensure_project_design_spec(project, pages_data: list[dict], pages: list, ai_service) -> dict | None:
    if (project.generation_mode or 'STANDARD_VISUAL') != 'STRUCTURED_VISUAL':
        return None
    existing = project.get_design_spec()
    if existing and project.design_spec_hash:
        _apply_page_plans(pages, _fallback_page_plans(pages_data))
        return existing

    preferences = project.get_design_preferences()
    preset_name = str(preferences.get('stylePreset') or 'AUTO').upper()
    preset = STYLE_PRESETS.get(preset_name, STYLE_PRESETS['AUTO'])
    prompt = _design_prompt(project, pages_data, preset_name, preset, preferences)
    try:
        generated = ai_service.generate_json(prompt, thinking_budget=1800)
    except Exception:
        generated = None

    visual_bible, page_plans = _normalize_generated(
        generated, pages_data, preset_name, preset, preferences)
    canonical = json.dumps(visual_bible, ensure_ascii=True, sort_keys=True, separators=(',', ':'))
    project.set_design_spec(visual_bible)
    project.design_spec_hash = hashlib.sha256(canonical.encode('utf-8')).hexdigest()
    project.design_spec_version = int(project.design_spec_version or 0) + 1
    project.consistency_status = 'PENDING'
    project.set_consistency_warnings([])
    _apply_page_plans(pages, page_plans)
    return visual_bible


def structured_prompt_block(project, page) -> str:
    visual_bible = project.get_design_spec()
    if not visual_bible or (project.generation_mode or '') != 'STRUCTURED_VISUAL':
        return ''
    payload = {
        'designSpecVersion': project.design_spec_version,
        'designSpecHash': project.design_spec_hash,
        'visualBible': visual_bible,
        'pagePlan': page.get_page_plan() or {},
    }
    return json.dumps(payload, ensure_ascii=False, sort_keys=True, indent=2)


def build_style_board_prompt(project) -> str:
    spec = project.get_design_spec() or {}
    return (
        'Create one presentation design-system style board, not a business slide. '
        'Do not include sentences, company names, topics, statistics, or placeholder paragraphs. '
        'Show only abstract samples of the exact palette, title hierarchy, background treatment, '
        'cards, dividers, line icons, chart marks, spacing, and illustration medium described below. '
        'The board will be used as the shared visual reference for every slide, so keep one coherent '
        'design language and avoid alternative themes.\n\n'
        + json.dumps(spec, ensure_ascii=False, sort_keys=True, indent=2)
    )


def bounded_repair_ids(outlier_ids: list[str], page_count: int) -> list[str]:
    """Return one deterministic repair batch capped at 20 percent of the deck."""
    if page_count <= 0:
        return []
    unique_ids = list(dict.fromkeys(value for value in outlier_ids if value))
    return unique_ids[:max(1, math.ceil(page_count * 0.2))]


def ordered_generation_references(
        style_board_path: str | None,
        page_reference_path: str | None,
        material_reference_paths: list[str] | None) -> tuple[str | None, list[str]]:
    """Keep the shared style reference first without dropping page content references."""
    primary = style_board_path or page_reference_path
    additional = list(material_reference_paths or [])
    if style_board_path and page_reference_path:
        additional.insert(0, page_reference_path)
    return primary, additional


def review_local_consistency(project, pages: list, file_service) -> tuple[str, list[dict], list[str]]:
    samples: list[tuple[Any, tuple[int, int, int], tuple[int, int]]] = []
    warnings: list[dict] = []
    for page in pages:
        if not page.generated_image_path:
            continue
        try:
            path = file_service.get_absolute_path(page.generated_image_path)
            with Image.open(path) as image:
                samples.append((page, _dominant_mean(image), image.size))
        except Exception as exc:
            warnings.append({'pageId': page.id, 'code': 'IMAGE_INSPECTION_FAILED', 'message': str(exc)[:200]})

    if len(samples) < 2:
        return ('WARNING' if warnings else 'PASSED', warnings, [])

    common_size = max((item[2] for item in samples), key=lambda size: sum(1 for sample in samples if sample[2] == size))
    for page, _, size in samples:
        if size != common_size:
            warnings.append({
                'pageId': page.id,
                'code': 'CANVAS_SIZE_DRIFT',
                'message': f'页面尺寸 {size[0]}x{size[1]} 与主要尺寸 {common_size[0]}x{common_size[1]} 不一致',
            })

    content_samples = [
        item for item in samples
        if (item[0].get_page_plan() or {}).get('pageArchetype') not in {'COVER', 'SECTION_DIVIDER'}
    ] or samples
    center = tuple(int(median([color[channel] for _, color, _ in content_samples])) for channel in range(3))
    outliers: list[str] = []
    for page, color, _ in content_samples:
        distance = math.sqrt(sum((color[index] - center[index]) ** 2 for index in range(3)))
        if distance > 92:
            warnings.append({
                'pageId': page.id,
                'code': 'PALETTE_DRIFT',
                'message': '页面主色与整套视觉中心明显偏离',
                'distance': round(distance, 1),
            })
            outliers.append(page.id)
    return ('WARNING' if warnings else 'PASSED', warnings, outliers)


def review_vision_consistency(project, pages: list, file_service, ai_service) -> tuple[list[dict], list[str]]:
    available = [page for page in pages if page.generated_image_path]
    if len(available) < 2:
        return [], []
    contact_path = None
    opened: list[Image.Image] = []
    try:
        thumb_width, thumb_height, columns = 320, 180, 4
        rows = math.ceil(len(available) / columns)
        sheet = Image.new('RGB', (columns * thumb_width, rows * (thumb_height + 28)), 'white')
        draw = ImageDraw.Draw(sheet)
        for index, page in enumerate(available):
            image = Image.open(file_service.get_absolute_path(page.generated_image_path)).convert('RGB')
            opened.append(image)
            image.thumbnail((thumb_width, thumb_height))
            x = (index % columns) * thumb_width
            y = (index // columns) * (thumb_height + 28)
            sheet.paste(image, (x + (thumb_width - image.width) // 2, y))
            draw.text((x + 8, y + thumb_height + 5), f'PAGE {page.order_index + 1}', fill='black')
        with tempfile.NamedTemporaryFile(suffix='.jpg', delete=False) as tmp:
            contact_path = tmp.name
        sheet.save(contact_path, format='JPEG', quality=86)
        prompt = f"""Review this contact sheet as one presentation, using the locked visual bible below.
Find only clear cross-page drift in palette, typography, graphic medium, recurring components, or page-archetype execution.
Cover and section-divider pages may have different composition but must keep the same visual identity.
Return only JSON: {{"outlierPages":[2],"issues":[{{"page":2,"dimension":"palette|typography|medium|components|layout","reason":"short reason"}}]}}.
Do not reject pages merely because their content differs.

Visual bible:
{json.dumps(project.get_design_spec() or {}, ensure_ascii=False, sort_keys=True)}"""
        result = ai_service.generate_json_with_image(prompt, contact_path, thinking_budget=1200)
        if isinstance(result, list) and result and isinstance(result[0], dict):
            result = result[0]
        if not isinstance(result, dict):
            return [], []
        by_number = {page.order_index + 1: page for page in available}
        outlier_ids = []
        for value in result.get('outlierPages') or []:
            try:
                page = by_number.get(int(value))
            except (TypeError, ValueError):
                page = None
            if page and page.id not in outlier_ids:
                outlier_ids.append(page.id)
        warnings = []
        for issue in result.get('issues') or []:
            if not isinstance(issue, dict):
                continue
            try:
                page = by_number.get(int(issue.get('page')))
            except (TypeError, ValueError):
                page = None
            if page:
                warnings.append({
                    'pageId': page.id,
                    'code': 'VISION_STYLE_DRIFT',
                    'dimension': str(issue.get('dimension') or 'style')[:32],
                    'message': str(issue.get('reason') or '跨页视觉风格偏离')[:200],
                })
        return warnings, outlier_ids
    except Exception:
        return [{
            'pageId': None,
            'code': 'VISION_REVIEW_UNAVAILABLE',
            'message': '视觉分析不可用，已保留本地一致性检查结果',
        }], []
    finally:
        for image in opened:
            image.close()
        if contact_path:
            try:
                os.remove(contact_path)
            except OSError:
                pass


def _design_prompt(project, pages_data, preset_name, preset, preferences) -> str:
    return f"""You are a presentation design director. Produce one immutable design contract and one page plan per page.
Return only a JSON object. Never return markdown.

Project title: {project.project_title or ''}
Topic: {project.idea_prompt or project.outline_text or project.description_text or ''}
Style preset: {preset_name}
Optional primary color: {preferences.get('primaryColor') or ''}
Preset baseline: {json.dumps(preset, ensure_ascii=False)}
Pages: {json.dumps(pages_data, ensure_ascii=False)}

Required JSON shape:
{{
  "visualBible": {{
    "palette": {{"background":"#RRGGBB","text":"#RRGGBB","accent":"#RRGGBB","support":"#RRGGBB"}},
    "typography": {{"titleHierarchy":"...","weights":"...","alignment":"..."}},
    "grid": {{"columns":12,"outerMargin":"...","gutter":"...","safeArea":"..."}},
    "visualMedium":"one and only one primary visual medium",
    "components": ["recurring page number", "title zone", "accent rule"],
    "forbiddenVariations": ["specific forbidden palette, typography, decoration and medium changes"],
    "density":"LOW|MEDIUM|HIGH",
    "whitespace":"..."
  }},
  "pagePlans": [
    {{"pageIndex":1,"pageArchetype":"COVER|AGENDA|SECTION_DIVIDER|KEY_STATEMENT|TEXT_IMAGE|COMPARISON|PROCESS|TIMELINE|DATA|CONCLUSION","contentDensity":"LOW|MEDIUM|HIGH","layoutStructure":"kebab-case","visualFocus":"...","textRegions":["..."],"imageRegions":["..."]}}
  ]
}}

Use the same palette, typography, grid, components and visual medium for every page. A page plan may vary layout but cannot create a new theme."""


def _normalize_generated(generated, pages_data, preset_name, preset, preferences):
    if isinstance(generated, list) and generated and isinstance(generated[0], dict):
        generated = generated[0]
    generated = generated if isinstance(generated, dict) else {}
    bible = generated.get('visualBible') if isinstance(generated.get('visualBible'), dict) else {}
    palette = bible.get('palette') if isinstance(bible.get('palette'), dict) else {}
    base_palette = dict(preset['palette'])
    base_palette.update({key: value for key, value in palette.items() if _is_hex(value)})
    primary = preferences.get('primaryColor')
    if _is_hex(primary):
        base_palette['accent'] = primary.upper()
    typography = bible.get('typography') if isinstance(bible.get('typography'), dict) else {}
    grid = bible.get('grid') if isinstance(bible.get('grid'), dict) else {}
    columns = grid.get('columns', 12)
    if isinstance(columns, bool) or not isinstance(columns, int) or not 1 <= columns <= 24:
        columns = 12
    visual_bible = {
        'stylePreset': preset_name,
        'palette': base_palette,
        'typography': {
            'titleHierarchy': _text(typography.get('titleHierarchy'), 'stable 3-level sans-serif hierarchy'),
            'weights': _text(typography.get('weights'), 'bold titles, regular body'),
            'alignment': _text(typography.get('alignment'), 'left aligned except cover'),
        },
        'grid': {
            'columns': columns,
            'outerMargin': _text(grid.get('outerMargin'), '6%'),
            'gutter': _text(grid.get('gutter'), '2%'),
            'safeArea': _text(grid.get('safeArea'), '5%'),
        },
        'visualMedium': _text(bible.get('visualMedium'), preset['visualMedium']),
        'components': _string_list(bible.get('components')) or ['page number', 'stable title zone', 'accent rule'],
        'forbiddenVariations': _string_list(bible.get('forbiddenVariations')) or [
            'no alternate palette', 'no font-family changes', 'no change of illustration medium',
            'no unrelated gradients or decorative motifs',
        ],
        'density': _density(bible.get('density')),
        'whitespace': _text(bible.get('whitespace'), 'Keep generous and repeatable spacing.'),
    }
    raw_plans = generated.get('pagePlans') if isinstance(generated.get('pagePlans'), list) else []
    plans_by_index = {
        int(plan.get('pageIndex')): plan for plan in raw_plans
        if isinstance(plan, dict) and str(plan.get('pageIndex', '')).isdigit()
    }
    fallback = _fallback_page_plans(pages_data)
    normalized = []
    for index, base in enumerate(fallback, 1):
        candidate = plans_by_index.get(index, {})
        archetype = str(candidate.get('pageArchetype') or base['pageArchetype']).upper()
        normalized.append({
            'pageIndex': index,
            'pageArchetype': archetype if archetype in ARCHETYPES else base['pageArchetype'],
            'contentDensity': _density(candidate.get('contentDensity'), base['contentDensity']),
            'layoutStructure': _text(candidate.get('layoutStructure'), base['layoutStructure']),
            'visualFocus': _text(candidate.get('visualFocus'), base['visualFocus']),
            'textRegions': _string_list(candidate.get('textRegions')) or base['textRegions'],
            'imageRegions': _string_list(candidate.get('imageRegions')) or base['imageRegions'],
        })
    return visual_bible, normalized


def _fallback_page_plans(pages_data):
    plans = []
    total = len(pages_data)
    for index, page in enumerate(pages_data, 1):
        title = str((page or {}).get('title') or '').lower()
        if index == 1:
            archetype, layout, density = 'COVER', 'hero-cover', 'LOW'
        elif index == total:
            archetype, layout, density = 'CONCLUSION', 'summary-callout', 'LOW'
        elif any(word in title for word in ('目录', 'agenda', 'contents')):
            archetype, layout, density = 'AGENDA', 'numbered-agenda', 'MEDIUM'
        elif any(word in title for word in ('对比', '比较', 'versus', ' vs')):
            archetype, layout, density = 'COMPARISON', 'balanced-two-column', 'MEDIUM'
        elif any(word in title for word in ('数据', '指标', '趋势', '增长', 'data', 'metric')):
            archetype, layout, density = 'DATA', 'headline-chart', 'HIGH'
        elif any(word in title for word in ('流程', '步骤', 'process', 'roadmap')):
            archetype, layout, density = 'PROCESS', 'horizontal-process', 'MEDIUM'
        else:
            archetype, layout, density = 'TEXT_IMAGE', 'title-text-visual', 'MEDIUM'
        plans.append({
            'pageIndex': index, 'pageArchetype': archetype, 'contentDensity': density,
            'layoutStructure': layout, 'visualFocus': str((page or {}).get('title') or ''),
            'textRegions': ['title', 'body'], 'imageRegions': ['primary-visual'],
        })
    return plans


def _apply_page_plans(pages, plans):
    by_index = {int(plan['pageIndex']) - 1: plan for plan in plans}
    for page in pages:
        if not page.get_page_plan():
            page.set_page_plan(by_index.get(page.order_index))


def _dominant_mean(image: Image.Image) -> tuple[int, int, int]:
    pixels = list(image.convert('RGB').resize((48, 27)).getdata())
    filtered = [pixel for pixel in pixels if 20 < sum(pixel) / 3 < 238]
    values = filtered or pixels
    return tuple(int(sum(pixel[channel] for pixel in values) / len(values)) for channel in range(3))


def _string_list(value):
    return [str(item).strip() for item in value if str(item).strip()] if isinstance(value, list) else []


def _text(value, fallback):
    normalized = str(value).strip() if value is not None else ''
    return normalized or fallback


def _density(value, fallback='MEDIUM'):
    normalized = str(value or fallback).strip().upper()
    return normalized if normalized in {'LOW', 'MEDIUM', 'HIGH'} else fallback


def _is_hex(value):
    if not isinstance(value, str) or len(value) != 7 or not value.startswith('#'):
        return False
    try:
        int(value[1:], 16)
        return True
    except ValueError:
        return False
