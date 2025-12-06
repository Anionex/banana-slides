"""
AI Service Prompts - 集中管理所有 AI 服务的 prompt 模板
"""
import logging
from textwrap import dedent
from typing import List, Dict, Optional

logger = logging.getLogger(__name__)


def _format_reference_files_xml(reference_files_content: Optional[List[Dict[str, str]]]) -> str:
    """
    Format reference files content as XML structure
    
    Args:
        reference_files_content: List of dicts with 'filename' and 'content' keys
        
    Returns:
        Formatted XML string
    """
    if not reference_files_content:
        return ""
    
    xml_parts = ["<uploaded_files>"]
    for file_info in reference_files_content:
        filename = file_info.get('filename', 'unknown')
        content = file_info.get('content', '')
        xml_parts.append(f'  <file name="{filename}">')
        xml_parts.append('    <content>')
        xml_parts.append(content)
        xml_parts.append('    </content>')
        xml_parts.append('  </file>')
    xml_parts.append('</uploaded_files>')
    xml_parts.append('')  # Empty line after XML
    
    return '\n'.join(xml_parts)


def get_outline_generation_prompt(idea_prompt: str, reference_files_content: Optional[List[Dict[str, str]]] = None) -> str:
    """
    生成 PPT 大纲的 prompt
    
    Args:
        idea_prompt: 用户的想法/需求
        reference_files_content: 可选的参考文件内容列表
        
    Returns:
        格式化后的 prompt 字符串
    """
    files_xml = _format_reference_files_xml(reference_files_content)
    
    prompt = dedent(f"""\
    You are a helpful assistant that generates an outline for a ppt.
    
    You can organize the content in two ways:
    
    1. Simple format (for short PPTs without major sections):
    [{{"title": "title1", "points": ["point1", "point2"]}}, {{"title": "title2", "points": ["point1", "point2"]}}]
    
    2. Part-based format (for longer PPTs with major sections):
    [
      {{
        "part": "Part 1: Introduction",
        "pages": [
          {{"title": "Welcome", "points": ["point1", "point2"]}},
          {{"title": "Overview", "points": ["point1", "point2"]}}
        ]
      }},
      {{
        "part": "Part 2: Main Content",
        "pages": [
          {{"title": "Topic 1", "points": ["point1", "point2"]}},
          {{"title": "Topic 2", "points": ["point1", "point2"]}}
        ]
      }}
    ]
    
    Choose the format that best fits the content. Use parts when the PPT has clear major sections.
    
    The user's request: {idea_prompt}. Now generate the outline, don't include any other text.
    使用全中文输出。
    """)
    
    final_prompt = files_xml + prompt
    logger.debug(f"[get_outline_generation_prompt] Final prompt:\n{final_prompt}")
    return final_prompt


def get_outline_parsing_prompt(outline_text: str, reference_files_content: Optional[List[Dict[str, str]]] = None) -> str:
    """
    解析用户提供的大纲文本的 prompt
    
    Args:
        outline_text: 用户提供的大纲文本
        reference_files_content: 可选的参考文件内容列表
        
    Returns:
        格式化后的 prompt 字符串
    """
    files_xml = _format_reference_files_xml(reference_files_content)
    
    prompt = dedent(f"""\
    You are a helpful assistant that parses a user-provided PPT outline text into a structured format.
    
    The user has provided the following outline text:
    
    {outline_text}
    
    Your task is to analyze this text and convert it into a structured JSON format WITHOUT modifying any of the original text content. 
    You should only reorganize and structure the existing content, preserving all titles, points, and text exactly as provided.
    
    You can organize the content in two ways:
    
    1. Simple format (for short PPTs without major sections):
    [{{"title": "title1", "points": ["point1", "point2"]}}, {{"title": "title2", "points": ["point1", "point2"]}}]
    
    2. Part-based format (for longer PPTs with major sections):
    [
      {{
        "part": "Part 1: Introduction",
        "pages": [
          {{"title": "Welcome", "points": ["point1", "point2"]}},
          {{"title": "Overview", "points": ["point1", "point2"]}}
        ]
      }},
      {{
        "part": "Part 2: Main Content",
        "pages": [
          {{"title": "Topic 1", "points": ["point1", "point2"]}},
          {{"title": "Topic 2", "points": ["point1", "point2"]}}
        ]
      }}
    ]
    
    Important rules:
    - DO NOT modify, rewrite, or change any text from the original outline
    - DO NOT add new content that wasn't in the original text
    - DO NOT remove any content from the original text
    - Only reorganize the existing content into the structured format
    - Preserve all titles, bullet points, and text exactly as they appear
    - If the text has clear sections/parts, use the part-based format
    - Extract titles and points from the original text, keeping them exactly as written
    
    Now parse the outline text above into the structured format. Return only the JSON, don't include any other text.
    使用全中文输出。
    """)
    
    final_prompt = files_xml + prompt
    logger.debug(f"[get_outline_parsing_prompt] Final prompt:\n{final_prompt}")
    return final_prompt


