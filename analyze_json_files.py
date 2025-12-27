#!/usr/bin/env python3
"""
分析 MinerU 输出的几个 JSON 文件的用途和区别
"""
import json
from pathlib import Path

def analyze_json_files():
    base_dir = Path("/mnt/d/Desktop/banana-slides/uploads/mineru_files/0739a078")
    
    # 文件路径
    layout_json = base_dir / "layout.json"
    content_list_json = base_dir / "c34f0b50-59ad-4d19-a339-df2f82854d56_content_list.json"
    model_json = base_dir / "c34f0b50-59ad-4d19-a339-df2f82854d56_model.json"
    
    print("=" * 80)
    print("MinerU JSON 文件分析")
    print("=" * 80)
    print()
    
    # 1. layout.json
    print("📄 1. layout.json")
    print("-" * 80)
    with open(layout_json, 'r', encoding='utf-8') as f:
        layout_data = json.load(f)
    
    print(f"文件大小: {layout_json.stat().st_size / 1024:.1f} KB")
    print(f"主要结构: {list(layout_data.keys())}")
    print(f"页面数量: {len(layout_data['pdf_info'])}")
    print(f"第一页块数量: {len(layout_data['pdf_info'][0]['para_blocks'])}")
    print()
    print("用途：")
    print("  - 最详细的布局信息文件")
    print("  - 包含完整的文档结构树（para_blocks -> blocks -> lines -> spans）")
    print("  - bbox 使用绝对像素坐标（例如：[148, 130, 1857, 247]）")
    print("  - 包含每个元素的层级关系和详细属性")
    print("  - 适合：需要精确重建文档布局、进行布局分析")
    print()
    
    # 示例数据
    first_block = layout_data['pdf_info'][0]['para_blocks'][0]
    print(f"示例 - 第一个块：")
    print(f"  类型: {first_block['type']}")
    print(f"  bbox: {first_block['bbox']} (绝对像素)")
    if 'lines' in first_block and first_block['lines']:
        print(f"  内容: {first_block['lines'][0]['spans'][0].get('content', 'N/A')}")
    print()
    print()
    
    # 2. content_list.json
    print("📄 2. content_list.json")
    print("-" * 80)
    with open(content_list_json, 'r', encoding='utf-8') as f:
        content_list_data = json.load(f)
    
    print(f"文件大小: {content_list_json.stat().st_size / 1024:.1f} KB")
    print(f"元素数量: {len(content_list_data)}")
    print()
    print("用途：")
    print("  - 扁平化的内容列表（一维数组）")
    print("  - 按文档阅读顺序排列的所有元素")
    print("  - bbox 使用归一化坐标（0-1范围，例如：[0.054, 0.085, 0.675, 0.161]）")
    print("  - 每个元素包含：type, text/img_path, bbox, page_idx")
    print("  - 适合：按顺序处理内容、生成 Markdown、内容提取")
    print()
    
    # 示例数据
    first_item = content_list_data[0]
    print(f"示例 - 第一个元素：")
    print(f"  类型: {first_item['type']}")
    print(f"  bbox: {first_item['bbox']} (归一化坐标 0-1)")
    print(f"  内容: {first_item.get('text', first_item.get('img_path', 'N/A'))}")
    print()
    print()
    
    # 3. model.json
    print("📄 3. model.json")
    print("-" * 80)
    with open(model_json, 'r', encoding='utf-8') as f:
        model_data = json.load(f)
    
    print(f"文件大小: {model_json.stat().st_size / 1024:.1f} KB")
    print(f"页面数量: {len(model_data)}")
    print(f"第一页元素数量: {len(model_data[0])}")
    print()
    print("用途：")
    print("  - 按页面分组的元素列表（二维数组 [页面][元素]）")
    print("  - bbox 也使用归一化坐标（0-1范围）")
    print("  - 结构简化，去除了层级关系")
    print("  - 每个元素包含：type, bbox, angle, content")
    print("  - 适合：ML 模型训练、页面级别的批处理")
    print()
    
    # 示例数据
    first_page_first_item = model_data[0][0]
    print(f"示例 - 第一页第一个元素：")
    print(f"  类型: {first_page_first_item['type']}")
    print(f"  bbox: {first_page_first_item['bbox']} (归一化坐标 0-1)")
    print(f"  内容: {first_page_first_item.get('content', 'N/A')}")
    print()
    print()
    
    # 对比总结
    print("=" * 80)
    print("📊 三个文件的对比总结")
    print("=" * 80)
    print()
    print("┌─────────────────────┬──────────────┬──────────────────┬────────────────────┐")
    print("│ 特性                │ layout.json  │ content_list.json│ model.json         │")
    print("├─────────────────────┼──────────────┼──────────────────┼────────────────────┤")
    print("│ 坐标系统            │ 绝对像素     │ 归一化 (0-1)     │ 归一化 (0-1)       │")
    print("│ 结构层级            │ 多层嵌套     │ 扁平化           │ 按页面分组         │")
    print("│ 详细程度            │ 最详细       │ 简化             │ 简化               │")
    print("│ 主要用途            │ 布局分析     │ 内容提取         │ ML 训练            │")
    print("│ 推荐用于            │ 精确重建     │ 生成 Markdown    │ 批量处理           │")
    print("└─────────────────────┴──────────────┴──────────────────┴────────────────────┘")
    print()
    
    # 坐标转换示例
    print("💡 坐标转换示例：")
    print("-" * 80)
    page_width, page_height = layout_data['pdf_info'][0]['page_size']
    print(f"原始图片尺寸: {page_width} x {page_height}")
    print()
    
    # 获取同一个元素在不同文件中的坐标
    layout_bbox = first_block['bbox']
    content_bbox = first_item['bbox']
    model_bbox = first_page_first_item['bbox']
    
    print(f"标题元素在不同文件中的 bbox：")
    print(f"  layout.json:       {layout_bbox}")
    print(f"  content_list.json: {content_bbox}")
    print(f"  model.json:        {model_bbox}")
    print()
    print(f"转换关系（以 content_list.json 为例）：")
    print(f"  绝对坐标 = 归一化坐标 × 图片尺寸")
    print(f"  x1 = {content_bbox[0]:.3f} × {page_width} = {content_bbox[0] * page_width:.0f}")
    print(f"  y1 = {content_bbox[1]:.3f} × {page_height} = {content_bbox[1] * page_height:.0f}")
    print(f"  x2 = {content_bbox[2]:.3f} × {page_width} = {content_bbox[2] * page_width:.0f}")
    print(f"  y2 = {content_bbox[3]:.3f} × {page_height} = {content_bbox[3] * page_height:.0f}")
    print()
    
    print("=" * 80)
    print("✓ 分析完成")
    print("=" * 80)

if __name__ == '__main__':
    analyze_json_files()








