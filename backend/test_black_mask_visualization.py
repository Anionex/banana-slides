"""
测试纯黑色框标注的可视化效果
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))

from PIL import Image, ImageDraw
import numpy as np
from services.ai_providers.image.gemini_inpainting_provider import GeminiInpaintingProvider
from utils.mask_utils import create_mask_from_bboxes

def create_test_image(width=800, height=600):
    """创建一个测试图像"""
    image = Image.new('RGB', (width, height), color=(200, 220, 240))
    draw = ImageDraw.Draw(image)
    
    # 绘制一些内容
    for i in range(5):
        x = 50 + i * 150
        y = 100 + i * 80
        draw.rectangle([x, y, x+100, y+60], fill=(255, 200, 200), outline=(0, 0, 0), width=2)
        draw.text((x+10, y+20), f"Text {i+1}", fill=(0, 0, 0))
    
    return image

def main():
    print("="*60)
    print("测试纯黑色框标注的可视化效果")
    print("="*60)
    
    # 1. 创建测试图像
    print("\n1. 创建测试图像...")
    test_image = create_test_image()
    test_image.save("test_outputs/original_test_image.png")
    print("   ✅ 测试图像已保存: test_outputs/original_test_image.png")
    
    # 2. 定义需要消除的区域（覆盖所有5个粉色矩形）
    bboxes = [
        (50, 100, 150, 160),    # 第一个框
        (200, 180, 300, 240),   # 第二个框
        (350, 260, 450, 320),   # 第三个框
        (500, 340, 600, 400),   # 第四个框
        (650, 420, 750, 480),   # 第五个框
    ]
    print(f"\n2. 定义消除区域 (共{len(bboxes)}个bbox)")
    for i, bbox in enumerate(bboxes, 1):
        print(f"   [{i}] {bbox}")
    
    # 3. 创建掩码图像
    print("\n3. 创建掩码图像...")
    mask_image = create_mask_from_bboxes(test_image.size, bboxes, expand_pixels=5)
    mask_image.save("test_outputs/mask_white_on_black.png")
    print("   ✅ 掩码图像已保存: test_outputs/mask_white_on_black.png")
    
    # 4. 使用新方法创建标注图像（纯黑色框）
    print("\n4. 创建纯黑色框标注图像...")
    marked_image = GeminiInpaintingProvider.create_marked_image(test_image, mask_image)
    marked_image.save("test_outputs/marked_image_black_rectangles.png")
    print("   ✅ 标注图像已保存: test_outputs/marked_image_black_rectangles.png")
    print("   📌 黑色矩形表示需要AI模型重绘的区域")
    
    # 5. 显示Prompt
    print("\n5. 用于Gemini的Prompt:")
    print("-" * 60)
    print(GeminiInpaintingProvider.DEFAULT_PROMPT)
    print("-" * 60)
    
    print("\n✅ 测试完成！")
    print("\n📂 生成的文件:")
    print("   - test_outputs/original_test_image.png (原始测试图像)")
    print("   - test_outputs/mask_white_on_black.png (掩码图像)")
    print("   - test_outputs/marked_image_black_rectangles.png (黑色框标注图像)")
    print("\n🎯 关键变化:")
    print("   1. 红色半透明叠加 + 红色边框 → 纯黑色矩形")
    print("   2. Prompt强调: 必须重绘所有黑色矩形区域，一个不漏")
    print("   3. 更清晰的标注，避免AI模型遗漏")
    print("="*60)

if __name__ == "__main__":
    main()

