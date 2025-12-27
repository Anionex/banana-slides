"""
坐标映射工具 - 统一处理 MinerU 到图像/PPTX 的坐标转换
"""
import os
import json
import logging
from typing import List, Dict, Any, Optional, Tuple
from pathlib import Path

logger = logging.getLogger(__name__)


class CoordinateMapper:
    """
    统一的坐标映射器，确保从 MinerU 到目标图像的坐标转换一致性
    """
    
    def __init__(self, mineru_result_dir: str):
        """
        初始化坐标映射器
        
        Args:
            mineru_result_dir: MinerU 解析结果目录
        """
        self.mineru_result_dir = Path(mineru_result_dir)
        self.layout_data = None
        self.content_list = None
        self.page_sizes = {}  # page_idx -> (width, height)
        
        # 加载必要的文件
        self._load_layout_json()
        self._load_content_list()
    
    def _load_layout_json(self):
        """加载 layout.json"""
        layout_file = self.mineru_result_dir / 'layout.json'
        if layout_file.exists():
            try:
                with open(layout_file, 'r', encoding='utf-8') as f:
                    self.layout_data = json.load(f)
                    
                # 提取每页的尺寸
                if 'pdf_info' in self.layout_data:
                    for page_info in self.layout_data['pdf_info']:
                        page_idx = page_info.get('page_idx', 0)
                        page_size = page_info.get('page_size')
                        if page_size and len(page_size) == 2:
                            self.page_sizes[page_idx] = tuple(page_size)
                
                logger.info(f"✓ Loaded layout.json with {len(self.page_sizes)} pages")
            except Exception as e:
                logger.warning(f"Failed to load layout.json: {e}")
        else:
            logger.warning(f"layout.json not found in {self.mineru_result_dir}")
    
    def _load_content_list(self):
        """加载 content_list.json"""
        # 查找 content_list.json（可能带 UUID 前缀）
        content_list_path = None
        
        # 尝试直接文件名
        direct_path = self.mineru_result_dir / 'content_list.json'
        if direct_path.exists():
            content_list_path = direct_path
        else:
            # 查找带 UUID 前缀的文件
            for filename in os.listdir(self.mineru_result_dir):
                if filename.endswith('_content_list.json'):
                    content_list_path = self.mineru_result_dir / filename
                    break
        
        if content_list_path and content_list_path.exists():
            try:
                with open(content_list_path, 'r', encoding='utf-8') as f:
                    self.content_list = json.load(f)
                logger.info(f"✓ Loaded content_list.json with {len(self.content_list)} items")
            except Exception as e:
                logger.warning(f"Failed to load content_list.json: {e}")
        else:
            logger.warning(f"content_list.json not found in {self.mineru_result_dir}")
    
    def get_page_elements_with_layout_coords(self, page_index: int) -> List[Dict[str, Any]]:
        """
        从 layout.json 提取页面元素（使用 layout.json 的坐标系统）
        
        这是推荐的方法，因为 layout.json 的坐标系统与 PDF 原始坐标一致
        
        Args:
            page_index: 页面索引（从0开始）
            
        Returns:
            元素列表，每个元素包含 {'bbox': [x0, y0, x1, y1], 'type': 'text/image/table'}
            bbox 使用 layout.json 的原始坐标系统（PDF 坐标）
        """
        if not self.layout_data or 'pdf_info' not in self.layout_data:
            logger.warning("layout.json not loaded or invalid")
            return []
        
        elements = []
        
        # 查找对应页面
        for page_info in self.layout_data['pdf_info']:
            if page_info.get('page_idx', 0) != page_index:
                continue
            
            # 遍历页面中的所有块
            for block in page_info.get('para_blocks', []):
                bbox = block.get('bbox')
                block_type = block.get('type', 'text')
                
                if not bbox or len(bbox) != 4:
                    continue
                
                # 所有块都添加到元素列表中
                elements.append({
                    'bbox': bbox,
                    'type': block_type
                })
        
        logger.info(f"✓ Extracted {len(elements)} elements from page {page_index} (layout.json coords)")
        return elements
    
    def get_page_elements_with_content_list_coords(self, page_index: int) -> List[Dict[str, Any]]:
        """
        从 content_list.json 提取页面元素（使用 content_list 的坐标系统）
        
        注意：content_list.json 的坐标系统可能与 layout.json 不同！
        如果有 layout.json，推荐使用 get_page_elements_with_layout_coords
        
        Args:
            page_index: 页面索引（从0开始）
            
        Returns:
            元素列表，使用 content_list 的坐标系统
        """
        if not self.content_list:
            logger.warning("content_list.json not loaded")
            return []
        
        elements = []
        
        for item in self.content_list:
            if item.get('page_idx', 0) != page_index:
                continue
            
            bbox = item.get('bbox')
            item_type = item.get('type', 'text')
            
            if bbox and len(bbox) == 4:
                elements.append({
                    'bbox': bbox,
                    'type': item_type
                })
        
        logger.info(f"✓ Extracted {len(elements)} elements from page {page_index} (content_list coords)")
        return elements
    
    def scale_bbox(
        self,
        bbox: List[int],
        source_size: Tuple[int, int],
        target_size: Tuple[int, int]
    ) -> List[int]:
        """
        缩放单个 bbox 坐标
        
        Args:
            bbox: 原始 bbox [x0, y0, x1, y1]
            source_size: 源坐标系统尺寸 (width, height)
            target_size: 目标坐标系统尺寸 (width, height)
            
        Returns:
            缩放后的 bbox [x0, y0, x1, y1]
        """
        if len(bbox) != 4:
            return bbox
        
        scale_x = target_size[0] / source_size[0]
        scale_y = target_size[1] / source_size[1]
        
        x0, y0, x1, y1 = bbox
        return [
            int(x0 * scale_x),
            int(y0 * scale_y),
            int(x1 * scale_x),
            int(y1 * scale_y)
        ]
    
    def get_scaled_page_elements(
        self,
        page_index: int,
        target_image_size: Tuple[int, int],
        use_layout_coords: bool = True
    ) -> List[Dict[str, Any]]:
        """
        获取缩放到目标图像坐标系统的页面元素（统一接口）
        
        这是推荐使用的主要方法，确保坐标映射的一致性
        
        Args:
            page_index: 页面索引（从0开始）
            target_image_size: 目标图片尺寸 (width, height)
            use_layout_coords: 是否使用 layout.json 坐标（推荐为 True）
            
        Returns:
            元素列表，bbox 已缩放到目标图片坐标系
        """
        # 获取源坐标系统的元素
        if use_layout_coords and self.layout_data:
            elements = self.get_page_elements_with_layout_coords(page_index)
            # 获取源页面尺寸
            source_size = self.page_sizes.get(page_index)
            if not source_size:
                logger.warning(f"Page size not found for page {page_index}")
                return []
        else:
            elements = self.get_page_elements_with_content_list_coords(page_index)
            # content_list 没有明确的页面尺寸信息，需要推断或使用默认值
            # 这是 content_list 方法的缺陷
            logger.warning("Using content_list coords without explicit page size may be inaccurate")
            source_size = self.page_sizes.get(page_index, (1920, 1080))  # 默认值
        
        # 缩放所有元素的 bbox
        scaled_elements = []
        for elem in elements:
            scaled_bbox = self.scale_bbox(elem['bbox'], source_size, target_image_size)
            scaled_elements.append({
                'bbox': scaled_bbox,
                'type': elem['type']
            })
        
        scale_x = target_image_size[0] / source_size[0]
        scale_y = target_image_size[1] / source_size[1]
        logger.info(
            f"📐 Scaled {len(scaled_elements)} elements: "
            f"{source_size} -> {target_image_size} "
            f"(scale: {scale_x:.3f}x{scale_y:.3f})"
        )
        
        return scaled_elements
    
    def get_page_size(self, page_index: int) -> Optional[Tuple[int, int]]:
        """
        获取页面的原始尺寸（PDF 坐标系统）
        
        Args:
            page_index: 页面索引
            
        Returns:
            (width, height) 或 None
        """
        return self.page_sizes.get(page_index)


