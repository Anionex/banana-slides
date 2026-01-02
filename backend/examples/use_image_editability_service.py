"""
ImageEditabilityService 使用示例

展示如何使用图片可编辑化服务
"""
import os
import sys
import json
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed

# 添加backend目录到路径
sys.path.insert(0, str(Path(__file__).parent.parent))

from services.image_editability import (
    ImageEditabilityService,
    ServiceConfig,
    BBox,
    CoordinateMapper
)


def example_1_single_image():
    """示例1: 分析单张图片"""
    print("\n" + "="*60)
    print("示例1: 分析单张图片")
    print("="*60)
    
    # 创建配置
    config = ServiceConfig.from_defaults(
        mineru_token="your_mineru_token_here",
        mineru_api_base="https://mineru.net",
        max_depth=2,          # 最多递归2层
        min_image_size=200,   # 小于200px的图片不递归
        min_image_area=40000  # 小于40000px²的图片不递归
    )
    
    # 创建服务实例
    service = ImageEditabilityService(config)
    
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
    
    # 创建配置和服务（一次创建，多次使用）
    config = ServiceConfig.from_defaults(
        mineru_token="your_mineru_token_here",
        max_depth=2
    )
    service = ImageEditabilityService(config)
    
    # 多张图片路径（例如PPT的多页）
    image_paths = [
        "/path/to/slide1.png",
        "/path/to/slide2.png",
        "/path/to/slide3.png",
    ]
    
    print(f"正在并发分析 {len(image_paths)} 张图片...")
    
    # 并发处理（由调用者控制并发）
    results = []
    with ThreadPoolExecutor(max_workers=4) as executor:
        futures = {
            executor.submit(service.make_image_editable, img_path): idx
            for idx, img_path in enumerate(image_paths)
        }
        
        # 按原顺序收集结果
        results = [None] * len(image_paths)
        for future in as_completed(futures):
            idx = futures[future]
            try:
                results[idx] = future.result()
                print(f"  ✓ 完成 {image_paths[idx]}")
            except Exception as e:
                print(f"  ✗ 失败 {image_paths[idx]}: {e}")
    
    print(f"\n成功处理 {len([r for r in results if r])} 张图片")
    return results


def example_3_coordinate_mapping():
    """示例3: 坐标映射（局部坐标 <-> 全局坐标）"""
    print("\n" + "="*60)
    print("示例3: 坐标映射")
    print("="*60)
    
    # 假设我们有一个父图（PPT页面）中的子图（嵌入的图表）
    # 父图尺寸: 1920x1080
    # 子图在父图中的位置: (100, 200) - (500, 600)
    # 子图内部某个元素的位置: (50, 50) - (150, 100)
    
    parent_bbox = BBox(x0=100, y0=200, x1=500, y1=600)
    local_bbox = BBox(x0=50, y0=50, x1=150, y1=100)
    
    # 局部坐标 -> 全局坐标
    global_bbox = CoordinateMapper.local_to_global(
        local_bbox=local_bbox,
        parent_bbox=parent_bbox,
        local_image_size=(400, 400),   # 子图尺寸
        parent_image_size=(1920, 1080)  # 父图尺寸
    )
    
    print(f"子图bbox (父图坐标系): {parent_bbox.to_dict()}")
    print(f"元素bbox (子图坐标系): {local_bbox.to_dict()}")
    print(f"元素bbox (父图坐标系): {global_bbox.to_dict()}")
    
    # 全局坐标 -> 局部坐标
    recovered_local = CoordinateMapper.global_to_local(
        global_bbox=global_bbox,
        parent_bbox=parent_bbox,
        local_image_size=(400, 400),
        parent_image_size=(1920, 1080)
    )
    
    print(f"恢复的局部bbox: {recovered_local.to_dict()}")


def example_4_custom_config():
    """示例4: 自定义配置"""
    print("\n" + "="*60)
    print("示例4: 自定义配置")
    print("="*60)
    
    # 快速模式：不递归
    config_fast = ServiceConfig.from_defaults(
        mineru_token="xxx",
        max_depth=0  # 不递归
    )
    
    # 深度模式：最多递归3层
    config_deep = ServiceConfig.from_defaults(
        mineru_token="xxx",
        max_depth=3,
        min_image_size=100,  # 更小的图片也递归
        min_image_area=10000
    )
    
    print("快速模式: max_depth=0")
    print("深度模式: max_depth=3, min_size=100")


if __name__ == "__main__":
    print("ImageEditabilityService 使用示例")
    print("注意: 运行前请替换 mineru_token 和图片路径")
    
    # 取消注释以运行示例
    # example_1_single_image()
    # example_2_multi_images()
    example_3_coordinate_mapping()
    example_4_custom_config()
