"""
TTS Video Service 单元测试

纯单元测试部分（不需要 Flask app 或完整依赖链）直接导入模块；
需要 app context 的集成测试使用 conftest 提供的 fixtures。
"""
import os
import sys
import pytest
import tempfile
import importlib
import importlib.util
from unittest.mock import patch, MagicMock

# 确保 backend 目录在路径中
_backend_dir = os.path.join(os.path.dirname(__file__), '..', '..')
sys.path.insert(0, os.path.abspath(_backend_dir))


# ═══════════════════════════════════════════════════════════════════════════════
# 直接加载 tts_video_service 模块（绕过 services/__init__.py）
# ═══════════════════════════════════════════════════════════════════════════════

def _load_module_directly(module_name: str, file_path: str):
    """从文件直接加载模块，避免触发 __init__.py 的级联导入"""
    spec = importlib.util.spec_from_file_location(module_name, file_path)
    mod = importlib.util.module_from_spec(spec)
    sys.modules[module_name] = mod
    spec.loader.exec_module(mod)
    return mod

_services_dir = os.path.join(os.path.abspath(_backend_dir), 'services')

_tts_mod = _load_module_directly(
    'services.tts_video_service',
    os.path.join(_services_dir, 'tts_video_service.py'),
)

_prompts_mod = _load_module_directly(
    'services.prompts',
    os.path.join(_services_dir, 'prompts.py'),
)

get_default_voice = _tts_mod.get_default_voice
check_ffmpeg_available = _tts_mod.check_ffmpeg_available
get_audio_duration = _tts_mod.get_audio_duration
KEN_BURNS_EFFECTS = _tts_mod.KEN_BURNS_EFFECTS
composite_video = _tts_mod.composite_video
_split_narration_to_sentences = _tts_mod._split_narration_to_sentences
_build_timed_subtitle_entries = _tts_mod._build_timed_subtitle_entries
generate_ass_subtitle = _tts_mod.generate_ass_subtitle
_MAX_SUBTITLE_SEGMENT_LENGTH = _tts_mod._MAX_SUBTITLE_SEGMENT_LENGTH
_DEFAULT_SILENT_DURATION = _tts_mod._DEFAULT_SILENT_DURATION
get_narration_generation_prompt = _prompts_mod.get_narration_generation_prompt


# ═══════════════════════════════════════════════════════════════════════════════
# 纯单元测试（无外部依赖）
# ═══════════════════════════════════════════════════════════════════════════════


class TestModuleConstants:
    """测试模块级常量"""

    def test_max_subtitle_segment_length(self):
        assert _MAX_SUBTITLE_SEGMENT_LENGTH == 30

    def test_default_silent_duration(self):
        assert _DEFAULT_SILENT_DURATION == 3.0


class TestGetDefaultVoice:
    """测试语音映射"""

    def test_zh_voice(self):
        assert get_default_voice('zh') == 'zh-CN-XiaoxiaoNeural'

    def test_en_voice(self):
        assert get_default_voice('en') == 'en-US-JennyNeural'

    def test_ja_voice(self):
        assert get_default_voice('ja') == 'ja-JP-NanamiNeural'

    def test_unknown_language_fallback(self):
        assert get_default_voice('ko') == 'zh-CN-XiaoxiaoNeural'

    def test_custom_config(self):
        config = {
            'TTS_DEFAULT_VOICE_ZH': 'zh-CN-YunxiNeural',
            'TTS_DEFAULT_VOICE_EN': 'en-US-GuyNeural',
            'TTS_DEFAULT_VOICE_JA': 'ja-JP-KeitaNeural',
        }
        assert get_default_voice('zh', config) == 'zh-CN-YunxiNeural'
        assert get_default_voice('en', config) == 'en-US-GuyNeural'


class TestCheckFfmpegAvailable:
    """测试 FFmpeg 可用性检查"""

    @patch.object(_tts_mod.subprocess, 'run')
    def test_ffmpeg_available(self, mock_run):
        mock_run.return_value = MagicMock(returncode=0)
        assert check_ffmpeg_available() is True

    @patch.object(_tts_mod.subprocess, 'run', side_effect=FileNotFoundError)
    def test_ffmpeg_not_found(self, mock_run):
        assert check_ffmpeg_available() is False

    @patch.object(_tts_mod.subprocess, 'run', side_effect=OSError("permission denied"))
    def test_ffmpeg_error(self, mock_run):
        assert check_ffmpeg_available() is False


