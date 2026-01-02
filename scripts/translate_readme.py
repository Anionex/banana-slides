#!/usr/bin/env python3
"""
自动翻译README.md到README_EN.md

使用项目的AI服务将中文README翻译成英文。
适用于CI/CD自动化流程。
"""

import os
import sys
import logging
from pathlib import Path

# 添加backend目录到Python路径
backend_dir = Path(__file__).parent.parent / "backend"
sys.path.insert(0, str(backend_dir))

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def translate_readme(source_file: str, target_file: str):
    """
    翻译README文件
    
    Args:
        source_file: 源文件路径 (中文README.md)
        target_file: 目标文件路径 (英文README_EN.md)
    """
    try:
        # 导入AI服务
        from services.ai_providers import get_text_provider
        
        # 读取源文件
        logger.info(f"读取源文件: {source_file}")
        with open(source_file, 'r', encoding='utf-8') as f:
            source_content = f.read()
        
        if not source_content.strip():
            logger.error("源文件为空")
            sys.exit(1)
        
        logger.info(f"源文件长度: {len(source_content)} 字符")
        
        # 获取文本提供者（使用环境变量中的配置）
        logger.info("初始化AI文本提供者...")
        text_model = os.getenv('TEXT_MODEL', 'gemini-2.0-flash-exp')
        text_provider = get_text_provider(model=text_model)
        logger.info(f"使用模型: {text_model}")
        
        # 构建翻译提示词
        translation_prompt = f"""请将以下中文Markdown文档翻译成英文。

要求：
1. 保持Markdown格式不变（包括标题、链接、图片、代码块等）
2. 保持所有HTML标签和属性不变
3. 保持所有URL链接不变
4. 保持徽章（badges）的链接和格式不变
5. 技术术语使用常见的英文表达
6. 语言风格要专业、清晰、易读
7. 保持原文的段落结构和排版
8. 不要添加任何额外的解释或注释，只输出翻译后的内容

原文：

{source_content}

翻译后的英文版本："""

        # 调用AI进行翻译
        logger.info("开始翻译...")
        translated_content = text_provider.generate_text(translation_prompt)
        
        if not translated_content or not translated_content.strip():
            logger.error("翻译结果为空")
            sys.exit(1)
        
        logger.info(f"翻译完成，长度: {len(translated_content)} 字符")
        
        # 后处理：确保中英文链接互换
        # 将 **中文 | [English](README_EN.md)** 替换为 **[中文](README.md) | English**
        translated_content = translated_content.replace(
            '**中文 | [English](README_EN.md)**',
            '**[中文](README.md) | English**'
        ).replace(
            '**Chinese | [English](README_EN.md)**',
            '**[中文](README.md) | English**'
        )
        
        # 写入目标文件
        logger.info(f"写入目标文件: {target_file}")
        with open(target_file, 'w', encoding='utf-8') as f:
            f.write(translated_content)
        
        logger.info("✅ 翻译成功完成！")
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
    
    logger.info("README 自动翻译工具:")
    logger.info(f"项目根目录: {project_root}")
    logger.info(f"源文件: {source_file}")
    logger.info(f"目标文件: {target_file}")
    
    # 检查源文件是否存在
    if not source_file.exists():
        logger.error(f"源文件不存在: {source_file}")
        sys.exit(1)
    
    # 执行翻译
    translate_readme(str(source_file), str(target_file))


if __name__ == "__main__":
    main()

