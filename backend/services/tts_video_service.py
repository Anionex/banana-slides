"""
TTS Video Service — 将 PPT 页面转换为带旁白的播报视频

功能:
  1. edge-tts 文本转语音
  2. Ken Burns 动效（zoompan，可选）
  3. FFmpeg 视频合成与拼接
  4. ASS 字幕烧录
"""
import asyncio
import logging
import os
import re
import shutil
import subprocess
from typing import List, Optional, Callable

logger = logging.getLogger(__name__)

# ═══════════════════════════════════════════════════════════════════════════════
# 模块级常量
# ═══════════════════════════════════════════════════════════════════════════════

# 字幕单段最大字符数，超过此长度的句子将按次级标点二次拆分
_MAX_SUBTITLE_SEGMENT_LENGTH = 30

# 无旁白页面的默认静音片段时长（秒）
_DEFAULT_SILENT_DURATION = 3.0


def create_placeholder_frame(
    output_path: str,
    title: str = '',
    width: int = 1920,
    height: int = 1080,
    ffmpeg_path: str = 'ffmpeg',
) -> None:
    """
    为没有图片的页面生成占位帧图片（深色渐变背景 + 标题文字）。

    使用 FFmpeg 纯滤镜生成，不需要外部图片资源。
    """
    # 清理标题中的特殊字符，防止 FFmpeg drawtext 解析错误
    safe_title = title.replace("'", "'").replace(":", "\\:").replace("\\", "\\\\")
    safe_title = safe_title[:60]  # 限制长度

    font_size = max(36, int(height / 20))

    # 检测可用的 CJK 字体文件路径
    font_file = _detect_cjk_font_file()
    if font_file:
        drawtext = (
            f"drawtext=text='{safe_title}':"
            f"fontfile='{font_file}':"
            f"fontsize={font_size}:fontcolor=white:"
            f"x=(w-text_w)/2:y=(h-text_h)/2"
        )
    else:
        drawtext = (
            f"drawtext=text='{safe_title}':"
            f"fontsize={font_size}:fontcolor=white:"
            f"x=(w-text_w)/2:y=(h-text_h)/2"
        )

    # 渐变深色背景 + 居中白色标题
    vf = (
        f"color=c=#1a1a2e:s={width}x{height}:d=1,"
        f"format=rgb24,{drawtext}"
    )

    cmd = [
        ffmpeg_path, '-y',
        '-f', 'lavfi',
        '-i', vf,
        '-frames:v', '1',
        '-update', '1',
        output_path,
    ]

    result = subprocess.run(cmd, capture_output=True, text=True, timeout=15)
    if result.returncode != 0:
        # fallback: 纯色背景（无文字）
        logger.warning(f"Placeholder with text failed, using plain background: {result.stderr[-200:]}")
        vf_plain = f"color=c=#1a1a2e:s={width}x{height}:d=1"
        cmd_plain = [
            ffmpeg_path, '-y',
            '-f', 'lavfi',
            '-i', vf_plain,
            '-frames:v', '1',
            '-update', '1',
            output_path,
        ]
        result2 = subprocess.run(cmd_plain, capture_output=True, text=True, timeout=15)
        if result2.returncode != 0:
            raise RuntimeError(f"FFmpeg placeholder frame failed: {result2.stderr[-300:]}")


def _detect_cjk_font_file() -> Optional[str]:
    """检测系统中 CJK 字体文件路径（用于 FFmpeg drawtext fontfile）"""
    # 常见 CJK 字体文件路径
    candidates = [
        '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc',
        '/usr/share/fonts/noto-cjk/NotoSansCJK-Regular.ttc',
        '/usr/share/fonts/google-noto-cjk/NotoSansCJK-Regular.ttc',
        '/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc',
        '/usr/share/fonts/opentype/noto/NotoSerifCJK-Regular.ttc',
    ]
    for path in candidates:
        if os.path.exists(path):
            return path

    # 用 fc-match 查找
    try:
        result = subprocess.run(
            ['fc-match', '-f', '%{file}', ':lang=zh'],
            capture_output=True, text=True, timeout=5,
        )
        path = result.stdout.strip()
        if path and os.path.exists(path):
            return path
    except Exception:
        pass

    return None


# ═══════════════════════════════════════════════════════════════════════════════
# 辅助函数
# ═══════════════════════════════════════════════════════════════════════════════


