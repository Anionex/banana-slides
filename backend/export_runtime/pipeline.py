"""Worker composition root; providers and PPTX rendering remain adapters."""
import json
from pathlib import Path
import shutil

from .checkpoints import CheckpointStore, atomic_json, file_hash
from .control import ExportControl


def fingerprints(config, options):
    def select(prefixes):
        return {key: value for key, value in config.items()
                if key.startswith(prefixes) and not any(secret in key for secret in
                    ('API_KEY', 'MINERU_TOKEN', 'ACCESS_TOKEN', 'SECRET', 'PASSWORD', 'OAUTH', 'AUTH'))
                and isinstance(value, (str, int, float, bool, type(None)))}
    common = select(('AI_PROVIDER_FORMAT', 'OPENAI_IMAGE_API_PROTOCOL', 'TEXT_MAX_OUTPUT'))
    image = {**common, **{key: value for key, value in select(
        ('IMAGE_', 'OPENAI_API_BASE', 'GOOGLE_API_BASE', 'GENAI_', 'VERTEX_')).items()
        if not key.startswith('IMAGE_CAPTION_')}}
    caption = {**common, **select(('IMAGE_CAPTION_', 'OPENAI_API_BASE', 'GOOGLE_API_BASE',
                                 'ENABLE_TEXT_REASONING', 'TEXT_THINKING_BUDGET', 'VERTEX_'))}
    extraction = {**select(('MINERU_API_BASE', 'BAIDU_',)), 'method': options['export_extractor_method']}
    background = {'image': image, 'caption': caption, 'mode': options['export_mode'],
                  'method': options['export_inpaint_method']}
    return {'extract': extraction, 'candidate': image, 'review': caption,
            'background': background, 'target_review': caption, 'global_style': caption, 'local_style': caption,
            'analysis': {'extract': extraction, 'background': background,
                         'text_restoration_revision': 4 if options['export_mode'] == 'simple' else 0, 'options': {
                key: options[key] for key in ('max_depth', 'enable_icon_subject_extraction', 'export_mode')}}}


def execute(payload, emit):
    from flask import Flask
    from PIL import Image
    from config import get_config

    root = Path(payload['workspace']).resolve()
    config = payload['config']
    options = payload['options']
    # Providers using get_config() and providers using Flask see one snapshot.
    for key, value in config.items():
        setattr(get_config(), key, value)
    get_config().OPENAI_MAX_RETRIES = 0
    get_config().GENAI_MAX_RETRIES = 0
    app = Flask('editable-export-worker')
    app.config.update(config)
    app.config['EXPORT_WORKER'] = True
    app.config['UPLOAD_FOLDER'] = str(root / 'assets')
    Path(app.config['UPLOAD_FOLDER']).mkdir(parents=True, exist_ok=True)
    image_paths = []
    for page in payload['pages']:
        source = Path(page['path'])
        destination = root / 'sources' / f"{page['id']}{source.suffix}"
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source, destination)
        # Controller snapshot hash guards edits between acceptance and copy.
        if file_hash(destination) != page['sha256']:
            raise ValueError(f"源图已变化，请重新导出：{page['id']}")
        image_paths.append(str(destination))
    atomic_json(root / 'sources.json', [{'page_id': p['id'], 'sha256': p['sha256']}
                                      for p in payload['pages']])
    identities = fingerprints(config, options)
    with app.app_context():
        from services.ai_providers import _get_model_type_provider_config
        for role, stages in [('image', ('candidate',)), ('image_caption', ('review', 'target_review', 'global_style', 'local_style'))]:
            resolved = _get_model_type_provider_config(role)
            identity = {key: resolved.get(key) for key in
                        ('format', 'api_base', 'project_id', 'location', 'text_source', 'image_source')}
            for stage in stages:
                identities[stage]['resolved_provider'] = identity
    store = CheckpointStore(root, ancestors=payload.get('ancestors', []), fingerprints=identities, emit=emit)
    control = ExportControl(payload['runtime_dir'], strict=not options['allow_partial'],
                            emit=emit, limits=payload.get('limits'), store=store,
                            node_timeout=payload.get('node_timeout', 600),
                            run_timeout=payload.get('run_timeout', 3600))
    with app.app_context(), control.bind():
        from services.export_service import ExportService
        from services.image_editability import TextAttributeExtractorFactory
        with Image.open(image_paths[0]) as first:
            width, height = first.size
        extractor = TextAttributeExtractorFactory.create_caption_model_extractor()
        output = root / 'result.pptx'
        _, warnings = ExportService.create_editable_pptx_with_recursive_analysis(
            image_paths=image_paths, output_file=str(output),
            slide_width_pixels=width, slide_height_pixels=height,
            max_depth=options['max_depth'], max_workers=options['max_workers'],
            export_mode=options['export_mode'], fail_fast=not options['allow_partial'],
            export_extractor_method=options['export_extractor_method'],
            export_inpaint_method=options['export_inpaint_method'],
            enable_icon_subject_extraction=options['enable_icon_subject_extraction'],
            text_attribute_extractor=extractor,
            progress_callback=lambda step, message, percent: emit({
                'event': 'progress', 'stage': step, 'label': message, 'percent': percent}),
        )
        control.check()
        return {'path': str(output), 'sha256': file_hash(output),
                'pages': len(image_paths), 'warnings': warnings.to_summary(),
                'warning_details': warnings.to_dict(), 'reused_nodes': store.reused}
