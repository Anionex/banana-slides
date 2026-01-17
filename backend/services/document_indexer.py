"""
Document Indexer Service - 将参考文档内容进行结构化索引

用于在大纲生成时为每页分配专属的文档内容范围，避免不同页面使用重复的内容/图片。
"""
import re
import logging
from dataclasses import dataclass, field
from typing import List, Dict, Optional, Any

logger = logging.getLogger(__name__)


@dataclass
class Paragraph:
    """文档段落"""
    id: int
    text: str
    char_start: int
    char_end: int
    section_id: Optional[int] = None


@dataclass
class Image:
    """文档图片"""
    id: int
    url: str
    alt_text: str
    context: str  # 图片前后的上下文文本
    char_position: int


@dataclass
class Table:
    """文档表格"""
    id: int
    content: str
    caption: str
    char_position: int


@dataclass
class Section:
    """文档章节"""
    id: int
    title: str
    level: int  # 标题级别 1-6
    char_start: int
    char_end: int


@dataclass
class DocumentIndex:
    """文档索引结构"""
    paragraphs: List[Paragraph] = field(default_factory=list)
    images: List[Image] = field(default_factory=list)
    tables: List[Table] = field(default_factory=list)
    sections: List[Section] = field(default_factory=list)
    raw_content: str = ""

    def to_dict(self) -> Dict[str, Any]:
        """转换为可序列化的字典"""
        return {
            'paragraphs': [
                {'id': p.id, 'text': p.text[:200] + '...' if len(p.text) > 200 else p.text,
                 'char_start': p.char_start, 'char_end': p.char_end, 'section_id': p.section_id}
                for p in self.paragraphs
            ],
            'images': [
                {'id': img.id, 'url': img.url, 'alt_text': img.alt_text}
                for img in self.images
            ],
            'tables': [
                {'id': t.id, 'caption': t.caption}
                for t in self.tables
            ],
            'sections': [
                {'id': s.id, 'title': s.title, 'level': s.level}
                for s in self.sections
            ],
            'total_paragraphs': len(self.paragraphs),
            'total_images': len(self.images),
            'total_tables': len(self.tables)
        }


