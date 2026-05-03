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
import queue
import re
import shutil
import subprocess
import threading
import time
import unicodedata
from typing import List, Optional, Callable, Tuple

logger = logging.getLogger(__name__)

# ═══════════════════════════════════════════════════════════════════════════════
# 模块级常量
# ═══════════════════════════════════════════════════════════════════════════════

# 字幕单段最大字符数，超过此长度的句子将按次级标点二次拆分
_MAX_SUBTITLE_SEGMENT_LENGTH = 30

# 无旁白页面的默认静音片段时长（秒）
_DEFAULT_SILENT_DURATION = 3.0

# 整片头/尾的静音 padding（秒），避免播放器开场吃掉首词、结尾被截断
_LEADING_PAD_SECONDS = 0.8
_TRAILING_PAD_SECONDS = 1.2

# FFmpeg 连续多久没有任何输出才视为卡死
_FFMPEG_IDLE_TIMEOUT_SECONDS = 120.0

# 进度输出频率（秒）
_FFMPEG_PROGRESS_INTERVAL_SECONDS = 1.0


def _inject_ffmpeg_progress_args(cmd: List[str]) -> List[str]:
    """为 FFmpeg 命令追加进度输出，便于 idle watchdog 判断进程是否卡死。"""
    if '-progress' in cmd:
        return cmd
    return [
        cmd[0],
        '-nostats',
        '-progress', 'pipe:2',
        '-stats_period', str(_FFMPEG_PROGRESS_INTERVAL_SECONDS),
        *cmd[1:],
    ]


def _read_process_lines(stream, output_queue: "queue.Queue[str]", collected_lines: List[str]) -> None:
    """后台读取 stderr，既用于错误回溯，也用于 watchdog 判断是否仍有进展。"""
    try:
        for raw_line in iter(stream.readline, b''):
            line = raw_line.decode('utf-8', errors='replace').strip()
            if not line:
                continue
            collected_lines.append(line)
            if len(collected_lines) > 200:
                del collected_lines[:len(collected_lines) - 200]
            output_queue.put(line)
    finally:
        stream.close()


def _wait_for_process_with_idle_watchdog(
    proc: subprocess.Popen,
    error_prefix: str,
    idle_timeout: float = _FFMPEG_IDLE_TIMEOUT_SECONDS,
) -> None:
    """
    等待 FFmpeg 结束。

    不限制总执行时长，只要 stderr/progress 持续有输出就继续等待；
    连续 idle_timeout 秒没有任何新输出，才认为进程卡死。
    """
    stderr_queue: "queue.Queue[str]" = queue.Queue()
    stderr_lines: List[str] = []
    reader = threading.Thread(
        target=_read_process_lines,
        args=(proc.stderr, stderr_queue, stderr_lines),
        daemon=True,
    )
    reader.start()

    last_output_at = time.monotonic()
    poll_interval = min(1.0, max(0.01, idle_timeout / 4))

    while True:
        try:
            stderr_queue.get(timeout=poll_interval)
            last_output_at = time.monotonic()
        except queue.Empty:
            pass

        if proc.poll() is not None:
            break

        if time.monotonic() - last_output_at > idle_timeout:
            proc.kill()
            proc.wait()
            reader.join(timeout=1)
            tail = '\n'.join(stderr_lines[-20:])
            raise RuntimeError(
                f"{error_prefix}: FFmpeg stalled after {int(idle_timeout)}s without progress. "
                f"Last output: {tail[-500:]}"
            )

    reader.join(timeout=1)

    if proc.returncode != 0:
        tail = '\n'.join(stderr_lines[-20:])
        raise RuntimeError(f"{error_prefix}: {tail[-500:]}")


def _run_ffmpeg_command(
    cmd: List[str],
    error_prefix: str,
    idle_timeout: float = _FFMPEG_IDLE_TIMEOUT_SECONDS,
) -> None:
    """运行 FFmpeg 命令，仅在无进展卡死时中止，不设置总超时。"""
    proc = subprocess.Popen(
        _inject_ffmpeg_progress_args(cmd),
        stdout=subprocess.DEVNULL,
        stderr=subprocess.PIPE,
    )
    _wait_for_process_with_idle_watchdog(proc, error_prefix, idle_timeout=idle_timeout)


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


def check_ffmpeg_ass_filter_available(ffmpeg_path: str = 'ffmpeg') -> bool:
    """检查 ffmpeg 是否支持 ASS 字幕烧录滤镜。"""
    try:
        result = subprocess.run(
            [ffmpeg_path, '-hide_banner', '-filters'],
            capture_output=True, text=True, check=True, timeout=5,
        )
    except (FileNotFoundError, subprocess.CalledProcessError, subprocess.TimeoutExpired, OSError):
        return False

    filter_listing = f"{result.stdout}\n{result.stderr}"
    return re.search(r'^\s*[TSC\.|]+\s+ass\s+', filter_listing, re.MULTILINE) is not None


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


def pad_audio_with_silence(
    src_path: str,
    dst_path: str,
    leading_seconds: float = 0.0,
    trailing_seconds: float = 0.0,
    ffmpeg_path: str = 'ffmpeg',
) -> float:
    """在音频两端追加静音，返回新音频时长。"""
    if leading_seconds <= 0 and trailing_seconds <= 0:
        shutil.copy2(src_path, dst_path)
        return get_audio_duration(dst_path, ffmpeg_path)

    filters: List[str] = []
    if leading_seconds > 0:
        filters.append(f'adelay={int(leading_seconds * 1000)}|{int(leading_seconds * 1000)}:all=1')
    if trailing_seconds > 0:
        filters.append(f'apad=pad_dur={trailing_seconds}')

    cmd = [
        ffmpeg_path, '-y',
        '-i', src_path,
        '-af', ','.join(filters),
        '-c:a', 'libmp3lame', '-b:a', '128k',
        dst_path,
    ]
    _run_ffmpeg_command(cmd, "FFmpeg failed to pad audio")
    return get_audio_duration(dst_path, ffmpeg_path)


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
    同步封装：生成 TTS 音频文件（edge-tts）。

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


