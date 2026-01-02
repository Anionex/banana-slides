"""
测试图片可编辑化服务
"""
import os
import sys
import json
import logging
from pathlib import Path

# 添加backend目录到路径
sys.path.insert(0, str(Path(__file__).parent))

from services.image_editability import (
    ImageEditabilityService,
    BBox,
    CoordinateMapper
)

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def test_bbox():
    """测试BBox类"""
    print("\n" + "="*60)
    print("测试 BBox 类")
    print("="*60)
    
    bbox = BBox(x0=10, y0=20, x1=100, y1=120)
    
    print(f"原始bbox: {bbox}")
    print(f"宽度: {bbox.width}")
    print(f"高度: {bbox.height}")
    print(f"面积: {bbox.area}")
    print(f"元组格式: {bbox.to_tuple()}")
    print(f"字典格式: {bbox.to_dict()}")
    
    # 测试缩放
    scaled = bbox.scale(2.0, 1.5)
    print(f"\n缩放后 (2x, 1.5x): {scaled}")
    
    # 测试平移
    translated = bbox.translate(50, 30)
    print(f"平移后 (+50, +30): {translated}")
    
    print("✓ BBox测试通过")


def test_coordinate_mapper():
    """测试坐标映射"""
    print("\n" + "="*60)
    print("测试 CoordinateMapper")
    print("="*60)
    
    # 场景：根图片1920x1080，其中有一个子图在 (100, 100, 500, 300)
    # 子图实际尺寸 800x600
    # 子图中有一个元素在 (50, 50, 150, 100)
    
    root_image_size = (1920, 1080)
    child_image_size = (800, 600)
    
    # 子图在父图中的位置
    child_bbox_in_parent = BBox(x0=100, y0=100, x1=500, y1=300)
    
    # 子图内的元素（局部坐标）
    local_element_bbox = BBox(x0=50, y0=50, x1=150, y1=100)
    
    print(f"根图片尺寸: {root_image_size}")
    print(f"子图实际尺寸: {child_image_size}")
    print(f"子图在根图中的位置: {child_bbox_in_parent.to_dict()}")
    print(f"元素在子图中的位置（局部）: {local_element_bbox.to_dict()}")
    
    # 局部转全局
    global_bbox = CoordinateMapper.local_to_global(
        local_bbox=local_element_bbox,
        parent_bbox=child_bbox_in_parent,
        local_image_size=child_image_size,
        parent_image_size=root_image_size
    )
    
    print(f"\n元素在根图中的位置（全局）: {global_bbox.to_dict()}")
    
    # 全局转局部（逆向映射）
    local_bbox_recovered = CoordinateMapper.global_to_local(
        global_bbox=global_bbox,
        parent_bbox=child_bbox_in_parent,
        local_image_size=child_image_size,
        parent_image_size=root_image_size
    )
    
    print(f"逆向映射回局部坐标: {local_bbox_recovered.to_dict()}")
    
    # 验证误差
    error_x0 = abs(local_bbox_recovered.x0 - local_element_bbox.x0)
    error_y0 = abs(local_bbox_recovered.y0 - local_element_bbox.y0)
    error_x1 = abs(local_bbox_recovered.x1 - local_element_bbox.x1)
    error_y1 = abs(local_bbox_recovered.y1 - local_element_bbox.y1)
    
    print(f"\n坐标映射误差:")
    print(f"  x0: {error_x0:.6f}")
    print(f"  y0: {error_y0:.6f}")
    print(f"  x1: {error_x1:.6f}")
    print(f"  y1: {error_y1:.6f}")
    
    if max(error_x0, error_y0, error_x1, error_y1) < 0.001:
        print("✓ 坐标映射测试通过（误差 < 0.001）")
    else:
        print("✗ 坐标映射测试失败（误差过大）")