class TestGetAudioDuration:
    """测试音频时长获取"""

    @patch.object(_tts_mod.subprocess, 'run')
    def test_parse_duration(self, mock_run):
        mock_run.return_value = MagicMock(
            returncode=0,
            stdout='12.345\n',
        )
        duration = get_audio_duration('/fake/audio.mp3')
        assert abs(duration - 12.345) < 0.001



class TestKenBurnsEffects:
    """测试 Ken Burns 效果轮转"""

    def test_effect_cycling(self):
        assert len(KEN_BURNS_EFFECTS) == 4
        assert KEN_BURNS_EFFECTS[0] == 'zoom_in'
        assert KEN_BURNS_EFFECTS[1] == 'zoom_out'
        assert KEN_BURNS_EFFECTS[2] == 'pan_left'
        assert KEN_BURNS_EFFECTS[3] == 'pan_right'
        assert KEN_BURNS_EFFECTS[4 % 4] == 'zoom_in'


class TestCompositeVideoConcatFile:
    """测试 concat 列表生成"""

    @patch.object(_tts_mod.subprocess, 'run')
    def test_single_clip_copies(self, mock_run):
        """单片段直接复制，不调用 ffmpeg"""
        with tempfile.NamedTemporaryFile(suffix='.mp4', delete=False) as src:
            src.write(b'fake video data')
            src_path = src.name

        try:
            out_path = src_path + '_out.mp4'
            composite_video([src_path], out_path)
            assert os.path.exists(out_path)
            mock_run.assert_not_called()
        finally:
            for f in [src_path, out_path]:
                if os.path.exists(f):
                    os.unlink(f)

    @patch.object(_tts_mod.subprocess, 'run')
    def test_multiple_clips_concat(self, mock_run):
        """多片段使用 concat demuxer"""
        mock_run.return_value = MagicMock(returncode=0, stderr='')

        clips = ['/fake/clip1.mp4', '/fake/clip2.mp4']
        out_path = '/tmp/test_concat_output.mp4'

        composite_video(clips, out_path)

        mock_run.assert_called_once()
        args = mock_run.call_args
        cmd = args[0][0]
        assert '-f' in cmd
        assert 'concat' in cmd

    def test_concat_rejects_newline_in_path(self):
        """路径含换行符时应抛出 ValueError（防止 concat 注入）"""
        clips = ['/fake/clip1.mp4', '/fake/clip\n2.mp4']
        with pytest.raises(ValueError, match="newline"):
            composite_video(clips, '/tmp/test_output.mp4')


class TestSubtitleSplitting:
    """测试字幕拆分与时间分配"""

    def test_short_text_single_sentence(self):
        sentences = _split_narration_to_sentences('大家好。')
        assert sentences == ['大家好。']

    def test_split_by_period(self):
        text = '第一句话。第二句话。第三句话。'
        sentences = _split_narration_to_sentences(text)
        assert len(sentences) == 3
        assert sentences[0] == '第一句话。'
        assert sentences[1] == '第二句话。'

    def test_split_long_sentence_by_comma(self):
        text = '这是一个很长很长很长很长很长很长很长很长的句子，用逗号来分隔一下后面的部分。'
        sentences = _split_narration_to_sentences(text)
        assert len(sentences) >= 2
        for s in sentences:
            assert len(s) <= 35  # 允许一点超出

    def test_timed_entries_cover_duration(self):
        entries = _build_timed_subtitle_entries('第一句。第二句。第三句。', 10.0, 6.0)
        assert len(entries) == 3
        assert abs(entries[0]['start'] - 10.0) < 0.01
        assert abs(entries[-1]['end'] - 16.0) < 0.01

    def test_timed_entries_proportional(self):
        entries = _build_timed_subtitle_entries('短。这是一个长一些的句子。', 0.0, 10.0)
        assert len(entries) == 2
        # 长句应该分配更多时间
        short_dur = entries[0]['end'] - entries[0]['start']
        long_dur = entries[1]['end'] - entries[1]['start']
        assert long_dur > short_dur

    def test_ass_file_generation(self):
        entries = [
            {'start': 0.0, 'end': 2.0, 'text': '你好世界'},
            {'start': 2.0, 'end': 5.0, 'text': 'Hello World'},
        ]
        import tempfile
        with tempfile.NamedTemporaryFile(suffix='.ass', delete=False, mode='w') as f:
            path = f.name
        try:
            generate_ass_subtitle(entries, path)
            with open(path, 'r', encoding='utf-8-sig') as f:
                content = f.read()
            assert 'Noto Sans CJK' in content or 'Fontname' in content
            assert 'Dialogue:' in content
            assert '你好世界' in content
            assert 'Hello World' in content
            assert 'BorderStyle' in content
        finally:
            os.unlink(path)