def generate_elevenlabs_audio_sync(
    text: str,
    output_path: str,
    api_key: str,
    voice_id: str,
    ffmpeg_path: str = 'ffmpeg',
    speed: float = 1.0,
) -> Tuple[float, Optional[dict]]:
    """
    同步生成 ElevenLabs TTS 音频文件（MP3），并返回字符级对齐时间戳。

    Returns:
        (duration_seconds, alignment) — alignment 形如
        {'characters': [...], 'character_start_times_ms': [...], 'character_durations_ms': [...]}
        若接口未返回对齐信息则为 None。
    """
    import base64
    from elevenlabs.client import ElevenLabs
    from elevenlabs.core import ApiError as ElevenLabsApiError
    from elevenlabs import VoiceSettings

    client = ElevenLabs(api_key=api_key)
    # ElevenLabs 实际接受 speed 范围 0.7–1.2
    clamped_speed = max(0.7, min(float(speed), 1.2))
    voice_settings = VoiceSettings(
        stability=0.75,
        similarity_boost=0.75,
        style=0.0,
        use_speaker_boost=True,
        speed=clamped_speed,
    )

    def _convert_with_timestamps(model_id: str):
        return client.text_to_speech.convert_with_timestamps(
            text=text,
            voice_id=voice_id,
            model_id=model_id,
            output_format='mp3_44100_128',
            voice_settings=voice_settings,
        )

    alignment_dict: Optional[dict] = None
    try:
        try:
            response = _convert_with_timestamps('eleven_v3')
        except ElevenLabsApiError as e:
            logger.warning(
                f"eleven_v3 不可用 (status={getattr(e, 'status_code', None)})，回退到 eleven_multilingual_v2"
            )
            response = _convert_with_timestamps('eleven_multilingual_v2')

        # SDK 内部使用 audio_base_64（Python 属性名）/ audio_base64（JSON 别名）
        audio_b64 = (
            getattr(response, 'audio_base_64', None)
            or getattr(response, 'audio_base64', None)
        )
        if audio_b64 is None and isinstance(response, dict):
            audio_b64 = response.get('audio_base_64') or response.get('audio_base64')
        if not audio_b64:
            raise RuntimeError("ElevenLabs 未返回 audio_base64 数据")

        with open(output_path, 'wb') as f:
            f.write(base64.b64decode(audio_b64))

        alignment_obj = getattr(response, 'alignment', None)
        if alignment_obj is None and isinstance(response, dict):
            alignment_obj = response.get('alignment')
        if alignment_obj is not None:
            chars = getattr(alignment_obj, 'characters', None)
            # SDK 使用 character_start_times_seconds / character_end_times_seconds
            starts_sec = getattr(alignment_obj, 'character_start_times_seconds', None)
            ends_sec = getattr(alignment_obj, 'character_end_times_seconds', None)
            if chars is None and isinstance(alignment_obj, dict):
                chars = alignment_obj.get('characters')
                starts_sec = alignment_obj.get('character_start_times_seconds')
                ends_sec = alignment_obj.get('character_end_times_seconds')
            if chars and starts_sec and ends_sec and len(chars) == len(starts_sec) == len(ends_sec):
                alignment_dict = {
                    'characters': list(chars),
                    'character_start_times_ms': [int(s * 1000) for s in starts_sec],
                    'character_durations_ms': [
                        max(int((e - s) * 1000), 0) for s, e in zip(starts_sec, ends_sec)
                    ],
                }
    except ElevenLabsApiError as e:
        status = getattr(e, 'status_code', None)
        body = getattr(e, 'body', None)
        detail = body.get('detail', {}) if isinstance(body, dict) else {}
        err_status = detail.get('status', '') if isinstance(detail, dict) else ''
        msg = (detail.get('message') if isinstance(detail, dict) else None) or str(e)
        if err_status == 'quota_exceeded' or 'quota' in msg.lower() or 'credits' in msg.lower():
            raise RuntimeError(f"ElevenLabs 免费配额已不足：{msg}") from e
        elif err_status == 'invalid_api_key' or status == 401:
            raise RuntimeError(f"ElevenLabs 认证失败，请检查 API Key 是否有效") from e
        elif status == 402 or (isinstance(detail, dict) and detail.get('code') == 'paid_plan_required'):
            raise RuntimeError(f"ElevenLabs 该声音需要付费套餐：{msg}") from e
        else:
            raise RuntimeError(f"ElevenLabs API 错误 (HTTP {status})：{msg}") from e

    duration = get_audio_duration(output_path, ffmpeg_path)
    logger.debug(
        f"ElevenLabs audio generated: {output_path} ({duration:.1f}s, alignment={'yes' if alignment_dict else 'no'})"
    )
    return duration, alignment_dict


def _slice_audio_by_time(
    src_path: str,
    dst_path: str,
    start_seconds: float,
    end_seconds: float,
    ffmpeg_path: str = 'ffmpeg',
) -> None:
    """从源音频切出 [start, end] 区间到目标路径（重编码以保证起点精度）。"""
    if end_seconds <= start_seconds:
        raise ValueError(f"非法切片区间 [{start_seconds:.3f}, {end_seconds:.3f}]")
    cmd = [
        ffmpeg_path, '-y',
        '-ss', f'{start_seconds:.3f}',
        '-to', f'{end_seconds:.3f}',
        '-i', src_path,
        '-c:a', 'libmp3lame', '-b:a', '128k',
        dst_path,
    ]
    _run_ffmpeg_command(
        cmd, f"FFmpeg failed to slice audio [{start_seconds:.2f}-{end_seconds:.2f}]"
    )


