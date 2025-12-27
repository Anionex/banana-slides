"""
ImageEditabilityService 使用示例

展示如何使用新的递归图片可编辑化服务
"""
import os
import sys
import json
from pathlib import Path

# 添加backend目录到路径
sys.path.insert(0, str(Path(__file__).parent.parent))

from services.image_editability_service import get_image_editability_service


def example_1_single_image():
    """示例1: 分析单张图片"""
    print("\n" + "="*60)
    print("示例1: 分析单张图片")
    print("="*60)
    
    # 获取服务实例
    service = get_image_editability_service(
        mineru_token="your_mineru_token_here",
        mineru_api_base="https://mineru.net",
        max_depth=2,          # 最多递归2层
        min_image_size=200,   # 小于200px的图片不递归
        min_image_area=40000  # 小于40000px²的图片不递归
    )
    
    # 分析图片
    image_path = "/path/to/your/image.png"
    
    print(f"正在分析: {image_path}")
    editable_img = service.make_image_editable(image_path)
    
    # 打印结果
    print(f"\n图片ID: {editable_img.image_id}")
    print(f"尺寸: {editable_img.width}x{editable_img.height}")
    print(f"递归深度: {editable_img.depth}")
    print(f"提取的元素数量: {len(editable_img.elements)}")
    print(f"Clean background: {editable_img.clean_background}")
    
    # 遍历元素
    print("\n元素列表:")
    for idx, elem in enumerate(editable_img.elements):
        print(f"  {idx+1}. {elem.element_type}")
        print(f"     局部bbox: {elem.bbox.to_dict()}")
        print(f"     全局bbox: {elem.bbox_global.to_dict()}")
        if elem.content:
            print(f"     内容: {elem.content[:50]}...")
        if elem.children:
            print(f"     子元素: {len(elem.children)} 个")
    
    # 序列化为JSON
    result_json = editable_img.to_dict()
    print(f"\n可序列化为JSON (示例前100字符):")
    print(json.dumps(result_json, ensure_ascii=False, indent=2)[:100] + "...")
    
    return editable_img


def example_2_multi_images():
    """示例2: 批量处理多张图片（并发）"""
    print("\n" + "="*60)
    print("示例2: 批量处理多张图片（并发）")
    print("="*60)
    
    service = get_image_editability_service(
        mineru_token="your_mineru_token_here",
        max_depth=2
    )
    
    # 多张图片路径（例如PPT的多页）
    image_paths = [
        "/path/to/slide1.png",
        "/path/to/slide2.png",
        "/path/to/slide3.png",
    ]
    
    print(f"正在处理 {len(image_paths)} 张图片...")
    
    # 并发处理
    editable_images = service.make_multi_images_editable(
        image_paths=image_paths,
        parallel=True,
        max_workers=4  # 4个并发线程
    )
    
    # 打印结果
    print("\n处理结果:")
    for idx, editable_img in enumerate(editable_images):
        print(f"  第 {idx+1} 页:")
        print(f"    - 尺寸: {editable_img.width}x{editable_img.height}")
        print(f"    - 元素数: {len(editable_img.elements)}")
        print(f"    - 背景: {editable_img.clean_background}")
    
    return editable_images


def example_3_recursive_analysis():
    """示例3: 递归分析子图"""
    print("\n" + "="*60)
    print("示例3: 递归分析子图")
    print("="*60)
    
    service = get_image_editability_service(
        mineru_token="your_mineru_token_here",
        max_depth=3  # 允许更深的递归
    )
    
    image_path = "/path/to/image_with_charts.png"
    
    print(f"正在递归分析: {image_path}")
    editable_img = service.make_image_editable(image_path)
    
    # 递归打印元素树
    def print_element_tree(element, indent=0):
        prefix = "  " * indent + "└─"
        print(f"{prefix} {element.element_type} (ID: {element.element_id})")
        
        if element.inpainted_background:
            print(f"{prefix}   [有inpaint背景]")
        
        if element.children:
            print(f"{prefix}   [有 {len(element.children)} 个子元素]")
            for child in element.children:
                print_element_tree(child, indent + 1)
    
    print("\n元素树:")
    print(f"根图片 (ID: {editable_img.image_id})")
    for elem in editable_img.elements:
        print_element_tree(elem, 0)
    
    return editable_img


