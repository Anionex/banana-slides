"""
实际测试：单张图片导出为可编辑PPTX
"""
import os
import sys
import logging
from pathlib import Path

# 添加backend目录到路径
sys.path.insert(0, str(Path(__file__).parent))

# 配置详细日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(name)s - %(message)s'
)
logger = logging.getLogger(__name__)

def main():
    print("\n" + "="*80)
    print("测试递归图片可编辑化服务 - 单张图片导出PPTX")
    print("="*80)
    
    # 1. 检查环境配置
    print("\n[1/5] 检查环境配置...")
    from config import get_config
    config = get_config()
    
    print(f"  MinerU Token: {'✅ 已配置' if config.MINERU_TOKEN else '❌ 未配置'}")
    print(f"  Volcengine AK: {'✅ 已配置' if config.VOLCENGINE_ACCESS_KEY else '❌ 未配置'}")
    print(f"  Volcengine SK: {'✅ 已配置' if config.VOLCENGINE_SECRET_KEY else '❌ 未配置'}")
    
    if not config.MINERU_TOKEN:
        print("\n❌ 错误：MinerU Token 未配置，无法继续测试")
        return 1
    
    # 2. 选择测试图片
    print("\n[2/5] 选择测试图片...")
    upload_folder = Path(config.UPLOAD_FOLDER)
    
    # 查找第一个可用的页面图片
    test_image = None
    for png_file in upload_folder.glob("*/pages/*.png"):
        # 排除mask文件
        if "_mask" not in png_file.name and png_file.exists():
            test_image = str(png_file)
            break
    
    if not test_image:
        print("  ❌ 未找到测试图片")
        return 1
    
    print(f"  ✅ 找到测试图片: {test_image}")
    
    # 检查图片尺寸
    from PIL import Image
    img = Image.open(test_image)
    print(f"  图片尺寸: {img.width}x{img.height}")
    img.close()
    
    # 3. 初始化服务
    print("\n[3/5] 初始化 ImageEditabilityService...")
    from services.image_editability import ImageEditabilityService, ServiceConfig
    
    try:
        service = ImageEditabilityService(
            mineru_token=config.MINERU_TOKEN,
            mineru_api_base=config.MINERU_API_BASE,
            max_depth=1,  # 只分析1层，加快测试
            min_image_size=300,  # 提高阈值，减少递归
            upload_folder=config.UPLOAD_FOLDER
        )
        print("  ✅ 服务初始化成功")
        print(f"  Inpainting服务: {'✅ 已启用' if service.inpainting_service else '⚠️  未启用'}")
    except Exception as e:
        print(f"  ❌ 服务初始化失败: {e}")
        import traceback
        traceback.print_exc()
        return 1
    
    # 4. 分析图片（可编辑化）
    print("\n[4/5] 分析图片（这可能需要1-2分钟）...")
    print("  → 转换为PDF")
    print("  → 上传MinerU解析")
    print("  → 提取元素bbox")
    print("  → 生成clean background (使用Volcengine Inpainting)")
    
    try:
        editable_img = service.make_image_editable(test_image)
        
        print(f"\n  ✅ 分析完成！")
        print(f"  图片ID: {editable_img.image_id}")
        print(f"  尺寸: {editable_img.width}x{editable_img.height}")
        print(f"  提取的元素数量: {len(editable_img.elements)}")
        print(f"  Clean background: {editable_img.clean_background if editable_img.clean_background else '未生成'}")
        print(f"  深度: {editable_img.depth}")
        
        # 显示元素详情
        if editable_img.elements:
            print(f"\n  元素列表:")
            for idx, elem in enumerate(editable_img.elements[:10], 1):  # 只显示前10个
                print(f"    {idx}. {elem.element_type}")
                print(f"       bbox: ({elem.bbox.x0:.0f}, {elem.bbox.y0:.0f}, {elem.bbox.x1:.0f}, {elem.bbox.y1:.0f})")
                if elem.content:
                    content_preview = elem.content[:30] + "..." if len(elem.content) > 30 else elem.content
                    print(f"       内容: {content_preview}")
            if len(editable_img.elements) > 10:
                print(f"    ... 还有 {len(editable_img.elements) - 10} 个元素")
        
    except Exception as e:
        print(f"\n  ❌ 分析失败: {e}")
        import traceback
        traceback.print_exc()
        return 1
    
    # 5. 导出为PPTX
    print("\n[5/5] 导出为PPTX...")
    from services.export_service import ExportService
    
    output_file = upload_folder / "test_output.pptx"
    
    try:
        ExportService.create_editable_pptx_with_recursive_analysis(
            image_paths=[test_image],
            output_file=str(output_file),
            slide_width_pixels=editable_img.width,
            slide_height_pixels=editable_img.height,
            mineru_token=config.MINERU_TOKEN,
            mineru_api_base=config.MINERU_API_BASE,
            max_depth=1,
            max_workers=1
        )
        
        print(f"  ✅ PPTX已生成: {output_file}")
        print(f"  文件大小: {output_file.stat().st_size / 1024:.2f} KB")
        
    except Exception as e:
        print(f"\n  ❌ 导出失败: {e}")
        import traceback
        traceback.print_exc()
        return 1
    
    # 完成
    print("\n" + "="*80)
    print("✅ 测试完成！")
    print("="*80)
    print(f"\n输出文件: {output_file}")
    print("请打开PPTX文件查看结果。\n")
    
    return 0


if __name__ == "__main__":
    sys.exit(main())