def _split_alignment_for_pages(
    page_texts: List[str],
    alignment: dict,
) -> List[Tuple[int, int]]:
    """
    把整段 alignment 按各页文本的字符序列切分，返回每页对应的 alignment 索引区间
    [al_start, al_end)（exclusive end）。

    匹配策略与 _build_timed_subtitle_entries_from_alignment 一致：
      - 跳过两侧 whitespace；
      - 不区分大小写匹配；
      - alignment 里多出的字符（规范化插入）跳过。
    """
    chars = alignment.get('characters') or []
    n = len(chars)
    ranges: List[Tuple[int, int]] = []
    al_idx = 0

    for page_text in page_texts:
        while al_idx < n and not chars[al_idx].strip():
            al_idx += 1
        start = al_idx

        ti = 0
        last_match = al_idx - 1
        while al_idx < n and ti < len(page_text):
            tch = page_text[ti]
            ach = chars[al_idx]
            if not tch.strip():
                ti += 1
                continue
            if not ach.strip():
                al_idx += 1
                continue
            if tch == ach or tch.lower() == ach.lower():
                last_match = al_idx
                al_idx += 1
                ti += 1
            else:
                al_idx += 1

        end = last_match + 1 if last_match >= start else start
        ranges.append((start, end))

    return ranges


# ElevenLabs 单次合成的字符上限保守阈值（含拼接 delimiter）。
# multilingual_v2 官方上限 5000，eleven_v3 略高但未公开稳定上限；
# 取 4500 留出 margin，超出时按页贪婪打包成多个批次。
_ELEVENLABS_BATCH_CHAR_LIMIT = 4500


def _pack_pages_into_batches(
    narration_indexes: List[int],
    page_texts: List[str],
    char_limit: int,
    delimiter: str,
) -> List[List[Tuple[int, str]]]:
    """
    把连续的 narration 页贪婪打包成 N 个批次，每批拼接后字符数 ≤ char_limit。

    单页若本身已超 char_limit，独占一批（让 ElevenLabs 自己处理或在调用时报错）。
    """
    batches: List[List[Tuple[int, str]]] = []
    cur: List[Tuple[int, str]] = []
    cur_chars = 0
    delim_len = len(delimiter)
    for idx, text in zip(narration_indexes, page_texts):
        added = len(text) + (delim_len if cur else 0)
        if cur and cur_chars + added > char_limit:
            batches.append(cur)
            cur = []
            cur_chars = 0
            added = len(text)
        cur.append((idx, text))
        cur_chars += added
    if cur:
        batches.append(cur)
    return batches


def _synthesize_batch_and_split(
    batch_indexes: List[int],
    batch_texts: List[str],
    tmp_dir: str,
    batch_label: str,
    api_key: str,
    voice_id: str,
    ffmpeg_path: str,
    speed: float,
) -> List[Tuple[str, dict, float]]:
    """
    一批连续页：拼接 → 一次 ElevenLabs 调用 → 按字符 alignment 切回单页。

    返回与 batch_indexes 同长的 (audio_path, sub_alignment, duration) 列表。
    alignment 缺失或某页未对齐时直接 raise，由上层 fail-fast 中断导出。

    切片边界：第 j 页 [t_j, t_{j+1})，最后一页到全曲末。delimiter 的自然停顿
    分配给前一页尾部，相邻页拼接时不丢失停顿。
    """
    if not batch_texts:
        return []

    # 单页批次：直接合成、不切片
    if len(batch_texts) == 1:
        page_idx = batch_indexes[0]
        audio_path = os.path.join(tmp_dir, f'audio_{page_idx:03d}.mp3')
        duration, alignment = generate_elevenlabs_audio_sync(
            batch_texts[0], audio_path,
            api_key=api_key, voice_id=voice_id,
            ffmpeg_path=ffmpeg_path, speed=speed,
        )
        if not alignment:
            raise RuntimeError(
                f"ElevenLabs 未返回字符级 alignment（batch {batch_label}），无法定位字幕时间，已停止导出"
            )
        return [(audio_path, alignment, duration)]

    delimiter = '\n\n'
    full_text = delimiter.join(batch_texts)
    full_audio_path = os.path.join(tmp_dir, f'audio_full_{batch_label}.mp3')

    duration_full, full_alignment = generate_elevenlabs_audio_sync(
        full_text, full_audio_path,
        api_key=api_key, voice_id=voice_id,
        ffmpeg_path=ffmpeg_path, speed=speed,
    )

    if not full_alignment:
        raise RuntimeError(
            f"ElevenLabs 未返回字符级 alignment（batch {batch_label}），无法做整段切片，已停止导出"
        )

    chars = full_alignment.get('characters') or []
    starts_ms = full_alignment.get('character_start_times_ms') or []
    durs_ms = full_alignment.get('character_durations_ms') or []
    if not chars or len(chars) != len(starts_ms) or len(chars) != len(durs_ms):
        raise RuntimeError(
            f"ElevenLabs alignment 数据不完整（batch {batch_label}），已停止导出"
        )

    page_align_ranges = _split_alignment_for_pages(batch_texts, full_alignment)
    bad_pages = [
        batch_indexes[j] + 1
        for j, (s, e) in enumerate(page_align_ranges) if e <= s
    ]
    if bad_pages:
        raise RuntimeError(
            f"整段合成 alignment 与原文无法对齐（batch {batch_label}，涉及第 "
            f"{'、'.join(map(str, bad_pages))} 页）。"
            "通常是旁白里有数字或符号被 TTS 引擎念成英文（如 '5' → 'five'），"
            "导致字符序列对不上。已停止导出。"
        )

    boundaries_sec: List[float] = []
    for al_start, _al_end in page_align_ranges:
        boundaries_sec.append(starts_ms[al_start] / 1000.0)
    boundaries_sec.append(max(duration_full, boundaries_sec[-1] + 0.1))

    results: List[Tuple[str, dict, float]] = []
    for j, (al_start, al_end) in enumerate(page_align_ranges):
        t_start = boundaries_sec[j]
        t_end = boundaries_sec[j + 1]
        page_idx = batch_indexes[j]

        page_audio_path = os.path.join(tmp_dir, f'audio_{page_idx:03d}.mp3')
        _slice_audio_by_time(
            full_audio_path, page_audio_path, t_start, t_end, ffmpeg_path=ffmpeg_path,
        )
        page_duration = get_audio_duration(page_audio_path, ffmpeg_path=ffmpeg_path)

        t_start_ms = int(t_start * 1000)
        sub_alignment = {
            'characters': list(chars[al_start:al_end]),
            'character_start_times_ms': [
                max(s - t_start_ms, 0) for s in starts_ms[al_start:al_end]
            ],
            'character_durations_ms': list(durs_ms[al_start:al_end]),
        }
        results.append((page_audio_path, sub_alignment, page_duration))

    logger.info(
        f"batch {batch_label} 整段合成完成：{len(batch_texts)} 页 → 1 次 ElevenLabs 调用，"
        f"全曲 {duration_full:.1f}s"
    )
    return results