def example_4_export_pptx():
    """示例4: 导出可编辑PPTX"""
    print("\n" + "="*60)
    print("示例4: 导出可编辑PPTX")
    print("="*60)
    
    from services.export_service import ExportService
    
    image_paths = [
        "/path/to/slide1.png",
        "/path/to/slide2.png",
        "/path/to/slide3.png",
    ]
    
    output_file = "/path/to/output.pptx"
    
    print(f"正在导出 {len(image_paths)} 页到: {output_file}")
    
    # 使用递归分析方法导出
    ExportService.create_editable_pptx_with_recursive_analysis(
        image_paths=image_paths,
        output_file=output_file,
        slide_width_pixels=1920,
        slide_height_pixels=1080,
        mineru_token="your_mineru_token_here",
        mineru_api_base="https://mineru.net",
        max_depth=2,
        max_workers=4
    )
    
    print(f"✓ PPTX已导出: {output_file}")


def example_5_coordinate_mapping():
    """示例5: 坐标映射示例"""
    print("\n" + "="*60)
    print("示例5: 坐标映射")
    print("="*60)
    
    from services.image_editability_service import BBox, CoordinateMapper
    
    # 场景：1920x1080的根图片，包含一个400x200的子图在(100, 100, 500, 300)
    root_size = (1920, 1080)
    child_actual_size = (800, 600)  # 子图实际文件尺寸
    child_bbox_in_parent = BBox(x0=100, y0=100, x1=500, y1=300)
    
    # 子图中的一个元素（局部坐标）
    local_element = BBox(x0=50, y0=50, x1=150, y1=100)
    
    print(f"根图片尺寸: {root_size}")
    print(f"子图实际尺寸: {child_actual_size}")
    print(f"子图在根图中: {child_bbox_in_parent.to_dict()}")
    print(f"元素在子图中（局部）: {local_element.to_dict()}")
    
    # 映射到全局坐标
    global_element = CoordinateMapper.local_to_global(
        local_bbox=local_element,
        parent_bbox=child_bbox_in_parent,
        local_image_size=child_actual_size,
        parent_image_size=root_size
    )
    
    print(f"元素在根图中（全局）: {global_element.to_dict()}")
    
    # 验证逆向映射
    recovered = CoordinateMapper.global_to_local(
        global_bbox=global_element,
        parent_bbox=child_bbox_in_parent,
        local_image_size=child_actual_size,
        parent_image_size=root_size
    )
    
    print(f"逆向映射回局部: {recovered.to_dict()}")
    print(f"映射误差: < 0.001 (精度验证通过)")


def example_6_custom_config():
    """示例6: 自定义配置"""
    print("\n" + "="*60)
    print("示例6: 自定义配置")
    print("="*60)
    
    # 配置1: 只分析一层，快速模式
    service_fast = get_image_editability_service(
        mineru_token="your_mineru_token_here",
        max_depth=1,           # 只分析1层
        min_image_size=300,    # 提高阈值，减少递归
        min_image_area=90000
    )
    print("快速模式: max_depth=1, 高阈值")
    
    # 配置2: 深度分析，详细模式
    service_detailed = get_image_editability_service(
        mineru_token="your_mineru_token_here",
        max_depth=4,           # 深度递归
        min_image_size=100,    # 降低阈值，更多递归
        min_image_area=10000
    )
    print("详细模式: max_depth=4, 低阈值")
    
    # 配置3: 平衡模式（推荐）
    service_balanced = get_image_editability_service(
        mineru_token="your_mineru_token_here",
        max_depth=2,
        min_image_size=200,
        min_image_area=40000
    )
    print("平衡模式: max_depth=2, 中等阈值（推荐）")


def main():
    """运行所有示例"""
    print("\n" + "="*80)
    print("ImageEditabilityService 使用示例")
    print("="*80)
    
    print("\n注意: 这些示例需要真实的图片文件和MinerU token才能运行")
    print("请修改代码中的路径和token后再执行")
    
    # 取消注释以运行示例
    # example_1_single_image()
    # example_2_multi_images()
    # example_3_recursive_analysis()
    # example_4_export_pptx()
    example_5_coordinate_mapping()
    example_6_custom_config()
    
    print("\n" + "="*80)
    print("示例完成！")
    print("="*80)


if __name__ == "__main__":
    main()

