"""
TTS Video Service 单元测试

纯单元测试部分（不需要 Flask app 或完整依赖链）直接导入模块；
需要 app context 的集成测试使用 conftest 提供的 fixtures。
"""
import os
import sys
import pytest
import tempfile
import threading
import time
import uuid
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
check_ffmpeg_ass_filter_available = _tts_mod.check_ffmpeg_ass_filter_available
get_audio_duration = _tts_mod.get_audio_duration
KEN_BURNS_EFFECTS = _tts_mod.KEN_BURNS_EFFECTS
KEN_BURNS_MAX_ZOOM = _tts_mod.KEN_BURNS_MAX_ZOOM
composite_video = _tts_mod.composite_video
_run_ffmpeg_command = _tts_mod._run_ffmpeg_command
_wait_for_process_with_idle_watchdog = _tts_mod._wait_for_process_with_idle_watchdog
_split_narration_to_sentences = _tts_mod._split_narration_to_sentences
_build_timed_subtitle_entries = _tts_mod._build_timed_subtitle_entries
generate_ass_subtitle = _tts_mod.generate_ass_subtitle
burn_subtitles = _tts_mod.burn_subtitles
create_ken_burns_clip = _tts_mod.create_ken_burns_clip
_MAX_SUBTITLE_SEGMENT_LENGTH = _tts_mod._MAX_SUBTITLE_SEGMENT_LENGTH
_DEFAULT_SILENT_DURATION = _tts_mod._DEFAULT_SILENT_DURATION
_FFMPEG_IDLE_TIMEOUT_SECONDS = _tts_mod._FFMPEG_IDLE_TIMEOUT_SECONDS
get_narration_generation_prompt = _prompts_mod.get_narration_generation_prompt
normalize_narration_generation_config = _prompts_mod.normalize_narration_generation_config
parse_narration_generation_result = _prompts_mod.parse_narration_generation_result


# ═══════════════════════════════════════════════════════════════════════════════
# 纯单元测试（无外部依赖）
# ═══════════════════════════════════════════════════════════════════════════════


class TestModuleConstants:
    """测试模块级常量"""

    def test_max_subtitle_segment_length(self):
        assert _MAX_SUBTITLE_SEGMENT_LENGTH == 30

    def test_default_silent_duration(self):
        assert _DEFAULT_SILENT_DURATION == 3.0

    def test_ffmpeg_idle_timeout_seconds(self):
        assert _FFMPEG_IDLE_TIMEOUT_SECONDS == 120.0


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


class TestCheckFfmpegAssFilterAvailable:
    """测试 ASS 字幕滤镜可用性检查"""

    @patch.object(_tts_mod.subprocess, 'run')
    def test_ass_filter_available(self, mock_run):
        mock_run.return_value = MagicMock(
            stdout=" TSC ass              V->V       Render ASS subtitles onto input video using the libass library.\n",
            stderr='',
        )
        assert check_ffmpeg_ass_filter_available() is True

    @patch.object(_tts_mod.subprocess, 'run')
    def test_ass_filter_missing(self, mock_run):
        mock_run.return_value = MagicMock(
            stdout=" .. scale            V->V       Scale the input video size and/or convert the image format.\n",
            stderr='',
        )
        assert check_ffmpeg_ass_filter_available() is False

    @patch.object(_tts_mod.subprocess, 'run', side_effect=FileNotFoundError)
    def test_ass_filter_check_not_found(self, mock_run):
        assert check_ffmpeg_ass_filter_available() is False


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

    def test_zoom_strength_is_conservative(self):
        assert KEN_BURNS_MAX_ZOOM == pytest.approx(1.08)

    @pytest.mark.parametrize(
        ('effect_type', 'frame_index'),
        [
            ('zoom_in', -1),
            ('zoom_out', 0),
        ],
    )
    def test_zoom_effect_keeps_slide_corners_visible_with_real_ffmpeg(self, effect_type, frame_index):
        """真实 FFmpeg/OpenCV 验证：缩放动效不能把整张 slide 的四角裁掉。"""
        if not check_ffmpeg_available():
            pytest.skip("ffmpeg not available")

        cv2 = pytest.importorskip('cv2')
        pil_image = pytest.importorskip('PIL.Image')
        pil_draw = pytest.importorskip('PIL.ImageDraw')

        with tempfile.TemporaryDirectory() as tmpdir:
            image_path = os.path.join(tmpdir, 'source.png')
            video_path = os.path.join(tmpdir, f'{effect_type}.mp4')

            image = pil_image.new('RGB', (320, 180), 'white')
            draw = pil_draw.Draw(image)
            draw.rectangle((0, 0, 319, 179), outline=(255, 0, 0), width=18)
            image.save(image_path)

            create_ken_burns_clip(
                image_path,
                video_path,
                duration=0.6,
                width=320,
                height=180,
                fps=12,
                effect_type=effect_type,
            )

            capture = cv2.VideoCapture(video_path)
            frames = []
            while True:
                ok, frame = capture.read()
                if not ok:
                    break
                frames.append(frame)
            capture.release()

            assert frames, "Expected at least one rendered frame"
            frame = frames[frame_index]
            h, w = frame.shape[:2]
            corner_points = [(6, 6), (w - 7, 6), (6, h - 7), (w - 7, h - 7)]

            for x, y in corner_points:
                blue, green, red = frame[y, x]
                assert red > 120
                assert red > green + 40
                assert red > blue + 40