def get_page_description_prompt(idea_prompt: str, outline: list, 
                                page_outline: dict, page_index: int, 
                                part_info: str = "", 
                                reference_files_content: Optional[List[Dict[str, str]]] = None) -> str:
    """
    生成单个页面描述的 prompt
    
    Args:
        idea_prompt: 原始用户想法
        outline: 完整大纲
        page_outline: 当前页面的大纲
        page_index: 页面编号（从1开始）
        part_info: 可选的章节信息
        reference_files_content: 可选的参考文件内容列表
        
    Returns:
        格式化后的 prompt 字符串
    """
    files_xml = _format_reference_files_xml(reference_files_content)
    
    prompt = dedent(f"""\
    we are generating the text descriptionfor each ppt page.
    the original user request is: \n{idea_prompt}\n
    We already have the entire outline: \n{outline}\n{part_info}
    Now please generate the description for page {page_index}:
    {page_outline}
    The description includes page title, text to render(keep it concise), don't include any other text.
    For example:
    页面标题：原始社会：与自然共生
    页面文字：
    - 狩猎采集文明： 人类活动规模小，对环境影响有限。
    - 依赖性强： 生活完全依赖于自然资源的直接供给，对自然规律敬畏。
    - 适应而非改造： 通过观察和模仿学习自然，发展出适应当地环境的生存技能。
    - 影响特点： 局部、短期、低强度，生态系统有充足的自我恢复能力。
    其他页面素材（如果有请加上，包括markdown图片链接等）
    
    提示：如果参考文件中包含以 /files/ 开头的本地文件URL图片（例如 /files/mineru/xxx/image.png），请将这些图片以markdown格式输出，例如：![图片描述](/files/mineru/xxx/image.png)，而不是作为普通文本。这些图片应该被包含在页面描述中，以便后续生成PPT时使用。
    
    使用全中文输出。
    """)
    
    final_prompt = files_xml + prompt
    logger.debug(f"[get_page_description_prompt] Final prompt:\n{final_prompt}")
    return final_prompt


def get_image_generation_prompt(page_desc: str, outline_text: str, 
                                current_section: str,
                                has_material_images: bool = False,
                                extra_requirements: str = None) -> str:
    """
    生成图片生成 prompt
    
    Args:
        page_desc: 页面描述文本
        outline_text: 大纲文本
        current_section: 当前章节
        has_material_images: 是否有素材图片
        extra_requirements: 额外的要求
        
    Returns:
        格式化后的 prompt 字符串
    """
    # 如果有素材图片，在 prompt 中明确告知 AI
    material_images_note = ""
    if has_material_images:
        material_images_note = (
            "\n\n提示：除了模板参考图片（用于风格参考）外，还提供了额外的素材图片。"
            "这些素材图片是可供挑选和使用的元素，你可以从这些素材图片中选择合适的图片、图标、图表或其他视觉元素"
            "直接整合到生成的PPT页面中。请根据页面内容的需要，智能地选择和组合这些素材图片中的元素。"
        )
    
    # 添加额外要求到提示词
    extra_req_text = ""
    if extra_requirements and extra_requirements.strip():
        extra_req_text = f"\n\n额外要求（请务必遵循）：\n{extra_requirements}\n"
    
    prompt = dedent(f"""\
    利用专业平面设计知识，根据参考图片的配色与风格生成一页设计风格相同的ppt页面，作为整个ppt的其中一页，页面描述如下:
    {page_desc}（PPT页面实际渲染文字的标点符号、文字布局可以进一步设计美化，但其他文字内容需和"页面描述"完全一致）
    
    ---
    整个ppt的大纲为：
    {outline_text}
    
    当前位于章节：{current_section}
    
    要求文字清晰锐利，画面为4K分辨率 16:9比例。画面配色与风格保持严格一致。
    注意，ppt页面中的所有文字一定要和当前主题和页面描述相关，请移除其他无关文字。ppt使用全中文。{material_images_note}{extra_req_text}
    """)
    
    logger.debug(f"[get_image_generation_prompt] Final prompt:\n{prompt}")
    return prompt


