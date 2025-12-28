"""
测试指定图片导出为可编辑PPTX
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
    # 测试图片路径（WSL格式）
    test_image = "/mnt/d/Desktop/banana-slides/test_outputs/b69fee8d-0f97-4ad9-a3a5-1ea5a88085d8_1766468506083.png"
    
    print("\n" + "="*80)
    print("测试递归图片可编辑化服务 - 单张图片导出PPTX")
    print("="*80)
    
    # 检查图片是否存在
    if not os.path.exists(test_image):
        print(f"\n❌ 图片不存在: {test_image}")
        return 1
    
    print(f"\n✅ 测试图片: {test_image}")
    
    # 1. 从.env文件读取配置
    print("\n[1/5] 读取配置...")
    from dotenv import load_dotenv
    
    # 加载根目录的.env文件
    env_path = Path(__file__).parent.parent / '.env'
    load_dotenv(env_path)
    
    mineru_token = os.getenv('MINERU_TOKEN')
    mineru_api_base = os.getenv('MINERU_API_BASE', 'https://mineru.net')
    upload_folder = os.getenv('UPLOAD_FOLDER', '/mnt/d/Desktop/banana-slides/uploads')
    volcengine_ak = os.getenv('VOLCENGINE_ACCESS_KEY')
    volcengine_sk = os.getenv('VOLCENGINE_SECRET_KEY')
        
    print(f"  MinerU Token: {'✅ 已配置' if mineru_token else '❌ 未配置'}")
    print(f"  MinerU API: {mineru_api_base}")
    print(f"  Volcengine AK: {'✅ 已配置' if volcengine_ak else '❌ 未配置'}")
    print(f"  Volcengine SK: {'✅ 已配置' if volcengine_sk else '❌ 未配置'}")
    print(f"  Upload Folder: {upload_folder}")
    
    if not mineru_token:
        print("\n❌ 错误：MinerU Token 未配置")
        return 1
    
    # 2. 检查图片尺寸
    print("\n[2/5] 检查图片...")
    from PIL import Image
    img = Image.open(test_image)
    print(f"  图片尺寸: {img.width}x{img.height}")
    print(f"  图片模式: {img.mode}")
    img.close()
    
    # 3. 初始化服务
    print("\n[3/5] 初始化 ImageEditabilityService...")
    from services.image_editability_service import ImageEditabilityService
    from services.inpainting_service import InpaintingService
    
    # 初始化Gemini Inpainting服务
    google_api_key = os.getenv('GOOGLE_API_KEY')
    google_api_base = os.getenv('GOOGLE_API_BASE')
    
    if not google_api_key:
        print("  ❌ 错误：GOOGLE_API_KEY 未配置")
        return 1
    
    print(f"  Google API Key: {'✅ 已配置' if google_api_key else '❌ 未配置'}")
    if google_api_base:
        print(f"  Google API Base: {google_api_base}")
    
    try:
        # 创建Gemini Inpainting服务
        gemini_inpainting = InpaintingService(provider_type="gemini")
        print(f"  ✅ Gemini Inpainting服务已创建")
        
        service = ImageEditabilityService(
            mineru_token=mineru_token,
            mineru_api_base=mineru_api_base,
            inpainting_service=gemini_inpainting,  # 传入Gemini服务
            max_depth=1,  # 只分析1层，加快测试
            min_image_size=300,
            min_image_area=90000,
            upload_folder=upload_folder
        )
        print("  ✅ 服务初始化成功")
        
        if service.inpainting_service:
            provider_type = type(service.inpainting_service.provider).__name__
            print(f"  ✅ Inpainting服务已启用")
            print(f"     Provider: {provider_type}")
            print(f"     Provider类型: {service.inpainting_service.provider_type}")
        else:
            print("  ⚠️  Inpainting服务未启用（将跳过背景生成）")
            
    except Exception as e:
        print(f"  ❌ 服务初始化失败: {e}")
        import traceback
        traceback.print_exc()
        return 1
    
    # 4. 分析图片（可编辑化）
    print("\n[4/5] 分析图片（这可能需要1-3分钟）...")
    print("  步骤:")
    print("  1) 转换为PDF")
    print("  2) 上传MinerU解析")
    print("  3) 提取元素bbox和内容")
    print("  4) 使用Gemini Inpainting生成clean background")
    print("  5) 检查是否有子图需要递归分析")
    print("\n  请等待...")
    
    try:
        editable_img = service.make_image_editable(test_image)
        
        print(f"\n  ✅ 分析完成！")
        print(f"\n  结果:")
        print(f"    图片ID: {editable_img.image_id}")
        print(f"    尺寸: {editable_img.width}x{editable_img.height}")
        print(f"    递归深度: {editable_img.depth}")
        print(f"    提取的元素数量: {len(editable_img.elements)}")
        print(f"    Clean background: {'✅ 已生成' if editable_img.clean_background else '⚠️  未生成'}")
        if editable_img.clean_background:
            print(f"      路径: {editable_img.clean_background}")
        print(f"    MinerU结果: {editable_img.mineru_result_dir}")
        
        # 显示元素详情
        if editable_img.elements:
            print(f"\n  元素详情:")
            element_types = {}
            for elem in editable_img.elements:
                element_types[elem.element_type] = element_types.get(elem.element_type, 0) + 1
            
            for elem_type, count in element_types.items():
                print(f"    - {elem_type}: {count}个")
            
            print(f"\n  前5个元素:")
            for idx, elem in enumerate(editable_img.elements[:5], 1):
                print(f"    {idx}. {elem.element_type}")
                print(f"       位置: ({elem.bbox.x0:.0f}, {elem.bbox.y0:.0f}) -> ({elem.bbox.x1:.0f}, {elem.bbox.y1:.0f})")
                print(f"       尺寸: {elem.bbox.width:.0f}x{elem.bbox.height:.0f}")
                if elem.content:
                    content_preview = elem.content[:40].replace('\n', ' ')
                    if len(elem.content) > 40:
                        content_preview += "..."
                    print(f"       内容: {content_preview}")
                if elem.children:
                    print(f"       子元素: {len(elem.children)}个")
        else:
            print(f"\n  ⚠️  未提取到任何元素")
        
    except Exception as e:
        print(f"\n  ❌ 分析失败: {e}")
        import traceback
        traceback.print_exc()
        return 1
    
    # 5. 导出为PPTX（复用已分析的结果，避免重复调用）
    print("\n[5/5] 导出为PPTX（复用分析结果）...")
    from services.export_service import ExportService
    
    import time
    timestamp = int(time.time())
    output_file = os.path.join(upload_folder, f"test_recursive_export_{timestamp}.pptx")
    
    try:
        # 直接传入已分析的editable_img，避免重复分析！
        ExportService.create_editable_pptx_with_recursive_analysis(
            editable_images=[editable_img],  # 复用第4步的分析结果
            output_file=output_file,
            slide_width_pixels=editable_img.width,
            slide_height_pixels=editable_img.height
        )
        
        if os.path.exists(output_file):
            file_size_kb = os.path.getsize(output_file) / 1024
            print(f"  ✅ PPTX已生成!")
            print(f"     路径: {output_file}")
            print(f"     大小: {file_size_kb:.2f} KB")
        else:
            print(f"  ❌ PPTX文件未找到: {output_file}")
            return 1
        
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
    print("\n使用的技术:")
    print("  • MinerU: 版面分析和元素提取")
    print("  • Gemini Inpainting: 生成clean background（纯黑色mask标注）")
    print("  • 递归分析: 识别图片中的子图和图表")
    print("  • 智能坐标映射: 父子坐标转换")
    print("\n请打开PPTX文件查看可编辑结果！\n")
    
    return 0


if __name__ == "__main__":
    sys.exit(main())

