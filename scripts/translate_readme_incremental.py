#!/usr/bin/env python3
"""
基于 diff 的增量翻译 README.md 到 README_EN.md

"""

import os
import sys
import logging
import re
import subprocess
from pathlib import Path
from typing import List, Tuple, Dict

# 添加backend目录到Python路径
backend_dir = Path(__file__).parent.parent / "backend"
sys.path.insert(0, str(backend_dir))

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def split_by_headers(content: str) -> List[Tuple[str, str, str]]:
    """
    按 Markdown 标题将内容分块

    Returns:
        List of (header, title, content) tuples
        header: 标题行 (如 "## 功能特性")
        title: 标题文本 (如 "功能特性")
        content: 该标题下的内容（不含标题本身）
    """
    # 匹配 Markdown 标题（# 到 #### 级别）
    header_pattern = re.compile(r'^(#{1,4})\s+(.+)$', re.MULTILINE)

    blocks = []
    last_pos = 0
    last_header = ""
    last_title = ""

    for match in header_pattern.finditer(content):
        # 保存上一个块的内容
        if last_pos > 0 or match.start() > 0:
            block_content = content[last_pos:match.start()].strip()
            if last_header or block_content:  # 保存非空块
                blocks.append((last_header, last_title, block_content))

        # 更新当前标题信息
        last_header = match.group(0)  # 完整的标题行
        last_title = match.group(2).strip()  # 标题文本
        last_pos = match.end() + 1  # 跳过换行符

    # 保存最后一个块
    if last_pos < len(content):
        block_content = content[last_pos:].strip()
        blocks.append((last_header, last_title, block_content))
    elif last_header:
        # 如果最后一个标题后面没有内容
        blocks.append((last_header, last_title, ""))

    return blocks


def get_git_diff_lines(file_path: str) -> set:
    """
    获取文件在 git 中修改的行号

    Returns:
        修改的行号集合
    """
    try:
        # 获取 git diff，显示修改的行
        result = subprocess.run(
            ['git', 'diff', '-U0', 'HEAD', file_path],
            capture_output=True,
            text=True,
            check=False
        )

        if result.returncode != 0:
            logger.warning(f"Git diff 失败，将翻译全部内容")
            return set()

        # 解析 diff 输出，提取修改的行号
        changed_lines = set()
        for line in result.stdout.split('\n'):
            # 匹配 @@ -x,y +a,b @@ 格式
            if line.startswith('@@'):
                # 提取新文件的行号范围 (+a,b)
                match = re.search(r'\+(\d+)(?:,(\d+))?', line)
                if match:
                    start = int(match.group(1))
                    count = int(match.group(2)) if match.group(2) else 1
                    changed_lines.update(range(start, start + count))

        logger.info(f"检测到 {len(changed_lines)} 行修改")
        return changed_lines

    except Exception as e:
        logger.warning(f"获取 git diff 失败: {e}，将翻译全部内容")
        return set()


def find_changed_blocks(content: str, changed_lines: set) -> set:
    """
    根据修改的行号，找出哪些块被修改了

    Returns:
        修改的块的标题集合
    """
    if not changed_lines:
        logger.info("没有检测到具体的修改行，将翻译所有块")
        return set()

    blocks = split_by_headers(content)
    changed_blocks = set()

    current_line = 1
    for header, title, block_content in blocks:
        # 计算这个块的行范围
        block_lines = len(header.split('\n')) + len(block_content.split('\n'))
        block_range = set(range(current_line, current_line + block_lines))

        # 检查是否有交集
        if block_range & changed_lines:
            changed_blocks.add(title)
            logger.info(f"检测到修改的块: {title}")

        current_line += block_lines

    return changed_blocks


def translate_block(content: str, text_provider) -> str:
    """翻译单个内容块（provider 层已有重试机制）"""
    translation_prompt = f"""Please translate the following Chinese Markdown content to English.

Requirements:
1. Keep Markdown format unchanged (headings, links, images, code blocks, etc.)
2. Keep all HTML tags and attributes unchanged
3. Keep all URLs unchanged
4. Keep all badges links and format unchanged
5. Use common English expressions for technical terms
6. Professional, clear, and readable style
7. Keep original paragraph structure and layout
8. Output ONLY the translated content without any extra explanations

Original content:

{content}

Translated English version:"""

    translated = text_provider.generate_text(translation_prompt)
    return translated.strip()


