"""
Tavily Web Search Service

封装 Tavily API，提供联网搜索能力。
搜索结果会格式化为素材文字，融入 AI 大纲生成流程。
"""

import logging
from typing import List, Dict, Any, Optional

logger = logging.getLogger(__name__)


def format_search_results(results: List[Dict[str, Any]]) -> str:
    """
    将 Tavily 搜索结果格式化为文字素材。
    
    返回：
        str: 格式化后的素材文字，用于插入 ProjectContext 的 reference_files_content。
    """
    if not results:
        return ""

    lines = ["【网络搜索参考素材】"]
    for i, item in enumerate(results, 1):
        title = item.get("title", "")
        url = item.get("url", "")
        content = item.get("content", "")
        if not content:
            continue
        lines.append(f"\n--- 素材 {i} ---")
        lines.append(f"标题：{title}")
        lines.append(f"来源：{url}")
        lines.append(f"摘要：{content}")

    return "\n".join(lines)


def search_with_tavily(
    query: str,
    api_key: str,
    max_results: int = 5,
    search_depth: str = "basic",
    include_answer: bool = False,
) -> List[Dict[str, Any]]:
    """
    使用 Tavily API 执行联网搜索。

    参数：
        query: 搜索查询词
        api_key: Tavily API Key
        max_results: 最大返回结果数（默认 5）
        search_depth: 搜索深度，basic 或 advanced（默认 basic）
        include_answer: 是否让 Tavily 生成答案摘要（默认 False，我们自己控制摘要）

    返回：
        List[Dict]: 搜索结果列表，每个元素包含 title, url, content 等字段。
        返回空列表表示搜索失败或未配置。
    """
    if not api_key:
        logger.warning("[Tavily] API Key 未配置，跳过搜索")
        return []

    try:
        from tavily import TavilyClient
    except ImportError:
        logger.error("[Tavily] 未安装 tavily-python 包，请执行: pip install tavily-python")
        return []

    try:
        client = TavilyClient(api_key=api_key)
        logger.info(f"[Tavily] 搜索查询: {query}, max_results={max_results}")

        response = client.search(
            query=query,
            max_results=max_results,
            search_depth=search_depth,
            include_answer=include_answer,
        )

        results = response.get("results", [])
        logger.info(f"[Tavily] 搜索成功，返回 {len(results)} 条结果")
        return results

    except Exception as e:
        logger.error(f"[Tavily] 搜索失败: {e}")
        return []


def search_for_project(
    topic: str,
    api_key: str,
    max_results: int = 5,
    language: str = "zh",
) -> str:
    """
    为 PPT 项目执行联网搜索，并返回格式化素材文字。

    参数：
        topic: 用户输入的 PPT 主题
        api_key: Tavily API Key
        max_results: 最大返回结果数
        language: 语言，中文主题会自动增强搜索词

    返回：
        str: 格式化素材文字，可直接插入 ProjectContext。
    """
    # 优化搜索词：为中文主题添加 PPT 相关上下文
    search_query = topic.strip()
    if language == "zh" and not any(kw in search_query for kw in ["PPT", "演讲", "报告", "幻灯片"]):
        search_query = f"{search_query} 演讲素材 报告"

    results = search_with_tavily(
        query=search_query,
        api_key=api_key,
        max_results=max_results,
        search_depth="basic",
    )

    return format_search_results(results)