def _generate_elevenlabs_whole_and_split(
    pages_data: List[dict],
    narration_indexes: List[int],
    tmp_dir: str,
    api_key: str,
    voice_id: str,
    ffmpeg_path: str,
    speed: float,
    progress_callback: Optional[Callable[[str, str, int], None]] = None,
) -> List[Tuple[str, dict, float]]:
    """
    把所有非空 narration 页按字符上限切成若干批次，每批一次合成 + 切片回单页。

    返回与 narration_indexes 同长的列表，每项 (audio_path, sub_alignment, duration)。
    任何 alignment 缺失 / 页未对齐 / API 错误都直接 raise（fail-fast，不回退到逐页）。
    """
    delimiter = '\n\n'
    page_texts = [
        _strip_invisible_unicode(
            (pages_data[i].get('narration_text') or '').strip(), keep_newlines=True,
        )
        for i in narration_indexes
    ]
    if not all(page_texts):
        raise RuntimeError("整段合成：存在空 narration，无法构造完整文本")

    batches = _pack_pages_into_batches(
        narration_indexes, page_texts,
        char_limit=_ELEVENLABS_BATCH_CHAR_LIMIT, delimiter=delimiter,
    )

    results_by_index: dict = {}
    for b_idx, batch in enumerate(batches):
        batch_indexes = [pair[0] for pair in batch]
        batch_texts = [pair[1] for pair in batch]
        label = f"{b_idx + 1}/{len(batches)}"
        if progress_callback:
            total_chars = sum(len(t) for t in batch_texts)
            progress_callback(
                "TTS",
                f"整段合成第 {label} 批（{len(batch)} 页 / {total_chars} 字）",
                22,
            )
        batch_results = _synthesize_batch_and_split(
            batch_indexes, batch_texts, tmp_dir, label,
            api_key=api_key, voice_id=voice_id,
            ffmpeg_path=ffmpeg_path, speed=speed,
        )
        for idx, r in zip(batch_indexes, batch_results):
            results_by_index[idx] = r

    return [results_by_index[i] for i in narration_indexes]


# ═══════════════════════════════════════════════════════════════════════════════
# Ken Burns 动效
# ═══════════════════════════════════════════════════════════════════════════════

# 四种交替动效
KEN_BURNS_EFFECTS = ['zoom_in', 'zoom_out', 'pan_left', 'pan_right']

# 轻量动效参数：既保留镜头感，也避免把边缘文字裁出屏幕
KEN_BURNS_MAX_ZOOM = 1.08
KEN_BURNS_PAN_CANVAS_SCALE = 1.08


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
    return bg, (x_off, y_off, new_w, new_h)