class TestNarrationPrompt:
    """测试旁白 prompt 构建"""

    def test_prompt_contains_required_fields(self):
        prompt = get_narration_generation_prompt(
            description_text='这是一个关于人工智能发展的介绍页面',
            outline={'title': 'AI 发展历程', 'points': ['深度学习', '大语言模型']},
            page_index=2,
            total_pages=10,
            language='zh',
        )
        assert 'AI 发展历程' in prompt
        assert '深度学习' in prompt
        assert '大语言模型' in prompt
        assert '2' in prompt
        assert '10' in prompt
        assert '中文' in prompt or '全中文' in prompt
        # 验证用户输入被 XML 标签隔离（防止 prompt injection）
        assert '<slide_description>' in prompt
        assert '</slide_description>' in prompt
        assert '<slide_title>' in prompt

    def test_english_prompt(self):
        prompt = get_narration_generation_prompt(
            description_text='Introduction to machine learning',
            outline={'title': 'ML Basics', 'points': ['Supervised', 'Unsupervised']},
            page_index=1,
            total_pages=5,
            language='en',
        )
        assert 'English' in prompt


# ═══════════════════════════════════════════════════════════════════════════════
# 以下测试需要 Flask app context（使用 conftest 的 app/client fixtures）
# 在 CI/CD 环境中通过 `uv run pytest` 运行
# ═══════════════════════════════════════════════════════════════════════════════

needs_app = pytest.mark.skipif(
    'flask' not in sys.modules and not os.environ.get('FULL_TEST_ENV'),
    reason="Requires Flask app context (run with uv run pytest)",
)


@needs_app
class TestPageNarrationModel:
    """测试 Page 模型的 narration 字段"""

    def test_narration_text_in_to_dict(self, app):
        with app.app_context():
            from models import Page
            page = Page(
                project_id='test-project',
                order_index=0,
                narration_text='这是旁白文本',
            )
            d = page.to_dict()
            assert d['narration_text'] == '这是旁白文本'

    def test_set_narration_text(self, app):
        with app.app_context():
            from models import Page
            page = Page(project_id='test-project', order_index=0)
            page.set_narration_text('Hello narration')
            assert page.narration_text == 'Hello narration'

    def test_set_narration_text_empty(self, app):
        with app.app_context():
            from models import Page
            page = Page(project_id='test-project', order_index=0)
            page.set_narration_text('')
            assert page.narration_text is None

    def test_get_narration_text(self, app):
        with app.app_context():
            from models import Page
            page = Page(project_id='test-project', order_index=0, narration_text='test')
            assert page.get_narration_text() == 'test'


@needs_app
class TestExportVideoRoute:
    """测试视频导出 API 路由"""

    def test_export_video_project_not_found(self, client):
        response = client.post(
            '/api/projects/nonexistent-id/export/video',
            json={},
        )
        assert response.status_code == 404

    def test_export_video_no_pages(self, client, sample_project):
        if not sample_project:
            pytest.skip("sample_project fixture returned None")
        project_id = sample_project.get('id') or sample_project.get('project_id')
        response = client.post(
            f'/api/projects/{project_id}/export/video',
            json={},
        )
        assert response.status_code == 400


@needs_app
class TestNarrationCRUD:
    """测试旁白 CRUD 接口"""

    def test_update_narration_page_not_found(self, client):
        response = client.put(
            '/api/projects/fake-project/pages/fake-page/narration',
            json={'narration_text': 'test'},
        )
        assert response.status_code == 404

    def test_update_narration_missing_field(self, client, sample_project):
        if not sample_project:
            pytest.skip("sample_project fixture returned None")
        project_id = sample_project.get('id') or sample_project.get('project_id')
        response = client.put(
            f'/api/projects/{project_id}/pages/fake-page/narration',
            json={'wrong_field': 'test'},
        )
        assert response.status_code in (400, 404)