def check_ffmpeg_available(ffmpeg_path: str = 'ffmpeg') -> bool:
    """检查 ffmpeg 是否可用"""
    try:
        subprocess.run(
            [ffmpeg_path, '-version'],
            capture_output=True, check=True, timeout=5,
        )
        return True
    except (FileNotFoundError, subprocess.CalledProcessError, subprocess.TimeoutExpired, OSError):
        return False


def get_audio_duration(audio_path: str, ffmpeg_path: str = 'ffmpeg') -> float:
    """使用 ffprobe 获取音频时长（秒）"""
    ffprobe_path = ffmpeg_path.replace('ffmpeg', 'ffprobe')
    cmd = [
        ffprobe_path, '-v', 'quiet',
        '-show_entries', 'format=duration',
        '-of', 'default=noprint_wrappers=1:nokey=1',
        audio_path,
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, check=True, timeout=10)
    return float(result.stdout.strip())


def get_default_voice(language: str, config: Optional[dict] = None) -> str:
    """根据语言返回默认 TTS 语音名称"""
    defaults = {
        'zh': 'zh-CN-XiaoxiaoNeural',
        'en': 'en-US-JennyNeural',
        'ja': 'ja-JP-NanamiNeural',
    }
    if config:
        voice_map = {
            'zh': config.get('TTS_DEFAULT_VOICE_ZH', defaults['zh']),
            'en': config.get('TTS_DEFAULT_VOICE_EN', defaults['en']),
            'ja': config.get('TTS_DEFAULT_VOICE_JA', defaults['ja']),
        }
        return voice_map.get(language, voice_map['zh'])
    return defaults.get(language, defaults['zh'])


# ═══════════════════════════════════════════════════════════════════════════════
# TTS 语音合成
# ═══════════════════════════════════════════════════════════════════════════════


async def _generate_tts_async(text: str, output_path: str, voice: str, rate: str) -> None:
    """edge-tts 异步语音合成"""
    import edge_tts
    communicate = edge_tts.Communicate(text, voice, rate=rate)
    await communicate.save(output_path)


def generate_tts_audio_sync(
    text: str,
    output_path: str,
    voice: str = 'zh-CN-XiaoxiaoNeural',
    rate: str = '+0%',
    ffmpeg_path: str = 'ffmpeg',
) -> float:
    """
    同步封装：生成 TTS 音频文件。

    Args:
        text: 待合成的文本
        output_path: 输出音频文件路径（MP3）
        voice: edge-tts 语音名称
        rate: 语速调整
        ffmpeg_path: ffmpeg 路径（用于 ffprobe 获取时长）

    Returns:
        float: 音频时长（秒）
    """
    loop = asyncio.new_event_loop()
    try:
        loop.run_until_complete(_generate_tts_async(text, output_path, voice, rate))
    finally:
        loop.close()

    duration = get_audio_duration(output_path, ffmpeg_path)
    logger.debug(f"TTS audio generated: {output_path} ({duration:.1f}s)")
    return duration


# ═══════════════════════════════════════════════════════════════════════════════
# Ken Burns 动效
# ═══════════════════════════════════════════════════════════════════════════════

# 四种交替动效
KEN_BURNS_EFFECTS = ['zoom_in', 'zoom_out', 'pan_left', 'pan_right']


def _prepare_canvas(src, content_w: int, content_h: int, canvas_w: int, canvas_h: int):
    """将任意画幅的图片 contain 到 content 区域，居中放置在 canvas 上，空白用高斯模糊填充。

    content_w/h: 内容区域（zoom=1.0 时可见的区域）
    canvas_w/h: 画布总尺寸（包含动效余量）
    """
    import cv2

    sh, sw = src.shape[:2]

    bg = cv2.resize(src, (canvas_w, canvas_h), interpolation=cv2.INTER_LINEAR)
    ksize = max(canvas_w, canvas_h) // 10 | 1
    bg = cv2.GaussianBlur(bg, (ksize, ksize), 0)

    scale = min(content_w / sw, content_h / sh)
    new_w = int(sw * scale)
    new_h = int(sh * scale)
    fg = cv2.resize(src, (new_w, new_h), interpolation=cv2.INTER_LANCZOS4)

    x_off = (canvas_w - new_w) // 2
    y_off = (canvas_h - new_h) // 2
    bg[y_off:y_off + new_h, x_off:x_off + new_w] = fg
    return bg


