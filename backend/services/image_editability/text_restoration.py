"""Target -> candidate -> review -> original-image retry, adapted from Restore.

Unlike a successful image API response, an accepted review is a compositing
contract. Decorative markers are reconciled with what actually survived.
"""
from dataclasses import dataclass
import json
from pathlib import Path
import re
import unicodedata

from PIL import Image, ImageDraw, ImageFont

from export_runtime.checkpoints import cached, digest, atomic_json, file_hash
from export_runtime.control import check, StageFailure, current

_BULLETS = '•·●○▪▫◦‣'


class TextErasureQualityFailure(StageFailure):
    """A rejected background is a recoverable quality failure, not a crash."""

    def __init__(self, attempts, reason):
        super().__init__(f'文字擦除校验未通过（{attempts} 次）：{reason}')
        self.attempts = attempts

    def to_dict(self):
        return {
            'message': '自动重试后仍未通过背景去字校验',
            'error_type': 'quality',
            'error_code': 'EXPORT_TEXT_ERASURE_QUALITY',
            'stage': 'text_erasure',
            'details': {'reason': 'quality_rejected', 'retryable': True,
                        'attempts': self.attempts, 'technical_message': str(self)},
            'help_text': '失败页面需要重新生成背景，已通过校验的步骤会保留。',
        }


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
    return '''Review presentation text removal. The LEFT panel labeled BEFORE is
the original, with red target boxes. The RIGHT panel labeled AFTER is the edited
candidate. Judge residual text ONLY in AFTER; text visible in BEFORE is expected
and is not a failure. Compare BEFORE only to assess preservation of artwork.
Only the listed text glyphs should be
removed. Filled number badges, circles, icons, borders, panels, pictures and
background geometry are non-text artwork: preserve them. Outline marker circles
and bullet dots may remain or be removed; report their actual state so the text
layer can compensate. Filled badge backgrounds must remain. A retained empty badge
or circle is not residual text. Reject remaining letters/digits, ghosts, smears,
changed non-target artwork, or invented shapes. For each listed marker classify
the circle/bullet itself as retained, removed, or uncertain; a digit inside a
circle must be removed regardless. Never classify a solid badge as a text glyph.
Judge artifact_free by comparison with BEFORE: existing solid backplates,
including irregular white title stickers, are not new smears when left empty.
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
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    # OCR can read a profile icon as "8" or a drawing as a single letter.
    # Resolve ambiguous glyphs before erasure, so icons are neither erased nor
    # duplicated as editable text. Numbered badges remain real text targets.
    ambiguous = [target for target in targets if not target.marker
                 and len(''.join(ch for ch in target.text if ch.isalnum())) <= 1]
    if ambiguous:
        def classify_targets():
            columns = min(4, len(ambiguous))
            tile_width, tile_height = 320, 280
            grid = Image.new('RGB', (columns * tile_width,
                ((len(ambiguous) + columns - 1) // columns) * tile_height), 'white')
            labels = ImageDraw.Draw(grid)
            with Image.open(image_path) as source:
                for index, target in enumerate(ambiguous):
                    x0, y0, x1, y1 = target.bbox
                    padding = max(24, round(max(x1 - x0, y1 - y0) * .5))
                    box = (max(0, x0 - padding), max(0, y0 - padding),
                           min(source.width, x1 + padding), min(source.height, y1 + padding))
                    crop = source.crop(box).convert('RGB')
                    draw = ImageDraw.Draw(crop)
                    draw.rectangle((x0 - box[0], y0 - box[1], x1 - box[0], y1 - box[1]),
                                   outline='red', width=1)
                    scale = min((tile_width - 16) / crop.width, (tile_height - 40) / crop.height)
                    crop = crop.resize((max(1, round(crop.width * scale)),
                                        max(1, round(crop.height * scale))), Image.Resampling.LANCZOS)
                    left, top = index % columns * tile_width, index // columns * tile_height
                    grid.paste(crop, (left + (tile_width - crop.width) // 2, top + 32))
                    labels.text((left + 8, top + 8), f'Detection {index}', fill='black',
                                font=ImageFont.load_default(size=18))
            classification_path = output_dir / 'target-review-input.png'
            grid.save(classification_path)
            prompt = (
                'Classify these ambiguous OCR detections in crops from the original slide. '
                'Each numbered tile shows ONE detection inside a red box with surrounding context. '
                'Inspect that boxed shape, not other text in the crop. OCR may be wrong. '
                'A profile/person icon resembling 8, pictograms, arrows and decoration are artwork. '
                'Actual letters and digits, including numbering inside badges, are text. '
                'Keep a detection as text when uncertain. Return JSON {"targets":'
                '[{"id":"exact supplied id","kind":"text or artwork","reason":"visual evidence"}]} '
                'for EVERY supplied detection. Detections: '
                + json.dumps([{'detection': index, **target.to_dict()}
                              for index, target in enumerate(ambiguous)], ensure_ascii=False)
            )
            result = provider.ai_service.generate_json_with_image(prompt, str(classification_path))
            entries = result.get('targets') if isinstance(result, dict) else None
            ids = {target.target_id for target in ambiguous}
            if (not isinstance(entries, list) or len(entries) != len(ids)
                    or any(not isinstance(item, dict) or item.get('kind') not in ('text', 'artwork')
                           or not isinstance(item.get('id'), str) for item in entries)
                    or {item['id'] for item in entries} != ids):
                raise StageFailure('文字与图形识别结果不完整')
            return result

        classification = cached('target_review', {'source': image_path, 'crop_version': 1,
            'targets': [target.to_dict() for target in ambiguous]}, classify_targets)
        artwork = {item['id'] for item in classification['targets'] if item['kind'] == 'artwork'}
        elements[:] = [element for element in elements if element.element_id not in artwork]
        targets = [target for target in targets if target.target_id not in artwork]
    plan = [target.to_dict() for target in targets]
    atomic_json(output_dir / 'targets.json', plan)
    if not targets:
        return str(image_path)
    source_hash = file_hash(image_path)
    feedback = ''
    max_attempts = 2
    rejected = []
    for attempt in range(1, max_attempts + 1):
        check()
        attempt_dir = output_dir / f'attempt-{attempt}-{digest(feedback)[:12]}'
        attempt_dir.mkdir(parents=True, exist_ok=True)
        candidate_input = {'source': image_path, 'targets': plan, 'feedback': feedback}
        if feedback:
            # Older retries could narrow the full inventory to residual text.
            candidate_input['retry_policy'] = 2

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
        review_input = {'source': image_path, 'candidate': candidate, 'targets': plan,
                        'comparison_version': 4}

        def review():
            with Image.open(image_path) as before, Image.open(candidate) as after:
                marked = before.convert('RGB')
                draw = ImageDraw.Draw(marked)
                for target in targets:
                    draw.rectangle(target.bbox, outline='red', width=2)
                header = max(32, before.height // 16)
                gap = max(8, before.width // 128)
                comparison = Image.new('RGB', (before.width * 2 + gap, before.height + header), 'white')
                comparison.paste(marked, (0, header))
                comparison.paste(after.convert('RGB'), (before.width + gap, header))
                labels = ImageDraw.Draw(comparison)
                font = ImageFont.load_default(size=max(16, header // 2))
                labels.text((12, header // 4), 'BEFORE - original (reference only)', fill='black', font=font)
                labels.text((before.width + gap + 12, header // 4), 'AFTER - evaluate this result', fill='black', font=font)
                labels.rectangle((before.width, 0, before.width + gap - 1, comparison.height), fill='black')
                comparison_path = attempt_dir / 'review-input.png'
                comparison.save(comparison_path)
            result = provider.ai_service.generate_json_with_image(_review_prompt(targets), str(comparison_path))
            parsed = ErasureReview.parse(result, targets)
            remaining = residuals(ocr(candidate), targets, parsed.markers)
            if remaining:
                result = {**result, 'pass': False, 'target_removed': False,
                          'reason': '目标区域仍有文字：' + ', '.join(remaining),
                          'retry_prompt_supplement': 'Remove these remaining text glyphs completely: ' + ', '.join(remaining)}
            elif (not parsed.accepted and result['non_target_unchanged'] is True
                  and result['artifact_free'] is True):
                # Side-by-side QA can mistake the reference's text for residue.
                # With clean OCR, resolve that disagreement against AFTER alone;
                # keep the comparative artwork/marker verdict unchanged.
                confirmation = provider.ai_service.generate_json_with_image(
                    'This image is the edited slide AFTER text erasure, not the source image. '
                    'Inspect this image only for readable target text and letter-shaped ghosts. '
                    'The inventory names text intended to be absent; '
                    'do not infer its presence from the list. Empty badges and decorative symbols '
                    'and solid title backplates are artwork, not text residue. '
                    'Return JSON with an actual boolean target_removed, '
                    'plus a reason string. Target inventory: ' + json.dumps(plan, ensure_ascii=False),
                    candidate,
                )
                if (not isinstance(confirmation, dict)
                        or type(confirmation.get('target_removed')) is not bool):
                    raise StageFailure('去字复核必须返回布尔判断')
                result = {**result, 'comparative_review': dict(result), 'candidate_only_review': confirmation,
                          'target_removed': confirmation['target_removed'],
                          'pass': confirmation['target_removed'],
                          'reason': str(confirmation.get('reason', ''))}
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
        # QA describes defects; it must not replace the original-image edit's
        # full target inventory with instructions to edit only remaining text.
        feedback = verdict.reason or verdict.feedback
        rejected.append((candidate_input, review_input))
        if current() and attempt < max_attempts:
            current().emit({'event': 'retry', 'label': f'文字擦除校验未通过：{verdict.reason}',
                            'attempt': attempt + 1, 'max_attempts': max_attempts})
    control = current()
    if control and control.store:
        # An explicit resume must generate new candidates for this failed page,
        # rather than replaying the same exhausted chain of rejected decisions.
        # Transport/QA exceptions above keep their candidate for a cheap resume.
        for candidate_input, review_input in rejected:
            control.store.invalidate('candidate', candidate_input)
            control.store.invalidate('review', review_input)
    raise TextErasureQualityFailure(max_attempts, feedback)
