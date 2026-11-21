#!/usr/bin/env python3
"""
可编辑 PPTX 导出脚本

此脚本用于从指定的图片生成可编辑的 PPTX 文件。
支持单张图片或多张图片批量处理。

使用方法:
    # 处理单张图片
    python scripts/export_editable_pptx.py path/to/image.png
    
    # 处理多张图片
    python scripts/export_editable_pptx.py img1.png img2.png img3.png
    
    # 处理目录中的所有图片
    python scripts/export_editable_pptx.py path/to/images/
    
    # 指定输出文件
    python scripts/export_editable_pptx.py image.png -o output.pptx
    
    # 使用不同的提取方法
    python scripts/export_editable_pptx.py image.png --extractor mineru
    python scripts/export_editable_pptx.py image.png --extractor hybrid
    
    # 使用不同的背景修复方法
    python scripts/export_editable_pptx.py image.png --inpaint baidu
    python scripts/export_editable_pptx.py image.png --inpaint generative
    python scripts/export_editable_pptx.py image.png --inpaint hybrid

环境要求:
    需要配置 .env 文件，包含以下变量：
    - MINERU_TOKEN: MinerU API token
    - BAIDU_API_KEY, BAIDU_SECRET_KEY: 百度 API 密钥（用于 baidu/hybrid 方法）
    - GEMINI_API_KEY 或 OPENAI_API_KEY: 用于 generative/hybrid 方法

成本提示:
    - 'generative' 和 'hybrid' 背景修复方法会调用文生图模型 API，产生额外费用
    - 'baidu' 方法使用百度图像修复 API，费用较低
    - 'mineru' 和 'hybrid' 提取方法都使用 MinerU API
"""

import os
import sys
import argparse
import logging
from pathlib import Path
from typing import List, Optional

# 添加项目根目录到 Python 路径
SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent
BACKEND_DIR = PROJECT_ROOT / 'backend'
sys.path.insert(0, str(BACKEND_DIR))

# 设置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def setup_flask_app():
    """初始化 Flask 应用上下文（用于加载配置）"""
    from dotenv import load_dotenv
    
    # 加载 .env 文件
    env_path = PROJECT_ROOT / '.env'
    if env_path.exists():
        load_dotenv(env_path)
        logger.info(f"已加载环境变量: {env_path}")
    
    # 创建 Flask 应用
    from app import create_app
    app = create_app()
    return app


def collect_image_paths(paths: List[str]) -> List[str]:
    """收集所有要处理的图片路径"""
    image_extensions = {'.png', '.jpg', '.jpeg', '.webp', '.bmp'}
    result = []
    
    for path_str in paths:
        path = Path(path_str)
        
        if path.is_file():
            if path.suffix.lower() in image_extensions:
                result.append(str(path.resolve()))
            else:
                logger.warning(f"跳过非图片文件: {path}")
        elif path.is_dir():
            for file in sorted(path.iterdir()):
                if file.suffix.lower() in image_extensions:
                    result.append(str(file.resolve()))
        else:
            logger.warning(f"路径不存在: {path}")
    
    return result


def create_service_config(
    extractor_method: str = 'hybrid',
    inpaint_method: str = 'hybrid'
):
    """
    创建服务配置
    
    Args:
        extractor_method: 提取方法 ('mineru' 或 'hybrid')
        inpaint_method: 背景修复方法 ('generative', 'baidu', 'hybrid')
    """
    from services.image_editability import ServiceConfig
    
    # 根据方法选择配置
    use_hybrid_extractor = (extractor_method == 'hybrid')
    use_hybrid_inpaint = (inpaint_method == 'hybrid')
    
    logger.info(f"配置: 提取方法={extractor_method}, 背景修复={inpaint_method}")
    
    config = ServiceConfig.from_defaults(
        use_hybrid_extractor=use_hybrid_extractor,
        use_hybrid_inpaint=use_hybrid_inpaint,
        max_depth=1  # 递归深度
    )
    
    # 如果指定了非 hybrid 的 inpaint 方法，需要手动配置
    if inpaint_method != 'hybrid':
        from services.image_editability import (
            InpaintProviderFactory,
            InpaintProviderRegistry
        )
        
        inpaint_registry = InpaintProviderRegistry()
        
        if inpaint_method == 'generative':
            provider = InpaintProviderFactory.create_generative_edit_provider()
            inpaint_registry.register_default(provider)
            logger.info("使用生成式修复方法（会调用文生图模型 API）")
        elif inpaint_method == 'baidu':
            provider = InpaintProviderFactory.create_baidu_inpaint_provider()
            if provider:
                inpaint_registry.register_default(provider)
                logger.info("使用百度图像修复方法")
            else:
                logger.warning("百度修复不可用，回退到生成式方法")
                provider = InpaintProviderFactory.create_generative_edit_provider()
                inpaint_registry.register_default(provider)
        
        config.inpaint_registry = inpaint_registry
    
    return config