def create_ken_burns_clip(
    image_path: str,
    output_path: str,
    duration: float,
    width: int = 1920,
    height: int = 1080,
    fps: int = 25,
    effect_type: str = 'zoom_in',
    ffmpeg_path: str = 'ffmpeg',
    timeout: int = 120,
) -> None:
    """OpenCV 逐帧渲染 Ken Burns 动效，pipe rawvideo 给 FFmpeg 编码。
    用 _prepare_canvas 适配任意画幅，getRectSubPix 实现浮点精度裁切。"""
    import cv2

    total_frames = max(int(duration * fps), 1)
    src = cv2.imread(image_path)
    if src is None:
        raise FileNotFoundError(f"Cannot read image: {image_path}")

    max_zoom = 1.15
    pan_zoom = 1.1
    canvas_scale = max(max_zoom, pan_zoom)
    canvas_w = int(width * canvas_scale)
    canvas_h = int(height * canvas_scale)
    img = _prepare_canvas(src, width, height, canvas_w, canvas_h)
    ih, iw = img.shape[:2]

    cmd = [
        ffmpeg_path, '-y',
        '-f', 'rawvideo', '-pix_fmt', 'bgr24',
        '-s', f'{width}x{height}', '-r', str(fps),
        '-i', 'pipe:0',
        '-t', str(duration),
        '-c:v', 'libx264', '-pix_fmt', 'yuv420p',
        '-preset', 'medium', '-crf', '23',
        '-movflags', '+faststart',
        output_path,
    ]

    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE)

    try:
        for i in range(total_frames):
            t = i / max(total_frames - 1, 1)

            if effect_type == 'zoom_in':
                z = 1.0 + (max_zoom - 1.0) * t
                cx, cy = iw / 2.0, ih / 2.0
            elif effect_type == 'zoom_out':
                z = max_zoom - (max_zoom - 1.0) * t
                cx, cy = iw / 2.0, ih / 2.0
            elif effect_type == 'pan_right':
                z = 1.0
                margin = iw - width
                cx = width / 2.0 + margin * t
                cy = ih / 2.0
            elif effect_type == 'pan_left':
                z = 1.0
                margin = iw - width
                cx = iw - width / 2.0 - margin * t
                cy = ih / 2.0
            else:
                z = 1.0 + (max_zoom - 1.0) * t
                cx, cy = iw / 2.0, ih / 2.0

            crop_w = width / z
            crop_h = height / z
            cx = max(crop_w / 2.0, min(cx, iw - crop_w / 2.0))
            cy = max(crop_h / 2.0, min(cy, ih - crop_h / 2.0))

            patch = cv2.getRectSubPix(img, (int(crop_w + 0.5), int(crop_h + 0.5)), (cx, cy))
            frame = cv2.resize(patch, (width, height), interpolation=cv2.INTER_LINEAR)
            proc.stdin.write(frame.tobytes())

        proc.stdin.close()
        proc.wait(timeout=timeout)
        if proc.returncode != 0:
            raise RuntimeError(f"FFmpeg failed for Ken Burns clip: {proc.stderr.read().decode()[-500:]}")
    except Exception:
        proc.kill()
        proc.wait()
        raise


def create_silent_clip(
    image_path: str,
    output_path: str,
    duration: float = 3.0,
    width: int = 1920,
    height: int = 1080,
    fps: int = 25,
    effect_type: str = 'zoom_in',
    enable_ken_burns: bool = True,
    ffmpeg_path: str = 'ffmpeg',
    timeout: int = 60,
) -> None:
    """创建无声视频片段（用于没有旁白的页面）"""
    if enable_ken_burns:
        tmp_video = output_path + '.tmp.mp4'
        create_ken_burns_clip(
            image_path, tmp_video, duration,
            width=width, height=height, fps=fps,
            effect_type=effect_type, ffmpeg_path=ffmpeg_path, timeout=timeout,
        )
        cmd = [
            ffmpeg_path, '-y',
            '-i', tmp_video,
            '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo',
            '-c:v', 'copy', '-c:a', 'aac', '-shortest',
            '-movflags', '+faststart',
            output_path,
        ]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
        os.remove(tmp_video)
        if result.returncode != 0:
            raise RuntimeError(f"FFmpeg failed for silent clip: {result.stderr[-500:]}")
    else:
        vf = f"scale={width}:{height}:force_original_aspect_ratio=decrease,pad={width}:{height}:(ow-iw)/2:(oh-ih)/2"
        cmd = [
            ffmpeg_path, '-y',
            '-loop', '1',
            '-i', image_path,
            '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo',
            '-vf', vf,
            '-t', str(duration),
            '-r', str(fps),
            '-c:v', 'libx264', '-c:a', 'aac',
            '-pix_fmt', 'yuv420p',
            '-preset', 'medium', '-crf', '23',
            '-shortest', '-movflags', '+faststart',
            output_path,
        ]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
        if result.returncode != 0:
            raise RuntimeError(f"FFmpeg failed for silent clip: {result.stderr[-500:]}")


