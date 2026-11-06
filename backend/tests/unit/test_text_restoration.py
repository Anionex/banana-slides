import json
from pathlib import Path
from types import SimpleNamespace

from PIL import Image, ImageDraw
import pytest

from export_runtime.checkpoints import CheckpointStore, file_hash
from export_runtime.control import ExportControl, StageFailure
from services.image_editability.data_models import EditableElement, BBox
from services.image_editability.extractors import ExtractionResult
from services.image_editability.text_restoration import ErasureReview, TextTarget, restore_text_background


def verdict(markers=None, accepted=True):
    return dict(target_removed=accepted, non_target_unchanged=True, artifact_free=True,
                **{'pass': accepted}, reason='' if accepted else 'residual digits',
                retry_prompt_supplement='' if accepted else 'Remove the remaining digits', markers=markers or {})


def element(text='Hello', name='one'):
    return EditableElement(name, 'text', BBox(5, 5, 70, 30), BBox(5, 5, 70, 30), content=text)


class FakeProvider:
    def __init__(self, reviews, confirmation=None):
        self.reviews = iter(reviews)
        self.calls, self.review_calls = [], 0
        self.ai_service = SimpleNamespace(generate_json_with_image=self.review)
        self.confirmation = confirmation if confirmation is not None else verdict(accepted=False)
        self.confirmation_calls = 0

    def inpaint_regions(self, **kwargs):
        self.calls.append((kwargs['image'].tobytes(), kwargs.get('retry_feedback')))
        result = Image.new('RGB', kwargs['image'].size, 'white')
        result.putpixel((0, 0), (255 - len(self.calls), 255, 255))
        return result

    def review(self, prompt, *_args):
        if prompt.startswith('This image is the edited slide AFTER'):
            self.confirmation_calls += 1
            return self.confirmation
        self.review_calls += 1
        result = next(self.reviews)
        if isinstance(result, Exception):
            raise result
        return result


def source(root):
    root.mkdir(exist_ok=True)
    image = Image.new('RGB', (100, 50), 'white')
    ImageDraw.Draw(image).text((5, 5), 'Hello', fill='black')
    path = root / 'source.png'
    image.save(path)
    return path


def run(root, path, provider, elements=None, ancestors=(), caption='caption-a'):
    store = CheckpointStore(root, ancestors=ancestors, fingerprints={'review': {'model': caption}})
    with ExportControl(root / 'locks', store=store).bind():
        return restore_text_background(str(path), elements or [element()], provider,
                                       lambda _: ExtractionResult([]), root / 'erase')


def test_rejected_erasure_retries_original_with_feedback(tmp_path):
    path = source(tmp_path)
    provider = FakeProvider([verdict(accepted=False), verdict()])
    result = run(tmp_path, path, provider)
    assert Path(result).exists()
    assert len(provider.calls) == 2
    assert provider.calls[0][0] == provider.calls[1][0]
    assert provider.calls[1][1] == 'residual digits'
    audits = [json.loads(p.read_text()) for p in (tmp_path / 'erase').glob('*/input.json')]
    assert {record['source_sha256'] for record in audits} == {file_hash(path)}


def test_failed_qa_resumes_candidate_without_second_image_request(tmp_path):
    first, second = tmp_path / 'first', tmp_path / 'second'
    path = source(first)
    provider = FakeProvider([RuntimeError('QA unavailable'), verdict()])
    with pytest.raises(RuntimeError, match='QA unavailable'):
        run(first, path, provider)
    run(second, path, provider, ancestors=[first])
    assert len(provider.calls) == 1
    assert provider.review_calls == 2


def test_changed_caption_rechecks_saved_candidate(tmp_path):
    first, second = tmp_path / 'first', tmp_path / 'second'
    path = source(first)
    provider = FakeProvider([verdict(), verdict()])
    run(first, path, provider)
    run(second, path, provider, ancestors=[first], caption='caption-b')
    assert len(provider.calls) == 1 and provider.review_calls == 2


def test_exhausted_quality_retries_resume_with_fresh_candidate(tmp_path):
    first, second = tmp_path / 'first', tmp_path / 'second'
    path = source(first)
    provider = FakeProvider([verdict(accepted=False), verdict(accepted=False), verdict()])
    with pytest.raises(StageFailure, match='校验未通过'):
        run(first, path, provider)
    assert len(provider.calls) == 2
    result = run(second, path, provider, ancestors=[first])
    assert Path(result).exists()
    assert len(provider.calls) == 3
    assert provider.review_calls == 3
    assert provider.calls[-1][0] == provider.calls[0][0]


def test_clean_ocr_and_candidate_review_resolve_reference_side_confusion(tmp_path):
    path = source(tmp_path)
    provider = FakeProvider([verdict(accepted=False)], confirmation=verdict())
    result = run(tmp_path, path, provider)
    assert Path(result).exists()
    assert len(provider.calls) == 1
    assert provider.confirmation_calls == 1