def create_ken_burns_clip(
    image_path: str,
    output_path: str,
    duration: float,
    width: int = 1920,
    height: int = 1080,
    fps: int = 25,
    effect_type: str = 'zoom_in',
    ffmpeg_path: str = 'ffmpeg',
    idle_timeout: float = _FFMPEG_IDLE_TIMEOUT_SECONDS,
    fade_in_seconds: float = 0.0,
    fade_out_seconds: float = 0.0,
) -> None:
    """OpenCV 逐帧渲染 Ken Burns 动效，pipe rawvideo 给 FFmpeg 编码。
    用 _prepare_canvas 适配任意画幅，getRectSubPix 实现浮点精度裁切。"""
    import cv2

    total_frames = max(int(duration * fps), 1)
    src = cv2.imread(image_path)
    if src is None:
        raise FileNotFoundError(f"Cannot read image: {image_path}")

    max_zoom = KEN_BURNS_MAX_ZOOM
    pan_canvas_scale = KEN_BURNS_PAN_CANVAS_SCALE
    canvas_scale = max(max_zoom, pan_canvas_scale)
    canvas_w = int(width * canvas_scale)
    canvas_h = int(height * canvas_scale)
    # 先把整张 slide 缩进一个安全边距内，再做镜头运动，避免边缘文字被裁出画面。
    safe_content_w = max(1, int(width / max_zoom))
    safe_content_h = max(1, int(height / max_zoom))
    img, (slide_x, slide_y, slide_w, slide_h) = _prepare_canvas(
        src,
        safe_content_w,
        safe_content_h,
        canvas_w,
        canvas_h,
    )
    ih, iw = img.shape[:2]

    fade_filters: List[str] = []
    if fade_in_seconds > 0:
        fade_filters.append(f'fade=t=in:st=0:d={fade_in_seconds}')
    if fade_out_seconds > 0:
        fade_out_start = max(duration - fade_out_seconds, 0.0)
        fade_filters.append(f'fade=t=out:st={fade_out_start}:d={fade_out_seconds}')

    cmd = [
        ffmpeg_path, '-y',
        '-f', 'rawvideo', '-pix_fmt', 'bgr24',
        '-s', f'{width}x{height}', '-r', str(fps),
        '-i', 'pipe:0',
        '-t', str(duration),
    ]
    if fade_filters:
        cmd += ['-vf', ','.join(fade_filters)]
    cmd += [
        '-c:v', 'libx264', '-pix_fmt', 'yuv420p',
        '-preset', 'medium', '-crf', '23',
        '-movflags', '+faststart',
        output_path,
    ]

    proc = subprocess.Popen(
        _inject_ffmpeg_progress_args(cmd),
        stdin=subprocess.PIPE,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.PIPE,
    )

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
                min_cx = max(width / 2.0, slide_x + slide_w - width / 2.0)
                max_cx = min(iw - width / 2.0, slide_x + width / 2.0)
                cx = min_cx + max(max_cx - min_cx, 0.0) * t
                cy = ih / 2.0
            elif effect_type == 'pan_left':
                z = 1.0
                min_cx = max(width / 2.0, slide_x + slide_w - width / 2.0)
                max_cx = min(iw - width / 2.0, slide_x + width / 2.0)
                cx = max_cx - max(max_cx - min_cx, 0.0) * t
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
        _wait_for_process_with_idle_watchdog(
            proc,
            "FFmpeg failed for Ken Burns clip",
            idle_timeout=idle_timeout,
        )
    except Exception:
        if proc.poll() is None:
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
    idle_timeout: float = _FFMPEG_IDLE_TIMEOUT_SECONDS,
    fade_in_seconds: float = 0.0,
    fade_out_seconds: float = 0.0,
) -> None:
    """创建无声视频片段（用于没有旁白的页面）"""
    if enable_ken_burns:
        tmp_video = output_path + '.tmp.mp4'
        create_ken_burns_clip(
            image_path, tmp_video, duration,
            width=width, height=height, fps=fps,
            effect_type=effect_type, ffmpeg_path=ffmpeg_path, idle_timeout=idle_timeout,
            fade_in_seconds=fade_in_seconds, fade_out_seconds=fade_out_seconds,
        )
        cmd = [
            ffmpeg_path, '-y',
            '-i', tmp_video,
            '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo',
            '-c:v', 'copy', '-c:a', 'aac', '-shortest',
            '-movflags', '+faststart',
            output_path,
        ]
        try:
            _run_ffmpeg_command(cmd, "FFmpeg failed for silent clip", idle_timeout=idle_timeout)
        finally:
            if os.path.exists(tmp_video):
                os.remove(tmp_video)
    else:
        vf = f"scale={width}:{height}:force_original_aspect_ratio=decrease,pad={width}:{height}:(ow-iw)/2:(oh-ih)/2"
        if fade_in_seconds > 0:
            vf += f",fade=t=in:st=0:d={fade_in_seconds}"
        if fade_out_seconds > 0:
            fade_out_start = max(duration - fade_out_seconds, 0.0)
            vf += f",fade=t=out:st={fade_out_start}:d={fade_out_seconds}"
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
        _run_ffmpeg_command(cmd, "FFmpeg failed for silent clip", idle_timeout=idle_timeout)


def create_static_clip(
    image_path: str,
    output_path: str,
    duration: float,
    width: int = 1920,
    height: int = 1080,
    fps: int = 25,
    ffmpeg_path: str = 'ffmpeg',
    idle_timeout: float = _FFMPEG_IDLE_TIMEOUT_SECONDS,
    fade_in_seconds: float = 0.0,
    fade_out_seconds: float = 0.0,
) -> None:
    """从单张图片创建静态视频片段（无动效）"""
    vf = f"scale={width}:{height}:force_original_aspect_ratio=decrease,pad={width}:{height}:(ow-iw)/2:(oh-ih)/2"
    if fade_in_seconds > 0:
        vf += f",fade=t=in:st=0:d={fade_in_seconds}"
    if fade_out_seconds > 0:
        fade_out_start = max(duration - fade_out_seconds, 0.0)
        vf += f",fade=t=out:st={fade_out_start}:d={fade_out_seconds}"

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
    _run_ffmpeg_command(cmd, "FFmpeg failed for static clip", idle_timeout=idle_timeout)


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