class TestCompositeVideoConcatFile:
    """测试 concat 列表生成"""

    @patch.object(_tts_mod, '_run_ffmpeg_command')
    def test_single_clip_copies(self, mock_run_ffmpeg):
        """单片段直接复制，不调用 ffmpeg"""
        with tempfile.NamedTemporaryFile(suffix='.mp4', delete=False) as src:
            src.write(b'fake video data')
            src_path = src.name

        try:
            out_path = src_path + '_out.mp4'
            composite_video([src_path], out_path)
            assert os.path.exists(out_path)
            mock_run_ffmpeg.assert_not_called()
        finally:
            for f in [src_path, out_path]:
                if os.path.exists(f):
                    os.unlink(f)

    @patch.object(_tts_mod, '_run_ffmpeg_command')
    def test_multiple_clips_concat(self, mock_run_ffmpeg):
        """多片段使用 concat demuxer"""
        clips = ['/fake/clip1.mp4', '/fake/clip2.mp4']
        out_path = '/tmp/test_concat_output.mp4'

        composite_video(clips, out_path)

        mock_run_ffmpeg.assert_called_once()
        args = mock_run_ffmpeg.call_args
        cmd = args[0][0]
        assert '-f' in cmd
        assert 'concat' in cmd


class _FakeProcess:
    """最小化的 Popen 替身，用于验证 idle watchdog。"""

    def __init__(self):
        read_fd, write_fd = os.pipe()
        self.stderr = os.fdopen(read_fd, 'rb', buffering=0)
        self._stderr_writer = os.fdopen(write_fd, 'wb', buffering=0)
        self.returncode = None
        self._killed = False
        self._thread = None

    def start(self, lines, interval=0.02, hold_open_seconds=0.0):
        def _writer():
            try:
                for line in lines:
                    self._stderr_writer.write(line.encode('utf-8') + b'\n')
                    self._stderr_writer.flush()
                    time.sleep(interval)
                if hold_open_seconds > 0:
                    time.sleep(hold_open_seconds)
            finally:
                self._stderr_writer.close()
                self.returncode = 0 if not self._killed else -9

        self._thread = threading.Thread(target=_writer, daemon=True)
        self._thread.start()

    def poll(self):
        return self.returncode

    def wait(self):
        if self._thread is not None:
            self._thread.join(timeout=1)
        return self.returncode

    def kill(self):
        self._killed = True
        self.returncode = -9
        try:
            self._stderr_writer.close()
        except OSError:
            pass


class TestIdleWatchdog:
    def test_wait_allows_long_running_process_with_output(self):
        proc = _FakeProcess()
        proc.start(['frame=1', 'frame=2', 'progress=end'], interval=0.02)

        _wait_for_process_with_idle_watchdog(
            proc,
            'FFmpeg failed',
            idle_timeout=0.1,
        )

        assert proc.returncode == 0

    def test_wait_kills_process_when_output_stalls(self):
        proc = _FakeProcess()
        proc.start([], interval=0.02, hold_open_seconds=0.2)

        with pytest.raises(RuntimeError, match='stalled after'):
            _wait_for_process_with_idle_watchdog(
                proc,
                'FFmpeg failed',
                idle_timeout=0.05,
            )

        assert proc.returncode == -9

    def test_concat_rejects_newline_in_path(self):
        """路径含换行符时应抛出 ValueError（防止 concat 注入）"""
        clips = ['/fake/clip1.mp4', '/fake/clip\n2.mp4']
        with pytest.raises(ValueError, match="newline"):
            composite_video(clips, '/tmp/test_output.mp4')

    def test_multiple_clips_concat_with_real_ffmpeg(self):
        """真实 FFmpeg 校验：长任务 watchdog 不影响正常 concat 完成。"""
        if not check_ffmpeg_available():
            pytest.skip("ffmpeg not available")

        with tempfile.TemporaryDirectory() as tmpdir:
            clip1 = os.path.join(tmpdir, 'clip1.mp4')
            clip2 = os.path.join(tmpdir, 'clip2.mp4')
            output = os.path.join(tmpdir, 'output.mp4')

            for clip, color in [(clip1, 'red'), (clip2, 'blue')]:
                subprocess_result = _tts_mod.subprocess.run(
                    [
                        'ffmpeg', '-y',
                        '-f', 'lavfi', '-i', f'color=c={color}:s=160x90:d=0.2',
                        '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo',
                        '-shortest',
                        '-c:v', 'libx264',
                        '-c:a', 'aac',
                        '-pix_fmt', 'yuv420p',
                        clip,
                    ],
                    capture_output=True,
                    text=True,
                    timeout=30,
                )
                assert subprocess_result.returncode == 0, subprocess_result.stderr

            composite_video([clip1, clip2], output, fps=25)

            assert os.path.exists(output)
            assert os.path.getsize(output) > 0


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