class DocumentIndexer:
    """将参考文档内容进行结构化索引"""

    # 图片 Markdown 正则
    IMAGE_PATTERN = re.compile(r'!\[([^\]]*)\]\(([^)]+)\)')
    # 标题正则
    HEADING_PATTERN = re.compile(r'^(#{1,6})\s+(.+)$', re.MULTILINE)
    # 表格正则（简单检测）
    TABLE_PATTERN = re.compile(r'^\|.+\|$', re.MULTILINE)

    def index_document(self, markdown_content: str) -> DocumentIndex:
        """
        解析 Markdown 文档并建立索引

        Args:
            markdown_content: Markdown 格式的文档内容

        Returns:
            DocumentIndex: 结构化的文档索引
        """
        if not markdown_content:
            return DocumentIndex()

        index = DocumentIndex(raw_content=markdown_content)

        # 1. 提取章节
        index.sections = self._extract_sections(markdown_content)

        # 2. 提取图片
        index.images = self._extract_images(markdown_content)

        # 3. 提取表格
        index.tables = self._extract_tables(markdown_content)

        # 4. 提取段落（排除图片、表格、标题）
        index.paragraphs = self._extract_paragraphs(markdown_content, index)

        logger.info(f"Document indexed: {len(index.paragraphs)} paragraphs, "
                   f"{len(index.images)} images, {len(index.tables)} tables, "
                   f"{len(index.sections)} sections")

        return index

    def _extract_sections(self, content: str) -> List[Section]:
        """提取章节标题"""
        sections = []
        for match in self.HEADING_PATTERN.finditer(content):
            level = len(match.group(1))
            title = match.group(2).strip()
            sections.append(Section(
                id=len(sections) + 1,
                title=title,
                level=level,
                char_start=match.start(),
                char_end=match.end()
            ))
        return sections

    def _extract_images(self, content: str) -> List[Image]:
        """提取图片"""
        images = []
        for match in self.IMAGE_PATTERN.finditer(content):
            alt_text = match.group(1)
            url = match.group(2)

            # 获取图片周围的上下文（前后各50个字符）
            start = max(0, match.start() - 50)
            end = min(len(content), match.end() + 50)
            context = content[start:end].replace('\n', ' ').strip()

            images.append(Image(
                id=len(images) + 1,
                url=url,
                alt_text=alt_text,
                context=context,
                char_position=match.start()
            ))
        return images

    def _extract_tables(self, content: str) -> List[Table]:
        """提取表格"""
        tables = []
        lines = content.split('\n')
        in_table = False
        table_lines = []
        table_start = 0
        char_pos = 0

        for i, line in enumerate(lines):
            if self.TABLE_PATTERN.match(line):
                if not in_table:
                    in_table = True
                    table_start = char_pos
                    table_lines = []
                table_lines.append(line)
            else:
                if in_table and table_lines:
                    # 表格结束
                    table_content = '\n'.join(table_lines)
                    # 简单提取表格标题（表格前一行如果不是表格行）
                    caption = ""
                    if i > len(table_lines) and lines[i - len(table_lines) - 1].strip():
                        prev_line = lines[i - len(table_lines) - 1].strip()
                        if not self.TABLE_PATTERN.match(prev_line):
                            caption = prev_line

                    tables.append(Table(
                        id=len(tables) + 1,
                        content=table_content,
                        caption=caption,
                        char_position=table_start
                    ))
                    in_table = False
                    table_lines = []

            char_pos += len(line) + 1  # +1 for newline

        # 处理文档末尾的表格
        if in_table and table_lines:
            table_content = '\n'.join(table_lines)
            tables.append(Table(
                id=len(tables) + 1,
                content=table_content,
                caption="",
                char_position=table_start
            ))

        return tables

    def _extract_paragraphs(self, content: str, index: DocumentIndex) -> List[Paragraph]:
        """提取段落（排除图片、表格、标题行）"""
        paragraphs = []

        # 构建需要排除的位置集合
        excluded_ranges = set()

        # 排除标题
        for section in index.sections:
            for pos in range(section.char_start, section.char_end + 1):
                excluded_ranges.add(pos)

        # 排除图片
        for img in index.images:
            # 图片的完整匹配范围
            match = self.IMAGE_PATTERN.search(content, img.char_position)
            if match:
                for pos in range(match.start(), match.end() + 1):
                    excluded_ranges.add(pos)

        # 按行处理
        lines = content.split('\n')
        char_pos = 0
        current_paragraph = []
        para_start = 0

        for line in lines:
            line_start = char_pos
            line_end = char_pos + len(line)

            # 检查这行是否被排除
            is_excluded = any(pos in excluded_ranges for pos in range(line_start, line_end + 1))

            # 检查是否是表格行
            is_table = self.TABLE_PATTERN.match(line)

            # 检查是否是空行
            is_empty = not line.strip()

            if is_excluded or is_table or is_empty:
                # 保存当前段落
                if current_paragraph:
                    para_text = '\n'.join(current_paragraph).strip()
                    if para_text and len(para_text) > 10:  # 忽略太短的段落
                        # 找到该段落所属的章节
                        section_id = self._find_section_for_position(para_start, index.sections)
                        paragraphs.append(Paragraph(
                            id=len(paragraphs) + 1,
                            text=para_text,
                            char_start=para_start,
                            char_end=char_pos - 1,
                            section_id=section_id
                        ))
                    current_paragraph = []
            else:
                if not current_paragraph:
                    para_start = line_start
                current_paragraph.append(line)

            char_pos = line_end + 1  # +1 for newline

        # 处理最后一个段落
        if current_paragraph:
            para_text = '\n'.join(current_paragraph).strip()
            if para_text and len(para_text) > 10:
                section_id = self._find_section_for_position(para_start, index.sections)
                paragraphs.append(Paragraph(
                    id=len(paragraphs) + 1,
                    text=para_text,
                    char_start=para_start,
                    char_end=char_pos - 1,
                    section_id=section_id
                ))

        return paragraphs

    def _find_section_for_position(self, position: int, sections: List[Section]) -> Optional[int]:
        """找到给定位置所属的章节"""
        current_section = None
        for section in sections:
            if section.char_start <= position:
                current_section = section.id
            else:
                break
        return current_section

    def get_content_by_range(self, index: DocumentIndex,
                              paragraph_ids: List[int] = None,
                              image_ids: List[int] = None,
                              table_ids: List[int] = None) -> str:
        """
        根据索引范围提取对应内容

        Args:
            index: 文档索引
            paragraph_ids: 要提取的段落ID列表
            image_ids: 要提取的图片ID列表
            table_ids: 要提取的表格ID列表

        Returns:
            str: 格式化的内容片段
        """
        output_parts = []

        # 提取段落
        if paragraph_ids:
            para_texts = []
            for para in index.paragraphs:
                if para.id in paragraph_ids:
                    para_texts.append(f"[段落{para.id}] {para.text}")
            if para_texts:
                output_parts.append("<paragraphs>\n" + "\n\n".join(para_texts) + "\n</paragraphs>")

        # 提取图片
        if image_ids:
            img_texts = []
            for img in index.images:
                if img.id in image_ids:
                    img_texts.append(f"![{img.alt_text}]({img.url})")
            if img_texts:
                output_parts.append("<images>\n" + "\n".join(img_texts) + "\n</images>")

        # 提取表格
        if table_ids:
            table_texts = []
            for table in index.tables:
                if table.id in table_ids:
                    table_texts.append(f"[表格{table.id}]\n{table.content}")
            if table_texts:
                output_parts.append("<tables>\n" + "\n\n".join(table_texts) + "\n</tables>")

        return "\n\n".join(output_parts) if output_parts else ""

    def format_indexed_content_for_prompt(self, index: DocumentIndex) -> str:
        """
        将索引化的文档格式化为带编号的内容，用于大纲生成 Prompt

        Args:
            index: 文档索引

        Returns:
            str: 格式化的带编号内容
        """
        output = []

        # 段落带编号
        if index.paragraphs:
            output.append("<indexed_paragraphs>")
            for p in index.paragraphs:
                # 截断过长的段落用于大纲生成
                text_preview = p.text[:500] + '...' if len(p.text) > 500 else p.text
                output.append(f"[P{p.id}] {text_preview}")
            output.append("</indexed_paragraphs>")

        # 图片带编号
        if index.images:
            output.append("\n<indexed_images>")
            for img in index.images:
                output.append(f"[IMG{img.id}] {img.url} (描述: {img.alt_text or '无'})")
            output.append("</indexed_images>")

        # 表格带编号
        if index.tables:
            output.append("\n<indexed_tables>")
            for t in index.tables:
                caption = t.caption or "无标题"
                output.append(f"[TABLE{t.id}] {caption}")
            output.append("</indexed_tables>")

        return "\n".join(output)


# 创建全局实例
document_indexer = DocumentIndexer()