def _build_timed_subtitle_entries_from_alignment(
    narration_text: str,
    page_start: float,
    alignment: dict,
) -> List[dict]:
    """
    使用 ElevenLabs 字符级对齐时间戳生成字幕条目，比按字符比例估算更精准。

    走两路指针：sentence 字符序列 vs alignment.characters 序列，
    匹配相同字符（忽略空白），用首字符 start 与尾字符 start+duration 作为字幕区间。
    """
    sentences = _split_narration_to_sentences(narration_text)
    if not sentences:
        return []

    chars = alignment.get('characters') or []
    starts = alignment.get('character_start_times_ms') or []
    durs = alignment.get('character_durations_ms') or []
    if not chars or len(chars) != len(starts) or len(chars) != len(durs):
        return []

    entries: List[dict] = []
    align_idx = 0
    n = len(chars)

    for sent in sentences:
        target = sent
        # 跳过对齐序列开头的空白字符
        while align_idx < n and not chars[align_idx].strip():
            align_idx += 1
        if align_idx >= n:
            break

        sent_start_idx = align_idx
        # 在对齐序列中匹配该句子的字符（按非空白字符逐个对齐）
        ti = 0
        i = align_idx
        last_match_idx = align_idx
        while i < n and ti < len(target):
            tch = target[ti]
            ach = chars[i]
            if not tch.strip():
                ti += 1
                continue
            if not ach.strip():
                i += 1
                continue
            # 不区分大小写匹配，宽松一点处理标点变体
            if tch == ach or tch.lower() == ach.lower():
                last_match_idx = i
                i += 1
                ti += 1
            else:
                # 对齐序列里如果出现额外字符（如规范化插入），跳过它
                i += 1

        sent_end_idx = last_match_idx
        start_ms = starts[sent_start_idx]
        end_ms = starts[sent_end_idx] + durs[sent_end_idx]
        entries.append({
            'start': page_start + start_ms / 1000.0,
            'end': page_start + end_ms / 1000.0,
            'text': sent,
        })
        align_idx = i

    return entries


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
        seg_duration = page_duration * len(sent) / total_chars
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


# macOS / Linux / Windows 已知 CJK 字体文件 → libass 友好的 Latin 家族名。
# 顺序即优先级。fontsdir 用对应文件所在目录。
_CJK_FONT_FILE_CANDIDATES: List[Tuple[str, str]] = [
    # macOS
    ('/System/Library/Fonts/PingFang.ttc', 'PingFang SC'),
    ('/System/Library/Fonts/Hiragino Sans GB.ttc', 'Hiragino Sans GB'),
    ('/System/Library/Fonts/STHeiti Medium.ttc', 'Heiti SC'),
    ('/System/Library/Fonts/STHeiti Light.ttc', 'Heiti SC'),
    ('/Library/Fonts/Songti.ttc', 'Songti SC'),
    # Linux
    ('/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc', 'Noto Sans CJK SC'),
    ('/usr/share/fonts/noto-cjk/NotoSansCJK-Regular.ttc', 'Noto Sans CJK SC'),
    ('/usr/share/fonts/google-noto-cjk/NotoSansCJK-Regular.ttc', 'Noto Sans CJK SC'),
    ('/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc', 'Noto Sans CJK SC'),
    ('/usr/share/fonts/opentype/noto/NotoSerifCJK-Regular.ttc', 'Noto Serif CJK SC'),
    # Windows
    ('C:/Windows/Fonts/msyh.ttc', 'Microsoft YaHei'),
    ('C:/Windows/Fonts/msyh.ttf', 'Microsoft YaHei'),
    ('C:/Windows/Fonts/simhei.ttf', 'SimHei'),
]


def _resolve_cjk_font_file() -> Optional[Tuple[str, str]]:
    """
    解析当前系统可用的 CJK 字体文件。

    返回 (font_file_path, font_family_name)；找不到时 None。
    优先扫已知路径（避免 fc-list 在 macOS 上返回本地化名字导致 libass 找不到字体）。
    """
    for path, family in _CJK_FONT_FILE_CANDIDATES:
        if os.path.exists(path):
            return path, family

    # fc-match 路径回退；强制 LC_ALL=C 拿 Latin 家族名
    try:
        env = {**os.environ, 'LC_ALL': 'C', 'LANG': 'C'}
        result = subprocess.run(
            ['fc-match', '-f', '%{file}|%{family}', ':lang=zh'],
            capture_output=True, text=True, timeout=5, env=env,
        )
        out = result.stdout.strip()
        if out and '|' in out:
            file_part, family_part = out.split('|', 1)
            family = family_part.split(',')[0].strip()
            if file_part and os.path.exists(file_part) and family:
                return file_part, family
    except Exception:
        pass

    return None


def _detect_cjk_font() -> str:
    """返回 ASS Style 用的 CJK 字体家族名（libass 能查到的 Latin 名）。"""
    resolved = _resolve_cjk_font_file()
    if resolved:
        return resolved[1]
    return 'Noto Sans CJK SC'


def _detect_cjk_font_dir() -> Optional[str]:
    """返回检测到的 CJK 字体文件所在目录，作为 ass filter 的 fontsdir。"""
    resolved = _resolve_cjk_font_file()
    if resolved:
        return os.path.dirname(resolved[0])
    return None


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
            text = _sanitize_ass_dialogue_text(entry['text'])
            f.write(f"Dialogue: 0,{start},{end},Default,,0,0,0,,{text}\n")


def _strip_invisible_unicode(text: str, keep_newlines: bool = False) -> str:
    """
    去除不可见 Unicode 控制类字符，避免在 ASS 解析或 TTS alignment 中产生干扰。

    过滤所有 Cc/Cf/Co/Cs/Cn 类，以及行/段分隔符 U+2028/U+2029。
    keep_newlines=True 时保留 \n / \r / \t（用于 TTS 输入，保留语义换行）。
    """
    out = []
    for ch in text:
        if keep_newlines and ch in ('\n', '\r', '\t'):
            out.append(ch)
            continue
        if ch in ('\u2028', '\u2029'):
            continue
        cat = unicodedata.category(ch)
        if cat[0] == 'C':
            continue
        out.append(ch)
    return ''.join(out)


def _sanitize_ass_dialogue_text(text: str) -> str:
    """
    清洗旁白文本，避免被 libass 当成 ASS override 标签解析。

    libass 在 Dialogue Text 字段里会特殊解析：
      - `{...}` 是内联 override 块，会被吞或错渲染；
      - `\\N` `\\h` `\\n` 等反斜杠序列是 libass 转义；
      - 不可见控制字符（ZWSP / BOM / LRE 等）也可能干扰解析或字体 shaping。

    旁白偶尔出现这些字符时，整段对白会被错误解析、变成视觉上的"乱码/方块"。
    先剥掉控制字符，再把 `\\` `{` `}` 替换成全角等价字符。
    """
    cleaned = _strip_invisible_unicode(text, keep_newlines=False)
    return (
        cleaned
        .replace('\\', '＼')
        .replace('{', '｛')
        .replace('}', '｝')
    )