class TestBurnSubtitles:
    """测试字幕烧录命令构造"""

    @patch.object(_tts_mod, '_run_ffmpeg_command')
    @patch.object(_tts_mod, '_detect_cjk_font_dir', return_value=None)
    def test_uses_filename_option_and_escapes_path(self, mock_fonts_dir, mock_run_ffmpeg):
        burn_subtitles(
            '/tmp/input.mp4',
            "/tmp/demo:folder/it's,ok[1].ass",
            '/tmp/output.mp4',
        )

        mock_run_ffmpeg.assert_called_once()
        cmd = mock_run_ffmpeg.call_args.args[0]
        vf_value = cmd[cmd.index('-vf') + 1]
        assert vf_value == "ass=filename='/tmp/demo\\:folder/it\\'s\\,ok\\[1\\].ass'"

    @patch.object(_tts_mod, '_run_ffmpeg_command')
    @patch.object(_tts_mod, '_detect_cjk_font_dir', return_value='/some/fonts:dir')
    def test_appends_fontsdir_when_detected(self, mock_fonts_dir, mock_run_ffmpeg):
        burn_subtitles('/tmp/input.mp4', '/tmp/sub.ass', '/tmp/out.mp4')

        cmd = mock_run_ffmpeg.call_args.args[0]
        vf_value = cmd[cmd.index('-vf') + 1]
        assert vf_value.startswith("ass=filename='/tmp/sub.ass'")
        assert ":fontsdir='/some/fonts\\:dir'" in vf_value


class TestGenerateNarrationVideoPrerequisites:
    """测试视频导出前置依赖检查"""

    @patch.object(_tts_mod, 'check_ffmpeg_ass_filter_available', return_value=False)
    @patch.object(_tts_mod, 'check_ffmpeg_available', return_value=True)
    def test_fails_early_when_subtitles_required_but_ass_filter_missing(self, mock_ffmpeg, mock_ass):
        with pytest.raises(RuntimeError, match='ASS 字幕烧录'):
            _tts_mod.generate_narration_video(
                pages_data=[{
                    'image_path': '/tmp/fake.png',
                    'narration_text': '有旁白就需要字幕',
                    'page_index': 0,
                }],
                output_path='/tmp/out.mp4',
            )