def export_editable_pptx(
    image_paths: List[str],
    output_file: str,
    extractor_method: str = 'hybrid',
    inpaint_method: str = 'hybrid',
    extract_text_styles: bool = True
):
    """
    导出可编辑 PPTX
    
    Args:
        image_paths: 图片路径列表
        output_file: 输出文件路径
        extractor_method: 提取方法
        inpaint_method: 背景修复方法
        extract_text_styles: 是否提取文字样式（颜色、粗体等）
    """
    from services.image_editability import ImageEditabilityService
    from services.export_service import ExportService
    from concurrent.futures import ThreadPoolExecutor, as_completed
    
    logger.info(f"开始处理 {len(image_paths)} 张图片...")
    
    # 创建配置和服务
    config = create_service_config(extractor_method, inpaint_method)
    service = ImageEditabilityService(config)
    
    # 并行分析所有图片
    logger.info("步骤 1/3: 分析图片结构...")
    editable_images = []
    
    with ThreadPoolExecutor(max_workers=4) as executor:
        futures = {
            executor.submit(service.make_image_editable, path): idx
            for idx, path in enumerate(image_paths)
        }
        
        results = [None] * len(image_paths)
        for future in as_completed(futures):
            idx = futures[future]
            try:
                results[idx] = future.result()
                logger.info(f"  完成: {image_paths[idx]}")
            except Exception as e:
                logger.error(f"  失败: {image_paths[idx]} - {e}")
                raise
        
        editable_images = results
    
    # 创建文字属性提取器（可选）
    text_attribute_extractor = None
    if extract_text_styles:
        logger.info("步骤 2/3: 提取文字样式...")
        try:
            from services.image_editability import TextAttributeExtractorFactory
            text_attribute_extractor = TextAttributeExtractorFactory.create_caption_model_extractor()
            logger.info("  文字样式提取器已创建（会调用视觉语言模型 API）")
        except Exception as e:
            logger.warning(f"  无法创建文字样式提取器: {e}")
    else:
        logger.info("步骤 2/3: 跳过文字样式提取")
    
    # 生成 PPTX
    logger.info("步骤 3/3: 生成可编辑 PPTX...")
    
    def progress_callback(step, message, percent):
        logger.info(f"  [{percent}%] {step}: {message}")
    
    # 如果output_file已经存在，给一个后缀防止冲突
    if os.path.exists(output_file):
        output_file = output_file.rsplit('.', 1)[0] + '_1.pptx'
        logger.warning(f"输出文件已存在，给一个后缀防止冲突: {output_file}")
    
    # 根据实际图片尺寸动态设置幻灯片尺寸
    # 统一到最小尺寸，并检查所有图片是否为16:9比例
    if editable_images:
        # 16:9 比例的标准值
        ASPECT_RATIO_16_9 = 16 / 9  # ≈ 1.7778
        ASPECT_RATIO_TOLERANCE = 0.02  # 允许2%的误差
        
        # 检查所有图片是否为16:9比例，并找到最小尺寸
        min_width = float('inf')
        min_height = float('inf')
        
        for idx, img in enumerate(editable_images):
            aspect_ratio = img.width / img.height
            ratio_diff = abs(aspect_ratio - ASPECT_RATIO_16_9) / ASPECT_RATIO_16_9
            
            if ratio_diff > ASPECT_RATIO_TOLERANCE:
                logger.error(f"图片 {idx + 1} ({image_paths[idx]}) 不是16:9比例: "
                           f"{img.width}x{img.height} (比例 {aspect_ratio:.4f}, 期望 {ASPECT_RATIO_16_9:.4f})")
                raise ValueError(f"所有图片必须是16:9比例，但第 {idx + 1} 张图片 ({img.width}x{img.height}) 不符合要求")
            
            min_width = min(min_width, img.width)
            min_height = min(min_height, img.height)
            logger.info(f"图片 {idx + 1}: {img.width}x{img.height} (比例 {aspect_ratio:.4f})")
        
        slide_width_pixels = int(min_width)
        slide_height_pixels = int(min_height)
        logger.info(f"统一使用最小尺寸作为幻灯片尺寸: {slide_width_pixels}x{slide_height_pixels}")
        
        # 如果图片尺寸不一致，给出警告
        if any(img.width != slide_width_pixels or img.height != slide_height_pixels for img in editable_images):
            logger.warning(f"图片尺寸不一致，已统一到最小尺寸 {slide_width_pixels}x{slide_height_pixels}")
    else:
        # 如果没有图片，使用默认尺寸
        slide_width_pixels = 1920
        slide_height_pixels = 1080
        logger.warning("没有图片，使用默认尺寸: 1920x1080")
    
    ExportService.create_editable_pptx_with_recursive_analysis(
        editable_images=editable_images,
        output_file=output_file,
        slide_width_pixels=slide_width_pixels,
        slide_height_pixels=slide_height_pixels,
        text_attribute_extractor=text_attribute_extractor,
        progress_callback=progress_callback
    )
    
    logger.info(f"✓ 导出完成: {output_file}")