def incremental_translate(source_file: str, target_file: str, force_full: bool = False):
    """
    增量翻译 README

    Args:
        source_file: 源文件路径 (中文README.md)
        target_file: 目标文件路径 (英文README_EN.md)
        force_full: 是否强制全文翻译
    """
    try:
        from services.ai_providers import get_text_provider

        # 读取源文件
        logger.info(f"读取源文件: {source_file}")
        with open(source_file, 'r', encoding='utf-8') as f:
            source_content = f.read()

        if not source_content.strip():
            logger.error("源文件为空")
            sys.exit(1)

        # 读取现有的英文文件（如果存在）
        target_content = ""
        target_blocks = {}
        if os.path.exists(target_file) and not force_full:
            logger.info(f"读取现有英文文件: {target_file}")
            with open(target_file, 'r', encoding='utf-8') as f:
                target_content = f.read()

            # 解析英文文件的块
            for header, title, content in split_by_headers(target_content):
                target_blocks[title] = (header, content)

        # 获取 AI 提供者
        logger.info("初始化AI文本提供者...")
        text_model = os.getenv('TEXT_MODEL', 'gemini-3-flash-preview')
        text_provider = get_text_provider(model=text_model)
        logger.info(f"使用模型: {text_model}")

        # 检测修改的行
        changed_lines = get_git_diff_lines(source_file) if not force_full else set()

        # 分块处理
        source_blocks = split_by_headers(source_content)
        changed_block_titles = find_changed_blocks(source_content, changed_lines) if changed_lines else set()

        # 如果没有检测到具体的变化，或者是新文件，则翻译全部
        if not target_content or force_full or not changed_lines:
            logger.info("执行全文翻译")
            changed_block_titles = {title for _, title, _ in source_blocks}

        # 翻译修改的块
        translated_blocks = []
        total_blocks = len(source_blocks)
        translated_count = 0

        for idx, (header, title, content) in enumerate(source_blocks, 1):
            # 如果这个块被修改了，或者目标文件中不存在，则需要翻译
            needs_translation = (
                not changed_lines or  # 没有 diff 信息，翻译全部
                title in changed_block_titles or  # 块被修改
                title not in target_blocks  # 新增的块
            )

            if needs_translation:
                logger.info(f"[{idx}/{total_blocks}] 翻译块: {title}")

                # 翻译标题和内容
                if header:
                    translated_header = translate_block(header, text_provider)
                else:
                    translated_header = ""

                if content:
                    translated_content = translate_block(content, text_provider)
                else:
                    translated_content = ""

                translated_blocks.append((translated_header, translated_content))
                translated_count += 1
            else:
                # 使用现有的翻译
                logger.info(f"[{idx}/{total_blocks}] 复用现有翻译: {title}")
                if title in target_blocks:
                    existing_header, existing_content = target_blocks[title]
                    translated_blocks.append((existing_header, existing_content))
                else:
                    # 不应该到这里，但以防万一
                    logger.warning(f"未找到现有翻译，将翻译: {title}")
                    translated_header = translate_block(header, text_provider) if header else ""
                    translated_content = translate_block(content, text_provider) if content else ""
                    translated_blocks.append((translated_header, translated_content))
                    translated_count += 1

        # 组装最终内容
        final_content = ""
        for header, content in translated_blocks:
            if header:
                final_content += header + "\n\n"
            if content:
                final_content += content + "\n\n"

        # 后处理：确保中英文链接互换
        final_content = final_content.replace(
            '**中文 | [English](README_EN.md)**',
            '**[中文](README.md) | English**'
        ).replace(
            '**Chinese | [English](README_EN.md)**',
            '**[中文](README.md) | English**'
        )

        # 写入目标文件
        logger.info(f"写入目标文件: {target_file}")
        with open(target_file, 'w', encoding='utf-8') as f:
            f.write(final_content.strip() + "\n")

        logger.info(f"✅ 翻译完成！共处理 {total_blocks} 个块，翻译了 {translated_count} 个块")

        return True

    except ImportError as e:
        logger.error(f"导入错误: {e}")
        logger.error("请确保已安装所有依赖: uv sync")
        sys.exit(1)
    except FileNotFoundError as e:
        logger.error(f"文件不存在: {e}")
        sys.exit(1)
    except Exception as e:
        logger.error(f"翻译失败: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


def main():
    """主函数"""
    # 获取项目根目录
    project_root = Path(__file__).parent.parent
    source_file = project_root / "README.md"
    target_file = project_root / "README_EN.md"

    # 检查是否强制全文翻译
    force_full = "--full" in sys.argv

    logger.info("README 增量翻译工具")
    logger.info(f"项目根目录: {project_root}")
    logger.info(f"源文件: {source_file}")
    logger.info(f"目标文件: {target_file}")
    if force_full:
        logger.info("模式: 强制全文翻译")
    else:
        logger.info("模式: 增量翻译（仅翻译修改的部分）")

    # 检查源文件是否存在
    if not source_file.exists():
        logger.error(f"源文件不存在: {source_file}")
        sys.exit(1)

    # 执行翻译
    incremental_translate(str(source_file), str(target_file), force_full=force_full)


if __name__ == "__main__":
    main()
