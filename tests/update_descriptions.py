#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""Update descriptions for existing project from JSON"""

import requests
import json
import re
import sys
import io
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

BASE_URL = 'http://localhost:5000'


def clean_json_content(content):
    content = re.sub(r'\[cite_start\]', '', content)
    content = re.sub(r'\[cite:\s*[^\]]+\]', '', content)
    return content


def parse_json_file(file_path):
    content = file_path.read_text(encoding='utf-8')
    content = clean_json_content(content)

    slides = []
    metadata = None
    depth = 0
    start = -1
    objects = []

    for i, char in enumerate(content):
        if char == '{':
            if depth == 0:
                start = i
            depth += 1
        elif char == '}':
            depth -= 1
            if depth == 0 and start != -1:
                obj_str = content[start:i+1]
                try:
                    obj = json.loads(obj_str)
                    objects.append(obj)
                except json.JSONDecodeError:
                    pass
                start = -1

    for obj in objects:
        if 'presentationMetadata' in obj:
            metadata = obj['presentationMetadata']
        if 'slides' in obj:
            slides.extend(obj['slides'])

    return {'metadata': metadata, 'slides': slides}


def convert_slide_to_description_content(slide):
    """Convert JSON slide to description_content dict format"""
    title = slide.get('title', 'Untitled')
    slide_type = slide.get('type', '')

    # Build text_content as list of strings
    text_content = []

    session = slide.get('session', '')
    section = slide.get('section', '')
    if session or section:
        text_content.append(f'Session: {session}, Section: {section}')

    objective = slide.get('objective', '')
    if objective:
        text_content.append(f'Objective: {objective}')

    bullets = slide.get('bullets', [])
    for bullet in bullets:
        text_content.append(f'• {bullet}')

    def_box = slide.get('definitionBox')
    if def_box:
        text_content.append(f'[{def_box.get("label", "DEFINITION")}] {def_box.get("text", "")}')

    rem_box = slide.get('rememberBox')
    if rem_box:
        items = rem_box.get('items', [])
        text_content.append(f'[{rem_box.get("label", "REMEMBER")}] ' + ' | '.join(items))

    visual = slide.get('visual', {})
    if visual:
        text_content.append(f'[Visual: {visual.get("kind", "image")}] {visual.get("description", "")}')

    key_terms = slide.get('keyTerms', [])
    if key_terms:
        text_content.append(f'Key Terms: {", ".join(key_terms)}')

    # Layout suggestion from style
    style = slide.get('style', {})
    layout = style.get('layout', 'default')

    return {
        'title': f'{title} ({slide_type})',
        'text_content': text_content,
        'layout_suggestion': layout
    }


def convert_slide_to_description(slide):
    """Convert JSON slide to rich description text for AI image generation"""
    parts = []

    title = slide.get('title', '')
    slide_type = slide.get('type', '')
    parts.append(f'Slide Title: {title}')
    parts.append(f'Slide Type: {slide_type}')

    session = slide.get('session', '')
    section = slide.get('section', '')
    if session or section:
        parts.append(f'Session: {session}, Section: {section}')

    objective = slide.get('objective', '')
    if objective:
        parts.append(f'Objective: {objective}')

    bullets = slide.get('bullets', [])
    if bullets:
        parts.append('Content Points:')
        for bullet in bullets:
            parts.append(f'• {bullet}')

    def_box = slide.get('definitionBox')
    if def_box:
        parts.append(f'\n[DEFINITION BOX - {def_box.get("label", "DEFINITION")}]')
        parts.append(def_box.get("text", ""))

    rem_box = slide.get('rememberBox')
    if rem_box:
        parts.append(f'\n[REMEMBER BOX - {rem_box.get("label", "GHI NHỚ")}]')
        for item in rem_box.get('items', []):
            parts.append(f'• {item}')

    visual = slide.get('visual', {})
    if visual:
        parts.append(f'\n[VISUAL ELEMENT - {visual.get("kind", "image")}]')
        parts.append(f'Description: {visual.get("description", "")}')
        if visual.get("altText"):
            parts.append(f'Alt text: {visual.get("altText")}')

    style = slide.get('style', {})
    if style:
        parts.append(f'\nLayout Style: {style.get("layout", "default")}')

    key_terms = slide.get('keyTerms', [])
    if key_terms:
        parts.append(f'\nKey Terms: {", ".join(key_terms)}')

    overlays = slide.get('overlays', [])
    if overlays:
        for overlay in overlays:
            if overlay.get('type') == 'text':
                parts.append(f'\nWatermark: {overlay.get("text", "")} at {overlay.get("anchor", "bottom_right")}')

    return '\n'.join(parts)


def main():
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument('--project-id', required=True, help='Project ID')
    parser.add_argument('--json-file', default='noidung43slide.txt', help='JSON file path')
    args = parser.parse_args()

    project_id = args.project_id
    json_path = Path(args.json_file)

    if not json_path.exists():
        print(f'Error: File not found: {json_path}')
        return

    # Parse JSON
    data = parse_json_file(json_path)
    slides = data.get('slides', [])
    print(f'Loaded {len(slides)} slides from JSON')

    # Get pages
    resp = requests.get(f'{BASE_URL}/api/projects/{project_id}', timeout=120)
    if resp.status_code != 200:
        print(f'Error getting project: {resp.status_code}')
        return

    project = resp.json()['data']
    pages = project.get('pages', [])
    print(f'Project has {len(pages)} pages')

    # Update descriptions
    print('Updating descriptions...')
    updated = 0
    failed = 0

    for i, page in enumerate(pages):
        if i >= len(slides):
            break

        page_id = page.get('page_id')
        slide = slides[i]
        description_content = convert_slide_to_description_content(slide)

        try:
            # Use correct endpoint with description_content
            resp = requests.put(
                f'{BASE_URL}/api/projects/{project_id}/pages/{page_id}/description',
                json={'description_content': description_content},
                timeout=120
            )

            if resp.status_code == 200:
                updated += 1
                if updated % 10 == 0 or updated == len(pages):
                    print(f'  Progress: {updated}/{len(pages)}')
            else:
                failed += 1
                if failed <= 3:
                    print(f'  Failed page {i+1}: {resp.status_code}')
        except Exception as e:
            failed += 1
            print(f'  Error page {i+1}: {e}')

    print(f'\nDone!')
    print(f'  Updated: {updated}')
    print(f'  Failed: {failed}')


if __name__ == '__main__':
    main()
