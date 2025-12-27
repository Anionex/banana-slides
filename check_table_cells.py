#!/usr/bin/env python3
"""
检查 layout.json 中表格的单元格 bbox 信息
"""
import json
from pathlib import Path

def check_table_structure(layout_file: Path, mode_name: str):
    """检查表格结构"""
    print(f"\n{'='*80}")
    print(f"检查 {mode_name} 模式的表格结构")
    print(f"{'='*80}\n")
    
    with open(layout_file, 'r', encoding='utf-8') as f:
        layout_data = json.load(f)
    
    print(f"后端: {layout_data.get('_backend')}")
    print(f"版本: {layout_data.get('_version_name')}")
    print()
    
    # 查找表格
    para_blocks = layout_data['pdf_info'][0]['para_blocks']
    
    for block in para_blocks:
        if block.get('type') == 'table':
            print(f"找到表格 (index: {block.get('index')})")
            print(f"表格整体 bbox: {block.get('bbox')}")
            print()
            
            # 检查子块
            if 'blocks' in block:
                print(f"表格包含 {len(block['blocks'])} 个子块:")
                for i, sub_block in enumerate(block['blocks']):
                    sub_type = sub_block.get('type')
                    print(f"\n  子块 {i+1}: {sub_type}")
                    print(f"    bbox: {sub_block.get('bbox')}")
                    
                    # 检查 lines
                    if 'lines' in sub_block:
                        print(f"    lines: {len(sub_block['lines'])} 个")
                        for line in sub_block['lines']:
                            print(f"      - line bbox: {line.get('bbox')}")
                            if 'spans' in line:
                                for span in line['spans']:
                                    span_type = span.get('type')
                                    print(f"        * span type: {span_type}, bbox: {span.get('bbox')}")
                                    if span_type == 'table':
                                        print(f"          HTML: {span.get('html', 'N/A')[:100]}...")
                    
                    # 检查 virtual_lines (表格行)
                    if 'virtual_lines' in sub_block:
                        print(f"    virtual_lines (表格行): {len(sub_block['virtual_lines'])} 个")
                        for vline in sub_block['virtual_lines']:
                            print(f"      - 行 bbox: {vline.get('bbox')}")
                            print(f"        spans: {len(vline.get('spans', []))} 个")
                    
                    # 检查 cells (单元格)
                    if 'cells' in sub_block:
                        print(f"    ✓ cells (单元格): {len(sub_block['cells'])} 个")
                        for j, cell in enumerate(sub_block['cells'][:5]):  # 只显示前5个
                            print(f"      - 单元格 {j+1}:")
                            print(f"        bbox: {cell.get('bbox')}")
                            print(f"        content: {cell.get('content', 'N/A')}")
                            print(f"        row: {cell.get('row', 'N/A')}, col: {cell.get('col', 'N/A')}")
                        if len(sub_block['cells']) > 5:
                            print(f"      ... 还有 {len(sub_block['cells']) - 5} 个单元格")
                    else:
                        print(f"    ✗ 没有 cells 字段")
    
    # 检查其他可能包含表格信息的地方
    print(f"\n{'-'*80}")
    print("检查其他字段:")
    
    if 'layout_dets' in layout_data['pdf_info'][0]:
        print(f"✓ 找到 layout_dets 字段")
    else:
        print(f"✗ 没有 layout_dets 字段")
    
    # 检查是否有 table_structure 信息
    for block in para_blocks:
        if block.get('type') == 'table' and 'table_structure' in block:
            print(f"✓ 找到 table_structure 字段")
            print(f"  内容: {list(block['table_structure'].keys())}")

if __name__ == '__main__':
    # 检查两种模式
    vlm_layout = Path("/mnt/d/Desktop/banana-slides/uploads/mineru_files/0739a078/layout.json")
    pipeline_layout = Path("/mnt/d/Desktop/banana-slides/uploads/mineru_files/4bab558b/layout.json")
    
    if vlm_layout.exists():
        check_table_structure(vlm_layout, "VLM")
    
    if pipeline_layout.exists():
        check_table_structure(pipeline_layout, "Pipeline")
    
    print(f"\n{'='*80}")
    print("结论:")
    print("="*80)
    print("""
如果 layout.json 中有 cells 字段，说明有单元格级别的 bbox。
如果只有 virtual_lines，说明只有行级别的 bbox。
如果只有 table 整体 bbox，说明只有表格整体的 bbox。
    """)