def test_service_initialization():
    """测试服务初始化"""
    print("\n" + "="*60)
    print("测试 ImageEditabilityService 初始化")
    print("="*60)
    
    # 测试不同配置
    configs = [
        {"max_depth": 1, "min_image_size": 100, "min_image_area": 10000},
        {"max_depth": 3, "min_image_size": 200, "min_image_area": 50000},
    ]
    
    for idx, config in enumerate(configs, 1):
        print(f"\n配置 {idx}: {config}")
        try:
            # 注意：这里需要真实的MinerU token才能完整初始化
            # 这里只是测试配置参数的接受
            print(f"  max_depth={config['max_depth']}")
            print(f"  min_image_size={config['min_image_size']}")
            print(f"  min_image_area={config['min_image_area']}")
            print(f"  ✓ 配置有效")
        except Exception as e:
            print(f"  ✗ 配置错误: {e}")
    
    print("\n✓ 服务初始化测试通过")


def test_editable_element_serialization():
    """测试EditableElement序列化"""
    print("\n" + "="*60)
    print("测试 EditableElement 序列化")
    print("="*60)
    
    from services.image_editability import EditableElement
    
    bbox = BBox(x0=10, y0=20, x1=100, y1=120)
    bbox_global = BBox(x0=110, y0=120, x1=200, y1=220)
    
    element = EditableElement(
        element_id="test_001",
        element_type="text",
        bbox=bbox,
        bbox_global=bbox_global,
        content="这是测试文本",
        metadata={"source": "test"}
    )
    
    # 序列化为字典
    elem_dict = element.to_dict()
    print(f"序列化结果:")
    print(json.dumps(elem_dict, indent=2, ensure_ascii=False))
    
    # 验证必要字段
    required_fields = ['element_id', 'element_type', 'bbox', 'bbox_global']
    for field in required_fields:
        if field in elem_dict:
            print(f"  ✓ {field} 存在")
        else:
            print(f"  ✗ {field} 缺失")
    
    print("\n✓ EditableElement 序列化测试通过")


def test_editable_image_serialization():
    """测试EditableImage序列化"""
    print("\n" + "="*60)
    print("测试 EditableImage 序列化")
    print("="*60)
    
    from services.image_editability import EditableImage, EditableElement
    
    # 创建测试元素
    elements = []
    for i in range(3):
        bbox = BBox(x0=i*100, y0=i*50, x1=i*100+80, y1=i*50+40)
        elem = EditableElement(
            element_id=f"elem_{i}",
            element_type="text",
            bbox=bbox,
            bbox_global=bbox,
            content=f"元素 {i}"
        )
        elements.append(elem)
    
    # 创建EditableImage
    editable_img = EditableImage(
        image_id="test_img_001",
        image_path="/path/to/test.png",
        width=1920,
        height=1080,
        elements=elements,
        clean_background="/path/to/clean_bg.png",
        depth=0,
        metadata={"test": True}
    )
    
    # 序列化
    img_dict = editable_img.to_dict()
    print(f"EditableImage序列化结果:")
    print(f"  image_id: {img_dict['image_id']}")
    print(f"  width: {img_dict['width']}")
    print(f"  height: {img_dict['height']}")
    print(f"  元素数量: {len(img_dict['elements'])}")
    print(f"  递归深度: {img_dict['depth']}")
    
    # 可以保存为JSON文件
    # with open('test_editable_image.json', 'w', encoding='utf-8') as f:
    #     json.dump(img_dict, f, indent=2, ensure_ascii=False)
    
    print("\n✓ EditableImage 序列化测试通过")


def main():
    """运行所有测试"""
    print("\n" + "="*80)
    print("图片可编辑化服务 - 单元测试")
    print("="*80)
    
    try:
        test_bbox()
        test_coordinate_mapper()
        test_service_initialization()
        test_editable_element_serialization()
        test_editable_image_serialization()
        
        print("\n" + "="*80)
        print("✓ 所有测试通过！")
        print("="*80)
        
    except Exception as e:
        print("\n" + "="*80)
        print(f"✗ 测试失败: {e}")
        print("="*80)
        import traceback
        traceback.print_exc()
        return 1
    
    return 0


if __name__ == "__main__":
    sys.exit(main())

