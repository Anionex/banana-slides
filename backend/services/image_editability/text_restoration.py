"""Target -> candidate -> review -> original-image retry, adapted from Restore.

Unlike a successful image API response, an accepted review is a compositing
contract. Decorative markers are reconciled with what actually survived.
"""
from dataclasses import dataclass
import json
from pathlib import Path
import re
import unicodedata

from PIL import Image, ImageDraw

from export_runtime.checkpoints import cached, digest, atomic_json, file_hash
from export_runtime.control import check, StageFailure, current

_BULLETS = '•·●○▪▫◦‣'


@dataclass(frozen=True)
class TextTarget:
    target_id: str
    text: str
    bbox: tuple
    marker: str = ''
    plain_text: str = ''
    body_bbox: tuple = ()

    @classmethod
    def from_element(cls, element):
        text = element.content or ''
        marker, plain = '', text
        stripped = text.lstrip()
        if stripped and stripped[0] in _BULLETS:
            marker, plain = 'bullet', stripped[1:].lstrip()
        elif stripped and 'CIRCLED' in unicodedata.name(stripped[0], ''):
            try:
                plain = str(int(unicodedata.numeric(stripped[0]))) + stripped[1:]
                marker = 'circle'
            except (ValueError, TypeError):
                pass
        body_bbox = ()
        if marker == 'bullet':
            chars = element.metadata.get('chars', [])
            body = [char['bbox'] for char in chars if char.get('char', '').strip()
                    and char.get('char') not in _BULLETS and len(char.get('bbox', [])) == 4]
            if body:
                body_bbox = (min(b[0] for b in body), min(b[1] for b in body),
                             max(b[2] for b in body), max(b[3] for b in body))
        return cls(element.element_id, text, element.bbox.to_tuple(), marker, plain, body_bbox)

    def to_dict(self):
        return {'id': self.target_id, 'text': self.plain_text if self.marker == 'circle' else self.text,
                'bbox': list(self.bbox), 'marker': self.marker, 'original_text': self.text,
                'body_bbox': list(self.body_bbox)}


@dataclass(frozen=True)
class ErasureReview:
    accepted: bool
    reason: str
    feedback: str
    markers: dict
    body_bboxes: dict

    @classmethod
    def parse(cls, value, targets):
        if not isinstance(value, dict):
            raise StageFailure('去字校验返回的不是 JSON 对象')
        fields = ('target_removed', 'non_target_unchanged', 'artifact_free', 'pass')
        if any(type(value.get(key)) is not bool for key in fields):
            raise StageFailure('去字校验缺少布尔判定字段')
        markers = value.get('markers', {})
        if not isinstance(markers, dict):
            raise StageFailure('去字校验的符号状态格式错误')
        required = {target.target_id for target in targets if target.marker}
        if any(markers.get(key) not in ('retained', 'removed', 'uncertain') for key in required):
            raise StageFailure('去字校验缺少符号保留状态')
        accepted = all(value[key] for key in fields) and all(markers[key] != 'uncertain' for key in required)
        body_bboxes = {}
        if accepted:
            for target in targets:
                if target.marker != 'bullet' or markers.get(target.target_id) != 'retained':
                    continue
                bbox = target.body_bbox or value.get('body_bboxes', {}).get(target.target_id)
                if (not isinstance(bbox, (list, tuple)) or len(bbox) != 4
                        or any(type(v) not in (int, float) for v in bbox)
                        or not target.bbox[0] < bbox[0] < bbox[2] <= target.bbox[2] + 2
                        or not target.bbox[1] - 2 <= bbox[1] < bbox[3] <= target.bbox[3] + 2):
                    raise StageFailure('保留项目符号时缺少正文位置，不能移动文字覆盖符号')
                body_bboxes[target.target_id] = tuple(bbox)
        return cls(accepted, str(value.get('reason', '')), str(value.get('retry_prompt_supplement', ''))[:1200], markers, body_bboxes)


def _review_prompt(targets):
    return '''Review presentation text removal. The LEFT image is BEFORE, with red
target boxes; the RIGHT image is AFTER. Only the listed text glyphs should be
removed. Filled number badges, circles, icons, borders, panels, pictures and
background geometry are non-text artwork: preserve them. Outline marker circles
and bullet dots may remain or be removed; report their actual state so the text
layer can compensate. Filled badge backgrounds must remain. A retained empty badge
or circle is not residual text. Reject remaining letters/digits, ghosts, smears,
changed non-target artwork, or invented shapes. For each listed marker classify
the circle/bullet itself as retained, removed, or uncertain; a digit inside a
circle must be removed regardless. Never classify a solid badge as a text glyph.
For a retained bullet whose target has no body_bbox, return body_bboxes with the
bounding box of its text body EXCLUDING the bullet, in BEFORE-image pixels.
Return JSON with actual booleans: {"target_removed":true,
"non_target_unchanged":true,"artifact_free":true,"pass":true,"reason":"",
"retry_prompt_supplement":"","markers":{"target-id":"retained"},"body_bboxes":{}}.
On rejection give a brief concrete correction for the next ORIGINAL-image edit.
Targets: ''' + json.dumps([target.to_dict() for target in targets], ensure_ascii=False)