def test_candidate_only_review_cannot_override_changed_artwork(tmp_path):
    path = source(tmp_path)
    damaged = {**verdict(accepted=False), 'non_target_unchanged': False}
    provider = FakeProvider([damaged, damaged], confirmation=verdict())
    with pytest.raises(StageFailure, match='校验未通过'):
        run(tmp_path, path, provider)
    assert provider.confirmation_calls == 0


def test_candidate_only_review_cannot_override_comparative_artifacts(tmp_path):
    path = source(tmp_path)
    damaged = {**verdict(accepted=False), 'artifact_free': False}
    provider = FakeProvider([damaged, damaged], confirmation=verdict())
    with pytest.raises(StageFailure, match='校验未通过'):
        run(tmp_path, path, provider)
    assert provider.confirmation_calls == 0


def test_candidate_only_review_checks_text_not_existing_backgrounds(tmp_path):
    path = source(tmp_path)
    provider = FakeProvider([verdict(accepted=False)], confirmation={'target_removed': True})
    assert Path(run(tmp_path, path, provider)).exists()
    audit = next((tmp_path / 'erase').glob('*/review.json'))
    review = json.loads(audit.read_text())
    assert review['comparative_review']['artifact_free'] is True
    assert review['artifact_free'] is True


def test_residual_ocr_cannot_be_overridden_by_candidate_only_review(tmp_path):
    path = source(tmp_path)
    provider = FakeProvider([verdict(), verdict()], confirmation=verdict())
    with ExportControl(tmp_path / 'locks').bind(), pytest.raises(StageFailure, match='校验未通过'):
        restore_text_background(str(path), [element()], provider,
            lambda _: ExtractionResult([{'content': 'Hello', 'bbox': [5, 5, 70, 30]}]), tmp_path / 'erase')
    assert provider.confirmation_calls == 0


def test_ocr_profile_icon_is_not_erased_or_overlaid_as_a_digit(tmp_path):
    path = source(tmp_path)
    provider = FakeProvider([verdict()])
    review = provider.review
    def classify(prompt, image):
        if prompt.startswith('Classify these ambiguous OCR'):
            return {'targets': [
                {'id': 'icon', 'kind': 'artwork', 'reason': 'Profile pictogram'},
                {'id': 'number', 'kind': 'text', 'reason': 'Numbered heading'},
            ]}
        return review(prompt, image)
    provider.ai_service.generate_json_with_image = classify
    elements = [element('8', 'icon'), element('1', 'number'), element('Hello', 'body')]
    run(tmp_path, path, provider, elements)
    assert [item.element_id for item in elements] == ['number', 'body']
    plan = json.loads((tmp_path / 'erase/targets.json').read_text())
    assert [item['text'] for item in plan] == ['1', 'Hello']


def test_incomplete_glyph_classification_fails_before_erasing(tmp_path):
    path = source(tmp_path)
    provider = FakeProvider([])
    provider.ai_service.generate_json_with_image = lambda *_: {'targets': []}
    with pytest.raises(StageFailure, match='不完整'):
        run(tmp_path, path, provider, [element('8')])
    assert not provider.calls


@pytest.mark.parametrize('text,marker,retained,removed', [
    ('①', 'circle', '1', '①'), ('❷', 'circle', '2', '❷'),
    ('• First item', 'bullet', 'First item', '• First item'),
])
@pytest.mark.parametrize('state', ['retained', 'removed'])
def test_text_layer_matches_actual_marker_state(tmp_path, text, marker, retained, removed, state):
    path = source(tmp_path)
    item = element(text)
    if marker == 'bullet':
        item.metadata['chars'] = [{'char': '•', 'bbox': [5, 10, 9, 15]},
                                  {'char': 'First item', 'bbox': [17, 5, 70, 30]}]
    provider = FakeProvider([verdict({'one': state})])
    run(tmp_path, path, provider, [item])
    assert item.content == (retained if state == 'retained' else removed)
    assert item.metadata.get('retained_marker') == (marker if state == 'retained' else None)
    if marker == 'bullet' and state == 'retained':
        assert item.bbox.x0 == item.bbox_global.x0 == 17
        assert Image.open(item.image_path).size == (53, 25)


def test_uncertain_marker_cannot_be_silently_dropped(tmp_path):
    path = source(tmp_path)
    item = element('①')
    provider = FakeProvider([verdict({'one': 'uncertain'}), verdict({'one': 'uncertain'})])
    with pytest.raises(StageFailure, match='校验未通过'):
        run(tmp_path, path, provider, [item])
    assert item.content == '①'


def test_review_requires_actual_booleans_and_complete_marker_mapping():
    with pytest.raises(StageFailure, match='布尔'):
        ErasureReview.parse({**verdict(), 'pass': 'false'}, [])
    with pytest.raises(StageFailure, match='符号保留'):
        ErasureReview.parse(verdict(), [TextTarget.from_element(element('①'))])
    assert TextTarget.from_element(element('12')).marker == ''