def _escape_ffmpeg_filter_value(value: str) -> str:
    """转义 FFmpeg filter 参数值，避免路径被误解析为额外选项。"""
    escaped = value.replace('\\', '/')
    for old, new in (
        (':', '\\:'),
        ("'", "\\'"),
        (',', '\\,'),
        ('[', '\\['),
        (']', '\\]'),
        (';', '\\;'),
    ):
        escaped = escaped.replace(old, new)
    return escaped


def burn_subtitles(
    video_path: str,
    subtitle_path: str,
    output_path: str,
    ffmpeg_path: str = 'ffmpeg',
    idle_timeout: float = _FFMPEG_IDLE_TIMEOUT_SECONDS,
) -> None:
    """将 ASS 字幕烧录到视频中"""
    escaped_sub = _escape_ffmpeg_filter_value(subtitle_path)

    ass_args = f"ass=filename='{escaped_sub}'"
    fonts_dir = _detect_cjk_font_dir()
    if fonts_dir:
        escaped_fontsdir = _escape_ffmpeg_filter_value(fonts_dir)
        ass_args += f":fontsdir='{escaped_fontsdir}'"

    cmd = [
        ffmpeg_path, '-y',
        '-i', video_path,
        '-vf', ass_args,
        '-c:v', 'libx264',
        '-c:a', 'copy',
        '-pix_fmt', 'yuv420p',
        '-preset', 'medium',
        '-crf', '23',
        '-movflags', '+faststart',
        output_path,
    ]
    _run_ffmpeg_command(cmd, "FFmpeg subtitle burn failed", idle_timeout=idle_timeout)


# ═══════════════════════════════════════════════════════════════════════════════
# 视频合成
# ═══════════════════════════════════════════════════════════════════════════════