def create_static_clip(
    image_path: str,
    output_path: str,
    duration: float,
    width: int = 1920,
    height: int = 1080,
    fps: int = 25,
    ffmpeg_path: str = 'ffmpeg',
    timeout: int = 120,
) -> None:
    """从单张图片创建静态视频片段（无动效）"""
    vf = f"scale={width}:{height}:force_original_aspect_ratio=decrease,pad={width}:{height}:(ow-iw)/2:(oh-ih)/2"

    cmd = [
        ffmpeg_path, '-y',
        '-loop', '1',
        '-i', image_path,
        '-vf', vf,
        '-t', str(duration),
        '-r', str(fps),
        '-c:v', 'libx264',
        '-pix_fmt', 'yuv420p',
        '-preset', 'medium',
        '-crf', '23',
        '-movflags', '+faststart',
        output_path,
    ]

    logger.debug(f"Static clip: {duration:.1f}s, {width}x{height}")
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
    if result.returncode != 0:
        raise RuntimeError(f"FFmpeg failed for static clip: {result.stderr[-500:]}")


# ═══════════════════════════════════════════════════════════════════════════════
# 字幕生成与烧录
# ═══════════════════════════════════════════════════════════════════════════════


def _format_ass_time(seconds: float) -> str:
    """将秒数格式化为 ASS 时间格式 H:MM:SS.cc"""
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = int(seconds % 60)
    cs = int((seconds % 1) * 100)
    return f"{h}:{m:02d}:{s:02d}.{cs:02d}"


def _split_narration_to_sentences(text: str) -> List[str]:
    """
    将旁白文本按句拆分。
    优先按中/英文句号、问号、叹号等断句，
    过长的分句再按逗号/顿号二次拆分。
    """
    # 先按主要句末标点断句（保留标点在前一句末尾）
    raw_parts = re.split(r'(?<=[。！？!?\n])', text.strip())
    sentences = [p.strip() for p in raw_parts if p.strip()]

    # 对超长句子按逗号等次级标点二次拆分
    result = []
    for sent in sentences:
        if len(sent) <= _MAX_SUBTITLE_SEGMENT_LENGTH:
            result.append(sent)
            continue
        # 按逗号、分号、顿号拆分
        sub_parts = re.split(r'(?<=[，；、,;])', sent)
        current = ''
        for part in sub_parts:
            if len(current) + len(part) <= _MAX_SUBTITLE_SEGMENT_LENGTH:
                current += part
            else:
                if current:
                    result.append(current)
                # 单段还是超长就硬切
                while len(part) > _MAX_SUBTITLE_SEGMENT_LENGTH:
                    result.append(part[:_MAX_SUBTITLE_SEGMENT_LENGTH])
                    part = part[_MAX_SUBTITLE_SEGMENT_LENGTH:]
                current = part
        if current:
            result.append(current)

    return result if result else [text.strip()]


def _build_timed_subtitle_entries(
    narration_text: str,
    page_start: float,
    page_duration: float,
) -> List[dict]:
    """
    将一页的旁白文本拆分为按时间均匀分配的字幕条目。

    每个条目的时长与其字符数成正比，实现"跟读"效果。
    """
    sentences = _split_narration_to_sentences(narration_text)
    if not sentences:
        return []

    total_chars = sum(len(s) for s in sentences)
    if total_chars == 0:
        return []

    entries = []
    t = page_start
    for sent in sentences:
        # 按字符比例分配时长，至少 0.8 秒
        seg_duration = max(0.8, page_duration * len(sent) / total_chars)
        entries.append({
            'start': t,
            'end': t + seg_duration,
            'text': sent,
        })
        t += seg_duration

    # 修正最后一条对齐到页面结束时间
    if entries:
        entries[-1]['end'] = page_start + page_duration

    return entries


