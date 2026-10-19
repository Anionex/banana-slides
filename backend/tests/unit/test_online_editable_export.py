"""Online export must never initialize the local RMBG model."""
from unittest.mock import Mock

import pytest

from services.image_editability.factories import ServiceConfig, InpaintProviderFactory


@pytest.mark.parametrize('public_mode', [True, False])
@pytest.mark.parametrize('saved_enabled', [True, False])
def test_online_policy_overrides_saved_icon_setting(app, tmp_path, monkeypatch,
                                                    public_mode, saved_enabled):
    create_rmbg = Mock(return_value=object())
    monkeypatch.setattr('services.ai_providers.image.create_rmbg_segmentation_provider', create_rmbg)
    monkeypatch.setattr(InpaintProviderFactory, 'create_baidu_inpaint_provider',
                        lambda: object())
    monkeypatch.setitem(app.config, 'PUBLIC_DEMO', public_mode)
    with app.app_context():
        config = ServiceConfig.from_defaults(
            mineru_token='test-token', upload_folder=str(tmp_path),
            extractor_method='mineru', inpaint_method='baidu',
            enable_icon_subject_extraction=saved_enabled,
        )
    expected = saved_enabled and not public_mode
    assert config.enable_icon_subject_extraction is expected
    assert (config.segmentation_provider is not None) is expected
    assert create_rmbg.call_count == int(expected)
