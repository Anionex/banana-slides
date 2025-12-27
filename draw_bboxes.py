#!/usr/bin/env python3
"""
在图片上绘制 MinerU 解析出的所有 bbox（边界框）
"""
import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import random

def get_color_for_type(element_type: str) -> tuple:
    """为不同类型的元素返回不同的颜色（RGBA格式，带透明度）"""
    color_map = {
        'title': (255, 0, 0, 80),      # 红色 - 标题
        'text': (0, 255, 0, 80),       # 绿色 - 文本
        'image': (0, 0, 255, 80),      # 蓝色 - 图片
        'image_body': (0, 100, 255, 80), # 深蓝色 - 图片主体
        'image_caption': (255, 165, 0, 80), # 橙色 - 图片说明
        'table': (255, 0, 255, 80),    # 紫色 - 表格
        'table_body': (200, 0, 200, 80), # 深紫色 - 表格主体
        'table_caption': (255, 100, 255, 80), # 浅紫色 - 表格说明
    }
    return color_map.get(element_type, (128, 128, 128, 80))  # 默认灰色

def draw_bbox(draw, bbox, color, label=None, index=None):
    """绘制一个边界框"""
    # bbox 格式: [x1, y1, x2, y2]
    x1, y1, x2, y2 = bbox
    
    # 绘制半透明矩形
    draw.rectangle([x1, y1, x2, y2], outline=color[:3], width=3)
    
    # 添加标签
    if label or index is not None:
        text = f"{index}: {label}" if index is not None else label
        # 使用默认字体
        bbox_text = draw.textbbox((x1, y1 - 20), text)
        # 绘制文字背景
        draw.rectangle(bbox_text, fill=color[:3])
        draw.text((x1, y1 - 20), text, fill=(255, 255, 255))

def main():
    # 路径配置
    image_path = Path("/mnt/d/Desktop/5d51e305-32f7-4b4f-998c-68fa0465c129_1766680105967.png")
    layout_json_path = Path("/mnt/d/Desktop/banana-slides/uploads/mineru_files/0739a078/layout.json")
    output_dir = Path("/mnt/d/Desktop/banana-slides/output")
    output_dir.mkdir(exist_ok=True)
    
    # 读取原始图片
    print(f"读取图片: {image_path}")
    img = Image.open(image_path)
    img_with_bbox = img.convert('RGBA')
    
    # 创建一个透明层用于绘制半透明矩形
    overlay = Image.new('RGBA', img_with_bbox.size, (255, 255, 255, 0))
    draw_overlay = ImageDraw.Draw(overlay)
    
    # 读取 layout.json
    print(f"读取布局文件: {layout_json_path}")
    with open(layout_json_path, 'r', encoding='utf-8') as f:
        layout_data = json.load(f)
    
    # 统计信息
    stats = {}
    total_boxes = 0
    
    # 遍历所有页面（这里只有一页）
    for page in layout_data['pdf_info']:
        print(f"\n处理页面，尺寸: {page['page_size']}")
        
        # 遍历所有段落块
        for para_block in page['para_blocks']:
            block_type = para_block.get('type', 'unknown')
            block_bbox = para_block.get('bbox')
            
            # 统计
            stats[block_type] = stats.get(block_type, 0) + 1
            total_boxes += 1
            
            if block_bbox:
                color = get_color_for_type(block_type)
                index = para_block.get('index', '?')
                
                # 绘制主块
                draw_overlay.rectangle(block_bbox, fill=color, outline=color[:3])
                print(f"  [{index}] {block_type}: {block_bbox}")
                
                # 如果有子块，也绘制出来
                if 'blocks' in para_block:
                    for sub_block in para_block['blocks']:
                        sub_type = sub_block.get('type', 'unknown')
                        sub_bbox = sub_block.get('bbox')
                        if sub_bbox:
                            sub_color = get_color_for_type(sub_type)
                            draw_overlay.rectangle(sub_bbox, fill=sub_color, outline=sub_color[:3])
                            total_boxes += 1
                
                # 如果有行，也绘制出来（使用更淡的颜色）
                if 'lines' in para_block:
                    for line in para_block['lines']:
                        line_bbox = line.get('bbox')
                        if line_bbox:
                            # 使用更淡的颜色
                            line_color = color[:3] + (30,)
                            draw_overlay.rectangle(line_bbox, fill=line_color, outline=color[:3])
                            total_boxes += 1
    
    # 合并图层
    print("\n合并图层...")
    img_with_bbox = Image.alpha_composite(img_with_bbox, overlay)
    
    # 转换回 RGB 保存
    img_with_bbox = img_with_bbox.convert('RGB')
    
    # 在图片上添加图例
    draw_final = ImageDraw.Draw(img_with_bbox)
    legend_y = 10
    legend_x = img.width - 300
    
    print("\n添加图例...")
    draw_final.rectangle([legend_x - 10, legend_y - 10, img.width - 10, legend_y + len(stats) * 30 + 10], 
                         fill=(255, 255, 255), outline=(0, 0, 0), width=2)
    
    for element_type, count in sorted(stats.items()):
        color = get_color_for_type(element_type)
        # 绘制颜色块
        draw_final.rectangle([legend_x, legend_y, legend_x + 20, legend_y + 20], 
                            fill=color[:3], outline=(0, 0, 0))
        # 绘制文字
        draw_final.text((legend_x + 25, legend_y), f"{element_type}: {count}", fill=(0, 0, 0))
        legend_y += 25
    
    # 保存结果
    output_path = output_dir / "annotated_with_bboxes.png"
    img_with_bbox.save(output_path, quality=95)
    
    print(f"\n{'='*80}")
    print(f"✓ 完成！")
    print(f"\n统计信息:")
    print(f"  总共标注了 {total_boxes} 个边界框")
    for element_type, count in sorted(stats.items()):
        color = get_color_for_type(element_type)
        print(f"  - {element_type}: {count} 个 (颜色: RGB{color[:3]})")
    print(f"\n结果已保存到: {output_path}")
    print(f"{'='*80}")

if __name__ == '__main__':
    main()