def get_image_edit_prompt(edit_instruction: str, original_description: str = None) -> str:
    """
    生成图片编辑 prompt
    
    Args:
        edit_instruction: 编辑指令
        original_description: 原始页面描述（可选）
        
    Returns:
        格式化后的 prompt 字符串
    """
    if original_description:
        prompt = dedent(f"""\
        该PPT页面的原始页面描述为：
        {original_description}
        
        现在，根据以下指令修改这张PPT页面：{edit_instruction}
        
        要求维持原有的文字内容和设计风格，只按照指令进行修改。
        """)
    else:
        prompt = f"根据以下指令修改这张PPT页面：{edit_instruction}\n保持原有的内容结构和设计风格，只按照指令进行修改。"
    
    logger.debug(f"[get_image_edit_prompt] Final prompt:\n{prompt}")
    return prompt


def get_description_to_outline_prompt(description_text: str, reference_files_content: Optional[List[Dict[str, str]]] = None) -> str:
    """
    从描述文本解析出大纲的 prompt
    
    Args:
        description_text: 用户提供的完整页面描述文本
        reference_files_content: 可选的参考文件内容列表
        
    Returns:
        格式化后的 prompt 字符串
    """
    files_xml = _format_reference_files_xml(reference_files_content)
    
    prompt = dedent(f"""\
    You are a helpful assistant that analyzes a user-provided PPT description text and extracts the outline structure from it.
    
    The user has provided the following description text:
    
    {description_text}
    
    Your task is to analyze this text and extract the outline structure (titles and key points) for each page.
    You should identify:
    1. How many pages are described
    2. The title for each page
    3. The key points or content structure for each page
    
    You can organize the content in two ways:
    
    1. Simple format (for short PPTs without major sections):
    [{{"title": "title1", "points": ["point1", "point2"]}}, {{"title": "title2", "points": ["point1", "point2"]}}]
    
    2. Part-based format (for longer PPTs with major sections):
    [
      {{
        "part": "Part 1: Introduction",
        "pages": [
          {{"title": "Welcome", "points": ["point1", "point2"]}},
          {{"title": "Overview", "points": ["point1", "point2"]}}
        ]
      }},
      {{
        "part": "Part 2: Main Content",
        "pages": [
          {{"title": "Topic 1", "points": ["point1", "point2"]}},
          {{"title": "Topic 2", "points": ["point1", "point2"]}}
        ]
      }}
    ]
    
    Important rules:
    - Extract the outline structure from the description text
    - Identify page titles and key points
    - If the text has clear sections/parts, use the part-based format
    - Preserve the logical structure and organization from the original text
    - The points should be concise summaries of the main content for each page
    
    Now extract the outline structure from the description text above. Return only the JSON, don't include any other text.
    使用全中文输出。
    """)
    
    final_prompt = files_xml + prompt
    logger.debug(f"[get_description_to_outline_prompt] Final prompt:\n{final_prompt}")
    return final_prompt


def get_description_split_prompt(description_text: str, outline: List[Dict]) -> str:
    """
    从描述文本切分出每页描述的 prompt
    
    Args:
        description_text: 用户提供的完整页面描述文本
        outline: 已解析出的大纲结构
        
    Returns:
        格式化后的 prompt 字符串
    """
    import json
    outline_json = json.dumps(outline, ensure_ascii=False, indent=2)
    
    prompt = dedent(f"""\
    You are a helpful assistant that splits a complete PPT description text into individual page descriptions.
    
    The user has provided a complete description text:
    
    {description_text}
    
    We have already extracted the outline structure:
    
    {outline_json}
    
    Your task is to split the description text into individual page descriptions based on the outline structure.
    For each page in the outline, extract the corresponding description from the original text.
    
    Return a JSON array where each element corresponds to a page in the outline (in the same order).
    Each element should be a string containing the page description in the following format:
    
    页面标题：[页面标题]
    页面文字：
    - [要点1]
    - [要点2]
    ...
    
    Example output format:
    [
      "页面标题：人工智能的诞生\\n页面文字：\\n- 1950 年，图灵提出"图灵测试"...",
      "页面标题：AI 的发展历程\\n页面文字：\\n- 1950年代：符号主义...",
      ...
    ]
    
    Important rules:
    - Split the description text according to the outline structure
    - Each page description should match the corresponding page in the outline
    - Preserve all important content from the original text
    - Keep the format consistent with the example above
    - If a page in the outline doesn't have a clear description in the text, create a reasonable description based on the outline
    
    Now split the description text into individual page descriptions. Return only the JSON array, don't include any other text.
    使用全中文输出。
    """)
    
    logger.debug(f"[get_description_split_prompt] Final prompt:\n{prompt}")
    return prompt