def residuals(ocr_result, targets, markers):
    if ocr_result.has_error:
        raise StageFailure(f'去字 OCR 校验失败: {ocr_result.error}')
    remaining = []
    for item in ocr_result.elements:
        text = str(item.get('content') or '').strip()
        if not text:
            continue
        x0, y0, x1, y1 = item['bbox']
        area = max(1, (x1 - x0) * (y1 - y0))
        for target in targets:
            a, b, c, d = target.bbox
            overlap = max(0, min(x1, c) - max(x0, a)) * max(0, min(y1, d) - max(y0, b))
            if overlap / area < .25:
                continue
            if target.marker and markers.get(target.target_id) == 'retained' and all(ch in _BULLETS + '◯〇' for ch in text):
                continue
            # Text-like non-target drawings are adjudicated by visual QA; an
            # actual target substring at its expected location is a hard reject.
            normalized = ''.join(ch for ch in target.plain_text if ch.isalnum())
            observed = ''.join(ch for ch in text if ch.isalnum())
            if observed and (observed in normalized or normalized in observed):
                remaining.append(text)
                break
    return remaining


def restore_text_background(image_path, elements, provider, ocr, output_dir):
    targets = [TextTarget.from_element(element) for element in elements if element.content]
    plan = [target.to_dict() for target in targets]
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    atomic_json(output_dir / 'targets.json', plan)
    source_hash = file_hash(image_path)
    feedback = ''
    max_attempts = 2
    for attempt in range(1, max_attempts + 1):
        check()
        attempt_dir = output_dir / f'attempt-{attempt}-{digest(feedback)[:12]}'
        attempt_dir.mkdir(parents=True, exist_ok=True)
        candidate_input = {'source': image_path, 'targets': plan, 'feedback': feedback}

        def generate():
            # Never pass a previous generated candidate to the image model.
            with Image.open(image_path) as source:
                image = source.convert('RGB')
            result = provider.inpaint_regions(
                image=image, bboxes=[target.bbox for target in targets],
                types=['text'] * len(targets), text_only=True,
                text_targets=plan, retry_feedback=feedback,
                save_mask_path=str(attempt_dir / 'mask.png'),
            )
            check()
            if result is None:
                raise StageFailure('去字模型未返回背景')
            if result.size != image.size:
                result = result.resize(image.size, Image.Resampling.LANCZOS)
            path = attempt_dir / 'candidate.png'
            result.convert('RGB').save(path)
            atomic_json(attempt_dir / 'input.json', {'source_sha256': source_hash, 'attempt': attempt, 'feedback': feedback})
            return str(path)

        candidate = cached('candidate', candidate_input, generate)
        review_input = {'source': image_path, 'candidate': candidate, 'targets': plan}

        def review():
            with Image.open(image_path) as before, Image.open(candidate) as after:
                marked = before.convert('RGB')
                draw = ImageDraw.Draw(marked)
                for target in targets:
                    draw.rectangle(target.bbox, outline='red', width=2)
                comparison = Image.new('RGB', (before.width * 2, before.height), 'white')
                comparison.paste(marked, (0, 0))
                comparison.paste(after.convert('RGB'), (before.width, 0))
                comparison_path = attempt_dir / 'review-input.png'
                comparison.save(comparison_path)
            result = provider.ai_service.generate_json_with_image(_review_prompt(targets), str(comparison_path))
            parsed = ErasureReview.parse(result, targets)
            remaining = residuals(ocr(candidate), targets, parsed.markers)
            if remaining:
                result = {**result, 'pass': False, 'target_removed': False,
                          'reason': '目标区域仍有文字：' + ', '.join(remaining),
                          'retry_prompt_supplement': 'Remove these remaining text glyphs completely: ' + ', '.join(remaining)}
            atomic_json(attempt_dir / 'review.json', result)
            return result

        # Explicit rejections are committed decisions; API/schema failures are
        # not. A retry can reuse the candidate and repeat just the failed QA.
        raw_review = cached('review', review_input, review)
        verdict = ErasureReview.parse(raw_review, targets)
        if verdict.accepted:
            for element, target in zip([e for e in elements if e.content], targets):
                state = verdict.markers.get(target.target_id)
                if target.marker and state == 'retained':
                    element.content = target.plain_text
                    element.metadata['retained_marker'] = target.marker
                    element.metadata['original_text'] = target.text
                    if target.marker == 'bullet':
                        from .data_models import BBox
                        element.bbox = BBox(*verdict.body_bboxes[target.target_id])
                        element.bbox_global = element.bbox  # text-only mode has no recursive regions
                        crop = output_dir / f'{target.target_id}-body.png'
                        with Image.open(image_path) as source:
                            source.crop(element.bbox.to_tuple()).save(crop)
                        element.image_path = str(crop)
            return candidate
        feedback = verdict.feedback or verdict.reason
        if current():
            current().emit({'event': 'retry', 'label': f'文字擦除校验未通过：{verdict.reason}',
                            'attempt': attempt + 1, 'max_attempts': max_attempts})
    raise StageFailure(f'文字擦除校验未通过（{max_attempts} 次）：{feedback}')
