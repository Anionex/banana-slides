#!/usr/bin/env python3
"""
使用 MinerU Pipeline 模式解析图片的测试脚本
"""
import os
import sys
from pathlib import Path
import shutil
import dotenv

dotenv.load_dotenv(override=True)
MINERU_TOKEN = os.getenv('MINERU_TOKEN')
MINERU_API_BASE = os.getenv('MINERU_API_BASE')

# 添加 backend 到路径
backend_dir = Path(__file__).parent / 'backend'
sys.path.insert(0, str(backend_dir))

from services.file_parser_service import FileParserService
from config import Config
from PIL import Image
import logging

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def parse_image_with_pipeline(image_path: str):
    """
    使用 MinerU Pipeline 模式解析图片
    
    Args:
        image_path: 图片路径（Windows路径或WSL路径）
    
    Returns:
        tuple: (markdown_content, extract_id, output_file_path)
    """
    # 将Windows路径转换为WSL路径
    if image_path.startswith('D:'):
        image_path = image_path.replace('D:', '/mnt/d')
        image_path = image_path.replace('\\', '/')
    
    image_path = Path(image_path)
    
    if not image_path.exists():
        logger.error(f"图片文件不存在: {image_path}")
        return None, None, None
    
    logger.info(f"开始使用 MinerU Pipeline 模式解析图片: {image_path}")
    logger.info(f"文件大小: {image_path.stat().st_size / 1024:.2f} KB")
    
    # 检查图片是否可以打开
    try:
        with Image.open(image_path) as img:
            logger.info(f"图片尺寸: {img.size[0]}x{img.size[1]}")
            logger.info(f"图片格式: {img.format}")
            logger.info(f"图片模式: {img.mode}")
    except Exception as e:
        logger.error(f"无法打开图片: {e}")
        return None, None, None
    
    # 初始化 FileParserService（不需要 API key，因为不生成描述）
    config = Config()
    
    if not MINERU_TOKEN:
        logger.error("未配置 MINERU_TOKEN")
        return None, None, None
    
    logger.info(f"MinerU API Base: {MINERU_API_BASE or config.MINERU_API_BASE}")
    logger.info(f"MinerU Model: pipeline (传统OCR模式)")
    
    service = FileParserService(
        mineru_token=MINERU_TOKEN,
        mineru_api_base=MINERU_API_BASE or config.MINERU_API_BASE,
        google_api_key='',  # 不需要，因为不生成描述
        google_api_base='',
        openai_api_key='',
        openai_api_base='',
        image_caption_model='',
        provider_format='gemini',
        mineru_model_version='pipeline'  # 使用 pipeline 模式
    )
    
    # 调用 parse_file 方法
    logger.info("开始调用 MinerU 服务解析图片...")
    
    try:
        batch_id, markdown_content, extract_id, error_message, failed_image_count = service.parse_file(
            str(image_path),
            image_path.name
        )
        
        if error_message:
            logger.error(f"解析失败: {error_message}")
            return None, None, None
        
        if not markdown_content:
            logger.error("解析结果为空")
            return None, None, None
        
        logger.info(f"✓ 解析成功!")
        logger.info(f"Batch ID: {batch_id}")
        logger.info(f"Extract ID: {extract_id}")
        logger.info(f"Markdown 长度: {len(markdown_content)} 字符")
        
        # 保存结果到文件
        output_dir = Path(__file__).parent / 'output'
        output_dir.mkdir(exist_ok=True)
        
        output_file = output_dir / f'pipeline_parse_result_{Path(image_path).stem}.md'
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write(f"<!-- MinerU Pipeline 模式解析结果 -->\n")
            f.write(f"<!-- 原始图片: {image_path} -->\n")
            f.write(f"<!-- Batch ID: {batch_id} -->\n")
            f.write(f"<!-- Extract ID: {extract_id} -->\n")
            f.write(f"<!-- 解析时间: {__import__('datetime').datetime.now().strftime('%Y-%m-%d %H:%M:%S')} -->\n\n")
            f.write(markdown_content)
        
        logger.info(f"✓ Markdown 结果已保存到: {output_file}")
        
        # 如果有提取的文件，显示文件位置
        if extract_id:
            mineru_files_dir = Path(__file__).parent / 'uploads' / 'mineru_files' / extract_id
            if mineru_files_dir.exists():
                logger.info(f"✓ 提取的文件保存在: {mineru_files_dir}")
                # 列出所有文件
                all_files = list(mineru_files_dir.rglob('*'))
                if all_files:
                    logger.info(f"提取的文件列表:")
                    for file in all_files:
                        if file.is_file():
                            logger.info(f"  - {file.relative_to(mineru_files_dir)}")
        
        return markdown_content, extract_id, output_file
        
    except Exception as e:
        logger.error(f"解析失败: {e}", exc_info=True)
        return None, None, None


if __name__ == '__main__':
    # 要解析的图片路径
    image_path = r"D:\Desktop\5d51e305-32f7-4b4f-998c-68fa0465c129_1766680105967.png"
    
    print("=" * 80)
    print("MinerU Pipeline 模式图片解析测试脚本")
    print("=" * 80)
    print()
    
    markdown_content, extract_id, output_file = parse_image_with_pipeline(image_path)
    
    print()
    print("=" * 80)
    if markdown_content:
        print("✓ 解析完成!")
        print()
        print(f"Extract ID: {extract_id}")
        print(f"结果文件: {output_file}")
        print()
        print("Markdown 内容预览:")
        print("-" * 80)
        # 显示前500个字符
        preview = markdown_content[:500]
        print(preview)
        if len(markdown_content) > 500:
            print(f"\n... (还有 {len(markdown_content) - 500} 个字符)")
    else:
        print("✗ 解析失败，请检查日志")
    print("=" * 80)








