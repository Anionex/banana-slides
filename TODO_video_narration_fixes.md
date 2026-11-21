# 视频旁白功能 — 待修复问题 TODO

分支：`feat/video-narration-template`
涉及文件：`backend/services/tts_video_service.py`、`backend/services/prompts.py`

---

## 问题 1：导出字幕有时是方块乱码，有时是正常中文 ✅ 已在分支里修

### 根因

ASS Dialogue 的 Text 字段里：
- `{...}` 是 libass 的内联 override 块；
- `\N` `\h` `\n` 等反斜杠序列是 libass 转义。

旁白偶尔包含 `{` / `}` / `\` 时，libass 会把那段对白当控制码处理，渲染结果在视觉上呈现为乱码/方块。同机器同字体跨次导出"时好时坏"的唯一变量就是旁白文字内容本身，所以根因不在字体，在解析。

### 修法

在 `tts_video_service.py` 写入 Dialogue 行前清洗文本，把这三个会被 libass 误解析的字符替换成全角等价字符：

```python
def _sanitize_ass_dialogue_text(text: str) -> str:
    return (text
        .replace('\\', '＼')
        .replace('{', '｛')
        .replace('}', '｝')
        .replace('\n', ' ')
        .replace('\r', ''))
```

并把 `generate_ass_subtitle` 中原来的 `text = entry['text'].replace('\n', ' ').replace('\r', '')` 换成调用这个函数。

### 验收

- [ ] 用一段含 `{要点}` 或 `\N` 的旁白文本导出视频，字幕可正常显示且没有"乱码/方块"。
- [ ] 之前正常的旁白回归测试，导出仍正常。

---

## 问题 2：每页旁白听起来割裂，不连贯 🔧 待改（架构改动）

### 根因（核心）

当前 `generate_narration_video` 的 Phase A 是按页逐次调 TTS：

```python
for i, page in enumerate(pages_data):
    duration, alignment = generate_elevenlabs_audio_sync(narration, ...)
```

每一页都是一次独立的 TTS 调用，TTS 模型每次都"冷启动"，没有上一页的韵律上下文。所以哪怕文本写了过渡词，听感上每页开头都有轻微的"重启"语调，页与页之间必然有可听的接缝。

**结论**：要彻底解决，必须改成"整段一次合成 TTS"。光改 prompt（让文本更连贯）只能改善内容层，改不了声学层。所以 prompt 不动，集中改 Phase A。

### 修法（ElevenLabs 路径优先）

把 Phase A 改成"一次合成、按时间戳切片"，Phase B 及之后的拼接逻辑基本不动：

1. **拼接整段文本**：把所有有旁白的页的 `narration_text` 用一个稳定分隔符（建议 `\n\n` 之类换行）拼成一个长字符串；同时记录每页文本在长字符串里的字符区间 `[char_start_i, char_end_i)`（注意把分隔符的字符数也算进偏移）。
2. **一次调用 ElevenLabs**：调 `client.text_to_speech.convert_with_timestamps(...)`，一次拿到整段 mp3 + 字符级 alignment（`character_start_times_seconds` / `character_end_times_seconds`）。
3. **按字符区间映射时间区间**：每页的 `[char_start_i, char_end_i)` 在 alignment 里查到对应的 `[t_start_i, t_end_i)`（毫秒级）。
4. **切片成单页 mp3**：用 ffmpeg `-ss t_start_i -to t_end_i -c copy`（或重编码）把整段 mp3 切成 N 个单页 mp3，写到原来 `audio_paths[i]` 的位置。`page_durations[i]` 用 `t_end_i - t_start_i`。
5. **alignment 也按页切片传给字幕逻辑**：把整段 alignment 按 char 区间切成每页一份的子 alignment，传给现有的 `_build_timed_subtitle_entries_from_alignment`。这条字幕的对齐精度比现在按页对齐更准。
6. **Phase B 之后逻辑保持不变**：每页的 audio_path、page_durations、alignment 仍然是 N 项数组，下游 mux/拼接代码不需要动。

整段合成失败时（API 报错、限额等），可以回退到当前的"按页合成"路径，保留半成品能力。

### edge-tts 路径

edge-tts 没有 ElevenLabs 那种端到端 alignment。两种选择：

- **选 A（推荐先不动）**：保留按页合成，edge-tts 本身就是较弱 TTS，连贯性收益有限。
- **选 B（如果想做）**：用 `edge_tts.Communicate` 流式接口的 `WordBoundary` 事件（含 offset/duration）做整段合成 + word-boundary 切片。

### 验收

- [ ] 三页以上的旁白视频，盲听时听不出明显接缝（除非用了过渡词主动暗示）。
- [ ] 字幕与语音对齐误差 < 200ms。
- [ ] ElevenLabs 调用次数从"页数 N"降到"1"；整体导出耗时与失败率可接受。
- [ ] 整段合成失败时能优雅回退到按页合成，导出不直接挂掉。
- [ ] 现有的 `_build_timed_subtitle_entries_from_alignment` 字幕路径仍能用，且时间戳更准。

### 不要做的事

- 不要为了"伪连贯"在每页接缝处加音频淡入淡出 / 静音垫片 —— 那只是掩盖问题，没解决根因。
- 不要去改 prompt 或字体相关代码 —— 上一轮已经验证过，prompt 只能改善文本层连贯，字体跟"时好时坏"无关。