def _detect_cjk_font() -> str:
    """检测系统中可用的 CJK 字体名称，优先选简体中文字体"""
    preferred = [
        'Noto Sans CJK SC', 'Noto Serif CJK SC',
        'Source Han Sans SC', 'Source Han Serif SC',
        'WenQuanYi Micro Hei', 'Microsoft YaHei',
        'PingFang SC', 'SimHei',
    ]
    try:
        result = subprocess.run(
            ['fc-list', ':lang=zh', '-f', '%{family}\\n'],
            capture_output=True, text=True, timeout=5,
        )
        available = set()
        for line in result.stdout.strip().split('\n'):
            for name in line.strip().split(','):
                available.add(name.strip())
        # 按优先级选择
        for name in preferred:
            if name in available:
                return name
        # 没匹配到优选的，返回第一个可用字体
        for name in available:
            if name:
                return name
    except Exception:
        pass
    return 'Noto Sans CJK SC'


def generate_ass_subtitle(
    subtitle_entries: List[dict],
    output_path: str,
    width: int = 1920,
    height: int = 1080,
    font_size: int = 0,
) -> None:
    """
    生成 ASS 字幕文件（带半透明底栏，CJK 字体）。

    Args:
        subtitle_entries: 字幕条目列表，每项含 start/end/text
        output_path: 输出 ASS 文件路径
        width: 视频宽度
        height: 视频高度
        font_size: 字幕字号，0 表示自动按分辨率计算
    """
    if font_size <= 0:
        font_size = max(28, int(height / 25))  # 1080p → 43

    font_name = _detect_cjk_font()
    margin_v = max(40, int(height / 18))  # 底部边距
    outline = max(2, int(font_size / 16))
    shadow = 1
    spacing = 1  # 字间距

    # ASS 颜色格式：&HAABBGGRR（注意是 BGR 顺序）
    # PrimaryColour: 白色 &H00FFFFFF
    # OutlineColour: 深灰 &H00202020 (轮廓)
    # BackColour:    半透明黑 &H96000000 (阴影/背景)
    # BorderStyle=3 表示使用 BackColour 作为背景框

    header = f"""[Script Info]
Title: Narration Subtitles
ScriptType: v4.00+
PlayResX: {width}
PlayResY: {height}
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,{font_name},{font_size},&H00FFFFFF,&H000000FF,&H00202020,&H96000000,-1,0,0,0,100,100,{spacing},0,3,{outline},{shadow},2,50,50,{margin_v},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""

    with open(output_path, 'w', encoding='utf-8-sig') as f:
        f.write(header)
        for entry in subtitle_entries:
            start = _format_ass_time(entry['start'])
            end = _format_ass_time(entry['end'])
            # 清理文本中的换行
            text = entry['text'].replace('\n', ' ').replace('\r', '')
            f.write(f"Dialogue: 0,{start},{end},Default,,0,0,0,,{text}\n")


def burn_subtitles(
    video_path: str,
    subtitle_path: str,
    output_path: str,
    ffmpeg_path: str = 'ffmpeg',
    timeout: int = 300,
) -> None:
    """将 ASS 字幕烧录到视频中"""
    # fontsdir 让 libass 知道系统字体位置
    escaped_sub = subtitle_path.replace('\\', '/').replace(':', '\\:').replace("'", "\\'")

    cmd = [
        ffmpeg_path, '-y',
        '-i', video_path,
        '-vf', f"ass='{escaped_sub}'",
        '-c:v', 'libx264',
        '-c:a', 'copy',
        '-pix_fmt', 'yuv420p',
        '-preset', 'medium',
        '-crf', '23',
        '-movflags', '+faststart',
        output_path,
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
    if result.returncode != 0:
        raise RuntimeError(f"FFmpeg subtitle burn failed: {result.stderr[-500:]}")


# ═══════════════════════════════════════════════════════════════════════════════
# 视频合成
# ═══════════════════════════════════════════════════════════════════════════════


def mux_video_audio(
    video_path: str,
    audio_path: str,
    output_path: str,
    ffmpeg_path: str = 'ffmpeg',
    timeout: int = 60,
) -> None:
    """将视频和音频合并为一个 MP4 文件"""
    cmd = [
        ffmpeg_path, '-y',
        '-i', video_path,
        '-i', audio_path,
        '-c:v', 'copy',
        '-c:a', 'aac',
        '-shortest',
        '-movflags', '+faststart',
        output_path,
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
    if result.returncode != 0:
        raise RuntimeError(f"FFmpeg mux failed: {result.stderr[-500:]}")


def composite_video(
    clip_paths: List[str],
    output_path: str,
    fps: int = 25,
    ffmpeg_path: str = 'ffmpeg',
    timeout: int = 300,
) -> None:
    """
    使用 FFmpeg concat demuxer 将多个视频片段拼接为最终 MP4。

    Args:
        clip_paths: 各页合并后的视频片段路径列表
        output_path: 最终输出 MP4 路径
        fps: 帧率（确保拼接后一致）
        ffmpeg_path: ffmpeg 路径
        timeout: 超时秒数
    """
    if len(clip_paths) == 1:
        # 单片段直接复制
        shutil.copy2(clip_paths[0], output_path)
        return

    # 创建 concat 列表文件 — 使用绝对路径并验证文件确实存在于临时目录
    concat_file = output_path + '.concat.txt'
    try:
        with open(concat_file, 'w') as f:
            for path in clip_paths:
                # 安全检查：路径不能包含换行符（防止 concat 文件注入）
                safe_path = os.path.abspath(path)
                if '\n' in safe_path or '\r' in safe_path:
                    raise ValueError(f"Invalid clip path contains newline: {safe_path}")
                # 转义单引号
                escaped = safe_path.replace("'", "'\\''")
                f.write(f"file '{escaped}'\n")

        cmd = [
            ffmpeg_path, '-y',
            '-f', 'concat',
            '-safe', '0',
            '-i', concat_file,
            '-c:v', 'libx264',
            '-c:a', 'aac',
            '-r', str(fps),
            '-pix_fmt', 'yuv420p',
            '-preset', 'medium',
            '-crf', '23',
            '-movflags', '+faststart',
            output_path,
        ]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
        if result.returncode != 0:
            raise RuntimeError(f"FFmpeg concat failed: {result.stderr[-500:]}")
    finally:
        if os.path.exists(concat_file):
            os.remove(concat_file)

    logger.info(f"Final video composited: {output_path}")


# ═══════════════════════════════════════════════════════════════════════════════
# 完整流水线
# ═══════════════════════════════════════════════════════════════════════════════


def generate_narration_video(
    pages_data: List[dict],
    output_path: str,
    voice: str = 'zh-CN-XiaoxiaoNeural',
    rate: str = '+0%',
    width: int = 1920,
    height: int = 1080,
    fps: int = 25,
    enable_ken_burns: bool = False,
    ffmpeg_path: str = 'ffmpeg',
    progress_callback: Optional[Callable[[str, str, int], None]] = None,
    silent_duration: float = 0,
) -> None:
    """
    完整的播报视频生成流水线。

    Args:
        pages_data: 页面数据列表，每项包含:
            - image_path: str  幻灯片图片路径
            - narration_text: str | None  旁白文本
            - page_index: int  页码（从 0 开始）
        output_path: 最终 MP4 输出路径
        voice: TTS 语音
        rate: 语速
        width: 视频宽度
        height: 视频高度
        fps: 帧率
        enable_ken_burns: 是否启用 Ken Burns 动效（默认关闭）
        ffmpeg_path: ffmpeg 路径
        progress_callback: 进度回调 (step, message, percent)
        silent_duration: 无旁白页面的静音时长（秒），0 表示使用默认值
    """
    if not pages_data:
        raise ValueError("No pages to process")

    # 检查 ffmpeg
    if not check_ffmpeg_available(ffmpeg_path):
        raise RuntimeError(
            "FFmpeg is not installed or not found in PATH. "
            "Please install FFmpeg to use video export."
        )

    if silent_duration <= 0:
        silent_duration = _DEFAULT_SILENT_DURATION

    tmp_dir = output_path + '_tmp'
    os.makedirs(tmp_dir, exist_ok=True)

    try:
        total = len(pages_data)
        muxed_clips: List[str] = []
        subtitle_entries: List[dict] = []
        cumulative_time = 0.0

        # ── Phase A: TTS 音频生成 ──
        # 先统一生成所有 TTS 音频，获取每页实际时长
        page_durations: List[float] = []
        audio_paths: List[Optional[str]] = []

        for i, page in enumerate(pages_data):
            narration = page.get('narration_text')

            audio_path = None
            duration = silent_duration
            if narration and narration.strip():
                audio_path = os.path.join(tmp_dir, f'audio_{i:03d}.mp3')
                try:
                    duration = generate_tts_audio_sync(
                        narration, audio_path, voice=voice, rate=rate, ffmpeg_path=ffmpeg_path,
                    )
                except Exception as e:
                    logger.warning(f"TTS failed for page {page.get('page_index', i)}: {e}, using silent clip")
                    audio_path = None
                    duration = silent_duration

            page_durations.append(duration)
            audio_paths.append(audio_path)

            if progress_callback:
                pct = int(20 + (i + 1) / total * 30)  # 20-50%
                progress_callback("TTS", f"已生成第 {i+1}/{total} 页音频", pct)

        # ── Phase B: 视频片段 + 字幕条目 ──
        for i, page in enumerate(pages_data):
            image_path = page['image_path']
            narration = page.get('narration_text')
            page_idx = page.get('page_index', i)
            effect = KEN_BURNS_EFFECTS[page_idx % len(KEN_BURNS_EFFECTS)]
            duration = page_durations[i]
            audio_path = audio_paths[i]

            # 收集字幕条目
            if narration and narration.strip() and audio_path:
                page_subs = _build_timed_subtitle_entries(
                    narration.strip(), cumulative_time, duration,
                )
                subtitle_entries.extend(page_subs)
            cumulative_time += duration

            if audio_path:
                video_clip = os.path.join(tmp_dir, f'video_{i:03d}.mp4')
                if enable_ken_burns:
                    create_ken_burns_clip(
                        image_path, video_clip, duration,
                        width=width, height=height, fps=fps,
                        effect_type=effect, ffmpeg_path=ffmpeg_path,
                    )
                else:
                    create_static_clip(
                        image_path, video_clip, duration,
                        width=width, height=height, fps=fps,
                        ffmpeg_path=ffmpeg_path,
                    )

                # Mux video + audio
                muxed_path = os.path.join(tmp_dir, f'muxed_{i:03d}.mp4')
                mux_video_audio(video_clip, audio_path, muxed_path, ffmpeg_path=ffmpeg_path)
                muxed_clips.append(muxed_path)
            else:
                # 静音片段（含无声音轨以保证 concat 兼容）
                silent_path = os.path.join(tmp_dir, f'silent_{i:03d}.mp4')
                create_silent_clip(
                    image_path, silent_path, duration=duration,
                    width=width, height=height, fps=fps,
                    effect_type=effect, enable_ken_burns=enable_ken_burns,
                    ffmpeg_path=ffmpeg_path,
                )
                muxed_clips.append(silent_path)

            if progress_callback:
                pct = int(50 + (i + 1) / total * 30)  # 50-80%
                progress_callback("视频", f"已生成第 {i+1}/{total} 页视频片段", pct)

        # ── Phase C: 拼接视频 ──
        if progress_callback:
            progress_callback("合成", "正在拼接视频…", 82)

        raw_video = os.path.join(tmp_dir, 'raw_composite.mp4')
        composite_video(muxed_clips, raw_video, fps=fps, ffmpeg_path=ffmpeg_path)

        # ── Phase D: 烧录字幕 ──
        if subtitle_entries:
            if progress_callback:
                progress_callback("字幕", "正在烧录字幕…", 88)

            ass_path = os.path.join(tmp_dir, 'subtitles.ass')
            generate_ass_subtitle(subtitle_entries, ass_path, width=width, height=height)
            burn_subtitles(raw_video, ass_path, output_path, ffmpeg_path=ffmpeg_path)
        else:
            shutil.copy2(raw_video, output_path)

        if progress_callback:
            progress_callback("完成", "视频导出完成", 100)

    finally:
        # 清理临时目录
        if os.path.exists(tmp_dir):
            shutil.rmtree(tmp_dir, ignore_errors=True)
