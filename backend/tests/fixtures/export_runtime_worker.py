"""Test-only HTTP adapters around the real worker, pipeline, checkpoints and PPTX builder."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
import export_runtime.pipeline as pipeline

real_execute = pipeline.execute


def execute(payload, emit):
    import os
    from types import SimpleNamespace
    import requests
    from flask import current_app
    from PIL import Image
    from export_runtime.control import export_call
    from services.image_editability import ServiceConfig, TextAttributeExtractorFactory
    from services.image_editability.extractors import ExtractionResult, ExtractionContext, ExtractorRegistry
    from services.image_editability.inpaint_providers import GenerativeEditInpaintProvider, InpaintProviderRegistry
    from services.image_editability.text_attribute_extractors import TextStyleResult

    def remote(kind, phase, page=0):
        response = requests.post(payload['fixture_url'], json={'kind': kind, 'phase': phase, 'page': page}, timeout=30)
        response.raise_for_status()

    def page_number(path):
        with Image.open(path) as image:
            return image.convert('RGB').getpixel((0, 0))[0]

    class Extractor:
        def supports_type(self, _kind):
            return True

        @export_call('ocr')
        def extract(self, image_path, element_type=None, depth=0, **_kwargs):
            remote('ocr', 'review' if 'candidate' in image_path else 'extract', page_number(image_path))
            with Image.open(image_path) as image:
                size = image.size
            if 'candidate' in image_path:
                elements = []
            else:
                elements = [{'type': 'text', 'bbox': [20, 20, 200, 45],
                             'content': f'Page {page_number(image_path)}', 'metadata': {'source': 'fixture'}}]
                if payload['options']['export_mode'] == 'full' and depth == 0:
                    elements.append({'type': 'image', 'bbox': [100, 70, 240, 155]})
            return ExtractionResult(elements, ExtractionContext(metadata={'image_size': size}))

    class AI:
        image_provider = SimpleNamespace(supports_mask_edit=True)

        @export_call('image')
        def edit_image(self, current_image_path, **_kwargs):
            page = page_number(current_image_path)
            remote('image', 'erase', page)
            with Image.open(current_image_path) as source:
                image = Image.new('RGB', source.size, 'white')
                image.putpixel((0, 0), (page, 0, 0))
                return image

        @export_call('caption')
        def generate_json_with_image(self, _prompt, image_path):
            remote('caption', 'review', page_number(image_path))
            return {'target_removed': True, 'non_target_unchanged': True,
                    'artifact_free': True, 'pass': True, 'markers': {}}

    class Styles:
        @export_call('caption')
        def extract_batch_with_full_image(self, full_image, text_elements):
            remote('caption', 'global', page_number(full_image))
            return {element['element_id']: TextStyleResult(is_bold=False, confidence=.9)
                    for element in text_elements}

        @export_call('caption')
        def extract(self, image, text_content):
            remote('caption', 'local', int(text_content.split()[-1]))
            return TextStyleResult(font_color_rgb=(0, 0, 0), confidence=.9)

    def configuration(**kwargs):
        return ServiceConfig(Path(current_app.config['UPLOAD_FOLDER']),
            ExtractorRegistry().register_default(Extractor()),
            InpaintProviderRegistry().register_default(GenerativeEditInpaintProvider(AI())),
            max_depth=kwargs['max_depth'], min_image_size=30, min_image_area=900,
            text_only=kwargs['text_only'])

    ServiceConfig.from_defaults = staticmethod(configuration)
    TextAttributeExtractorFactory.create_caption_model_extractor = staticmethod(Styles)
    result = real_execute(payload, emit)
    if os.name != 'nt':
        import resource
        result['peak_rss_bytes'] = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss * (1 if sys.platform == 'darwin' else 1024)
    result['worker_pid'] = os.getpid()
    return result


pipeline.execute = execute
from export_worker import main
main()