def main():
    parser = argparse.ArgumentParser(
        description='从图片生成可编辑的 PPTX 文件',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  %(prog)s slide1.png slide2.png -o presentation.pptx
  %(prog)s ./slides/ --extractor hybrid --inpaint baidu
  %(prog)s image.png --no-text-styles

成本提示:
  - 'generative' 和 'hybrid' 背景修复方法会调用文生图模型 API
  - '--no-text-styles' 可跳过文字样式提取，减少 API 调用
        """
    )
    
    parser.add_argument(
        'images',
        nargs='+',
        help='图片文件或目录路径'
    )
    
    parser.add_argument(
        '-o', '--output',
        default='output_editable.pptx',
        help='输出 PPTX 文件路径（默认: output_editable.pptx）'
    )
    
    parser.add_argument(
        '--extractor',
        choices=['mineru', 'hybrid'],
        default='hybrid',
        help='组件提取方法（默认: hybrid）'
    )
    
    parser.add_argument(
        '--inpaint',
        choices=['generative', 'baidu', 'hybrid'],
        default='hybrid',
        help='背景修复方法（默认: hybrid）。generative/hybrid 会调用文生图模型'
    )
    
    parser.add_argument(
        '--no-text-styles',
        action='store_true',
        help='跳过文字样式提取（减少 API 调用）'
    )
    
    parser.add_argument(
        '-v', '--verbose',
        action='store_true',
        help='显示详细日志'
    )
    
    args = parser.parse_args()
    
    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)
    
    # 收集图片路径
    image_paths = collect_image_paths(args.images)
    
    if not image_paths:
        logger.error("未找到任何图片文件")
        sys.exit(1)
    
    logger.info(f"找到 {len(image_paths)} 张图片:")
    for path in image_paths:
        logger.info(f"  - {path}")
    
    # 初始化 Flask 应用
    app = setup_flask_app()
    
    with app.app_context():
        try:
            export_editable_pptx(
                image_paths=image_paths,
                output_file=args.output,
                extractor_method=args.extractor,
                inpaint_method=args.inpaint,
                extract_text_styles=not args.no_text_styles
            )
        except Exception as e:
            logger.error(f"导出失败: {e}", exc_info=True)
            sys.exit(1)


if __name__ == '__main__':
    main()