def mux_video_audio(
    video_path: str,
    audio_path: str,
    output_path: str,
    ffmpeg_path: str = 'ffmpeg',
    idle_timeout: float = _FFMPEG_IDLE_TIMEOUT_SECONDS,
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
    _run_ffmpeg_command(cmd, "FFmpeg mux failed", idle_timeout=idle_timeout)


def composite_video(
    clip_paths: List[str],
    output_path: str,
    fps: int = 25,
    ffmpeg_path: str = 'ffmpeg',
    idle_timeout: float = _FFMPEG_IDLE_TIMEOUT_SECONDS,
) -> None:
    """
    使用 FFmpeg concat demuxer 将多个视频片段拼接为最终 MP4。

    Args:
        clip_paths: 各页合并后的视频片段路径列表
        output_path: 最终输出 MP4 路径
        fps: 帧率（确保拼接后一致）
        ffmpeg_path: ffmpeg 路径
        idle_timeout: 连续无输出多久视为卡死
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
                escaped = safe_path.replace("'", "''")
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
        _run_ffmpeg_command(cmd, "FFmpeg concat failed", idle_timeout=idle_timeout)
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
    fail_fast: bool = False,
    elevenlabs_config: Optional[dict] = None,
    speed: float = 1.0,
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
        fail_fast: 是否在缺少有效旁白音频时立即失败
    """
    if not pages_data:
        raise ValueError("No pages to process")

    # 检查 ffmpeg
    if not check_ffmpeg_available(ffmpeg_path):
        raise RuntimeError(
            "FFmpeg is not installed or not found in PATH. "
            "Please install FFmpeg to use video export."
        )

    requires_subtitles = any((page.get('narration_text') or '').strip() for page in pages_data)
    if requires_subtitles and not check_ffmpeg_ass_filter_available(ffmpeg_path):
        raise RuntimeError(
            "当前 FFmpeg 不支持 ASS 字幕烧录（缺少 libass / ass filter）。"
            "视频导出需要安装带 libass 的 FFmpeg。"
            "请安装或重装支持 ASS 字幕的 FFmpeg 后重试。"
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
        alignments: List[Optional[dict]] = []
        silent_page_indexes: List[int] = []

        # 整段合成快路径：ElevenLabs 且至少 2 页有 narration 时，按字符上限拆批
        # 一批一合成 + 切片回单页，解决"逐页冷启动"导致的页间割裂感。
        # 失败（alignment 缺失 / 某页未对齐 / API 错）直接 raise，fail-fast，不回退。
        narration_indexes = [
            idx for idx, p in enumerate(pages_data)
            if (p.get('narration_text') or '').strip()
        ]
        whole_text_results: Optional[dict] = None
        if (
            elevenlabs_config and elevenlabs_config.get('api_key')
            and len(narration_indexes) >= 2
        ):
            whole_text_pairs = _generate_elevenlabs_whole_and_split(
                pages_data, narration_indexes, tmp_dir,
                api_key=elevenlabs_config['api_key'],
                voice_id=elevenlabs_config.get('voice_id', 'JBFqnCBsd6RMkjVDRZzb'),
                ffmpeg_path=ffmpeg_path,
                speed=speed,
                progress_callback=progress_callback,
            )
            whole_text_results = dict(zip(narration_indexes, whole_text_pairs))

        for i, page in enumerate(pages_data):
            narration = page.get('narration_text')
            page_idx = page.get('page_index', i)

            audio_path = None
            alignment: Optional[dict] = None
            duration = silent_duration
            if narration and narration.strip():
                if whole_text_results is not None and i in whole_text_results:
                    audio_path, alignment, duration = whole_text_results[i]
                else:
                    audio_path = os.path.join(tmp_dir, f'audio_{i:03d}.mp3')
                    try:
                        if elevenlabs_config and elevenlabs_config.get('api_key'):
                            duration, alignment = generate_elevenlabs_audio_sync(
                                narration, audio_path,
                                api_key=elevenlabs_config['api_key'],
                                voice_id=elevenlabs_config.get('voice_id', 'JBFqnCBsd6RMkjVDRZzb'),
                                ffmpeg_path=ffmpeg_path,
                                speed=speed,
                            )
                        else:
                            # edge-tts 用 rate 字符串：speed=1.1 → "+10%"
                            effective_rate = rate
                            if abs(speed - 1.0) > 1e-3:
                                pct = int(round((speed - 1.0) * 100))
                                effective_rate = f"{'+' if pct >= 0 else ''}{pct}%"
                            duration = generate_tts_audio_sync(
                                narration, audio_path, voice=voice, rate=effective_rate, ffmpeg_path=ffmpeg_path,
                            )
                    except Exception as e:
                        if fail_fast:
                            raise RuntimeError(
                                f"第 {page_idx + 1} 页旁白语音生成失败，当前项目未开启“允许返回半成品”，已停止导出: {e}"
                            ) from e

                        logger.warning(f"TTS failed for page {page_idx}: {e}, using silent clip")
                        audio_path = None
                        alignment = None
                        duration = silent_duration
                        silent_page_indexes.append(page_idx + 1)
            else:
                if fail_fast:
                    raise RuntimeError(
                        f"第 {page_idx + 1} 页缺少旁白文本，当前项目未开启“允许返回半成品”，无法导出视频。"
                    )
                silent_page_indexes.append(page_idx + 1)

            page_durations.append(duration)
            audio_paths.append(audio_path)
            alignments.append(alignment)

            if progress_callback:
                pct = int(20 + (i + 1) / total * 30)  # 20-50%
                if audio_path:
                    message = f"已生成第 {i+1}/{total} 页音频"
                else:
                    message = f"第 {i+1}/{total} 页无有效语音，改为静音片段"
                progress_callback("TTS", message, pct)

        if fail_fast and silent_page_indexes:
            pages = '、'.join(str(idx) for idx in silent_page_indexes)
            raise RuntimeError(
                f"以下页面没有可用旁白语音：第 {pages} 页。当前项目未开启“允许返回半成品”，已停止导出。"
            )

        # ── Phase B: 视频片段 + 字幕条目 ──
        for i, page in enumerate(pages_data):
            image_path = page['image_path']
            narration = page.get('narration_text')
            page_idx = page.get('page_index', i)
            effect = KEN_BURNS_EFFECTS[page_idx % len(KEN_BURNS_EFFECTS)]
            audio_duration = page_durations[i]
            audio_path = audio_paths[i]
            alignment = alignments[i]

            # 整片头/尾的静音 padding 与画面淡入/淡出
            is_first = (i == 0)
            is_last = (i == total - 1)
            leading_pad = _LEADING_PAD_SECONDS if is_first else 0.0
            trailing_pad = _TRAILING_PAD_SECONDS if is_last else 0.0

            if audio_path and (leading_pad > 0 or trailing_pad > 0):
                padded_audio = os.path.join(tmp_dir, f'audio_padded_{i:03d}.mp3')
                pad_audio_with_silence(
                    audio_path, padded_audio,
                    leading_seconds=leading_pad,
                    trailing_seconds=trailing_pad,
                    ffmpeg_path=ffmpeg_path,
                )
                audio_path = padded_audio

            display_duration = audio_duration + leading_pad + trailing_pad

            # 收集字幕条目（字幕仅覆盖真实语音区间，避开首/末静音）
            sub_start = cumulative_time + leading_pad
            if narration and narration.strip() and audio_paths[i]:
                if alignment:
                    page_subs = _build_timed_subtitle_entries_from_alignment(
                        narration.strip(), sub_start, alignment,
                    )
                else:
                    page_subs = _build_timed_subtitle_entries(
                        narration.strip(), sub_start, audio_duration,
                    )
                subtitle_entries.extend(page_subs)
            cumulative_time += display_duration

            if audio_paths[i]:
                video_clip = os.path.join(tmp_dir, f'video_{i:03d}.mp4')
                if enable_ken_burns:
                    create_ken_burns_clip(
                        image_path, video_clip, display_duration,
                        width=width, height=height, fps=fps,
                        effect_type=effect, ffmpeg_path=ffmpeg_path,
                        fade_in_seconds=leading_pad,
                        fade_out_seconds=trailing_pad,
                    )
                else:
                    create_static_clip(
                        image_path, video_clip, display_duration,
                        width=width, height=height, fps=fps,
                        ffmpeg_path=ffmpeg_path,
                        fade_in_seconds=leading_pad,
                        fade_out_seconds=trailing_pad,
                    )

                # Mux video + audio
                muxed_path = os.path.join(tmp_dir, f'muxed_{i:03d}.mp4')
                mux_video_audio(video_clip, audio_path, muxed_path, ffmpeg_path=ffmpeg_path)
                muxed_clips.append(muxed_path)
            else:
                # 静音片段（含无声音轨以保证 concat 兼容）
                silent_path = os.path.join(tmp_dir, f'silent_{i:03d}.mp4')
                create_silent_clip(
                    image_path, silent_path, duration=display_duration,
                    width=width, height=height, fps=fps,
                    effect_type=effect, enable_ken_burns=enable_ken_burns,
                    ffmpeg_path=ffmpeg_path,
                    fade_in_seconds=leading_pad,
                    fade_out_seconds=trailing_pad,
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