class TestNarrationPrompt:
    """测试旁白 prompt 构建"""

    def test_prompt_contains_required_fields(self):
        prompt = get_narration_generation_prompt(
            pages=[{
                'page_index': 2,
                'title': 'AI 发展历程',
                'points': ['深度学习', '大语言模型'],
                'description_text': '这是一个关于人工智能发展的介绍页面',
            }],
            language='zh',
        )
        assert 'AI 发展历程' in prompt
        assert '深度学习' in prompt
        assert '大语言模型' in prompt
        assert '2' in prompt
        assert '中文' in prompt or '全中文' in prompt
        assert '<slide_description>' in prompt
        assert '</slide_description>' in prompt
        assert '<slide_title>' in prompt
        assert 'knowledgeable and patient university professor' in prompt
        assert 'the general public with no technical background' in prompt
        assert 'between 100 and 200 words' in prompt

    def test_english_prompt(self):
        prompt = get_narration_generation_prompt(
            pages=[{
                'page_index': 1,
                'title': 'ML Basics',
                'points': ['Supervised', 'Unsupervised'],
                'description_text': 'Introduction to machine learning',
            }],
            language='en',
        )
        assert 'English' in prompt

    def test_prompt_uses_custom_config(self):
        prompt = get_narration_generation_prompt(
            pages=[{
                'page_index': 1,
                'title': 'Nvidia Growth',
                'points': ['Revenue', 'Margin'],
                'description_text': 'Discussing business momentum',
            }],
            language='en',
            config={
                'speaker_persona': 'confident corporate executive',
                'target_audience': 'potential investors and venture capitalists',
                'speech_tone': 'inspiring, passionate, and persuasive',
                'presentation_topic': 'our company annual report',
                'min_words': 60,
                'max_words': 90,
            },
        )
        assert 'confident corporate executive' in prompt
        assert 'potential investors and venture capitalists' in prompt
        assert 'inspiring, passionate, and persuasive' in prompt
        assert 'our company annual report' in prompt
        assert 'between 60 and 90 words' in prompt

    def test_normalize_narration_config_clamps_and_defaults(self):
        config = normalize_narration_generation_config(
            {'min_words': '12', 'max_words': '500', 'presentation_topic': ' Quarterly review '},
            fallback_topic='fallback topic',
        )
        assert config['min_words'] == 30
        assert config['max_words'] == 300
        assert config['presentation_topic'] == 'Quarterly review'
        assert config['speaker_persona'] == 'knowledgeable and patient university professor'

    def test_parse_narration_generation_result(self):
        parsed = parse_narration_generation_result(
            "=== SLIDE 1 ===\nHello world\n=== SLIDE 2 ===\nSecond slide"
        )
        assert parsed == {1: 'Hello world', 2: 'Second slide'}


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

    def _create_project_with_image_page(self, app, allow_partial: bool):
        from PIL import Image
        from models import db, Project, Page

        project = Project(
            idea_prompt='视频导出测试',
            creation_type='idea',
            export_allow_partial=allow_partial,
            status='COMPLETED',
        )
        db.session.add(project)
        db.session.flush()

        pages_dir = os.path.join(app.config['UPLOAD_FOLDER'], project.id, 'pages')
        os.makedirs(pages_dir, exist_ok=True)

        filename = f'{uuid.uuid4()}.png'
        absolute_path = os.path.join(pages_dir, filename)
        Image.new('RGB', (640, 360), color='navy').save(absolute_path)

        page = Page(
            project_id=project.id,
            order_index=0,
            generated_image_path=f'{project.id}/pages/{filename}',
            outline_content='{"title": "测试页", "points": ["要点 1"]}',
            description_content='{"text": "测试描述"}',
            narration_text=None,
            status='COMPLETED',
        )
        db.session.add(page)
        db.session.commit()

        return project.id

    def _wait_for_task(self, client, project_id: str, task_id: str, timeout_seconds: float = 15.0):
        deadline = time.time() + timeout_seconds
        while time.time() < deadline:
            response = client.get(f'/api/projects/{project_id}/tasks/{task_id}')
            assert response.status_code == 200
            payload = response.get_json()['data']
            if payload['status'] in ('COMPLETED', 'FAILED'):
                return payload
            time.sleep(0.1)
        pytest.fail(f'Task {task_id} did not finish within {timeout_seconds} seconds')

    def test_export_video_project_not_found(self, client):
        response = client.post(
            '/api/projects/nonexistent-id/export/video',
            json={},
        )
        assert response.status_code == 404

    def test_export_video_returns_normalized_narration_config(self, client, app):
        project_id = self._create_project_with_image_page(app, allow_partial=True)
        response = client.post(
            f'/api/projects/{project_id}/export/video',
            json={
                'narration_config': {
                    'speaker_persona': 'confident corporate executive',
                    'min_words': 80,
                    'max_words': 120,
                },
            },
        )
        assert response.status_code == 200
        data = response.get_json()['data']
        assert data['narration_config']['speaker_persona'] == 'confident corporate executive'
        assert data['narration_config']['min_words'] == 80
        assert data['narration_config']['max_words'] == 120

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
    def test_export_video_without_partial_fails_when_narration_missing(self, client, app):
        if not check_ffmpeg_available():
            pytest.skip("ffmpeg not available")

        project_id = self._create_project_with_image_page(app, allow_partial=False)

        response = client.post(
            f'/api/projects/{project_id}/export/video',
            json={
                'generate_narration': False,
            },
        )
        assert response.status_code == 200
        task_id = response.get_json()['data']['task_id']

        task_payload = self._wait_for_task(client, project_id, task_id)
        assert task_payload['status'] == 'FAILED'
        assert '未开启“允许返回半成品”' in task_payload['error_message']
        assert '缺少旁白文本' in task_payload['error_message']

    @needs_app
    def test_export_video_with_partial_allows_silent_result(self, client, app):
        if not check_ffmpeg_available():
            pytest.skip("ffmpeg not available")

        project_id = self._create_project_with_image_page(app, allow_partial=True)

        response = client.post(
            f'/api/projects/{project_id}/export/video',
            json={
                'generate_narration': False,
            },
        )
        assert response.status_code == 200
        task_id = response.get_json()['data']['task_id']

        task_payload = self._wait_for_task(client, project_id, task_id)
        assert task_payload['status'] == 'COMPLETED'
        progress = task_payload['progress']
        assert progress['download_url'].endswith('.mp4')

        output_filename = progress['filename']
        output_path = os.path.join(app.config['UPLOAD_FOLDER'], project_id, 'exports', output_filename)
        assert os.path.exists(output_path)
        assert os.path.getsize(output_path) > 0


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