def extract_elements_for_mask(
    mineru_result_dir: str,
    page_index: int,
    target_image_size: Tuple[int, int]
) -> List[Dict[str, Any]]:
    """
    便捷函数：提取用于生成 mask 的页面元素（统一入口）
    
    Args:
        mineru_result_dir: MinerU 解析结果目录
        page_index: 页面索引（从0开始）
        target_image_size: 目标图片尺寸 (width, height)
        
    Returns:
        元素列表，bbox 已缩放到目标图片坐标系
    """
    mapper = CoordinateMapper(mineru_result_dir)
    return mapper.get_scaled_page_elements(page_index, target_image_size, use_layout_coords=True)


def extract_elements_for_pptx(
    mineru_result_dir: str,
    page_index: int,
    slide_size: Tuple[int, int]
) -> List[Dict[str, Any]]:
    """
    便捷函数：提取用于 PPTX 的页面元素（统一入口）
    
    Args:
        mineru_result_dir: MinerU 解析结果目录
        page_index: 页面索引（从0开始）
        slide_size: 幻灯片尺寸 (width, height) 像素
        
    Returns:
        元素列表，bbox 已缩放到幻灯片坐标系
    """
    mapper = CoordinateMapper(mineru_result_dir)
    return mapper.get_scaled_page_elements(page_index, slide_size, use_layout_coords=True)





