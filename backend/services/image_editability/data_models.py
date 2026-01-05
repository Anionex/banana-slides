"""
数据模型 - 图片可编辑化服务的核心数据结构
"""
from typing import Dict, Any, List, Optional, Tuple
from dataclasses import dataclass, field


@dataclass
class BBox:
    """边界框坐标"""
    x0: float
    y0: float
    x1: float
    y1: float
    
    @property
    def width(self) -> float:
        return self.x1 - self.x0
    
    @property
    def height(self) -> float:
        return self.y1 - self.y0
    
    @property
    def area(self) -> float:
        return self.width * self.height
    
    def to_tuple(self) -> Tuple[float, float, float, float]:
        """转换为元组格式 (x0, y0, x1, y1)"""
        return (self.x0, self.y0, self.x1, self.y1)
    
    def to_dict(self) -> Dict[str, float]:
        """转换为字典格式"""
        return {
            'x0': self.x0,
            'y0': self.y0,
            'x1': self.x1,
            'y1': self.y1
        }
    
    def scale(self, scale_x: float, scale_y: float) -> 'BBox':
        """缩放bbox"""
        return BBox(
            x0=self.x0 * scale_x,
            y0=self.y0 * scale_y,
            x1=self.x1 * scale_x,
            y1=self.y1 * scale_y
        )
    
    def translate(self, offset_x: float, offset_y: float) -> 'BBox':
        """平移bbox"""
        return BBox(
            x0=self.x0 + offset_x,
            y0=self.y0 + offset_y,
            x1=self.x1 + offset_x,
            y1=self.y1 + offset_y
        )


@dataclass
class EditableElement:
    """可编辑元素"""
    element_id: str  # 唯一标识
    element_type: str  # text, image, table, figure, equation等
    bbox: BBox  # 在父容器（EditableImage）坐标系中的位置
    bbox_global: BBox  # 在根图片（最顶层EditableImage）坐标系中的位置（预计算存储，避免前端/后续使用时重新遍历计算）
    content: Optional[str] = None  # 文字内容、HTML表格等
    image_path: Optional[str] = None  # 图片路径（MinerU提取的）
    
    # 递归子元素（如果是图片或图表，可能有子元素）
    children: List['EditableElement'] = field(default_factory=list)
    
    # 子图的inpaint背景（如果此元素是递归分析的图片/图表）
    inpainted_background_path: Optional[str] = None
    
    # 元数据
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典（可序列化）"""
        result = {
            'element_id': self.element_id,
            'element_type': self.element_type,
            'bbox': self.bbox.to_dict(),
            'bbox_global': self.bbox_global.to_dict(),
            'content': self.content,
            'image_path': self.image_path,
            'inpainted_background_path': self.inpainted_background_path,
            'metadata': self.metadata,
            'children': [child.to_dict() for child in self.children]
        }
        return result


@dataclass
class EditableImage:
    """可编辑化的图片结构"""
    image_id: str  # 唯一标识
    image_path: str  # 原始图片路径
    width: int  # 图片宽度
    height: int  # 图片高度
    
    # 所有提取的元素
    elements: List[EditableElement] = field(default_factory=list)
    
    # Inpaint后的背景图（消除所有元素）
    clean_background: Optional[str] = None
    
    # 递归层级
    depth: int = 0
    
    # 父图片ID（如果是子图）
    parent_id: Optional[str] = None
    
    # 元数据
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典（可序列化）"""
        return {
            'image_id': self.image_id,
            'image_path': self.image_path,
            'width': self.width,
            'height': self.height,
            'elements': [elem.to_dict() for elem in self.elements],
            'clean_background': self.clean_background,
            'depth': self.depth,
            'parent_id': self.parent_id,
            'metadata': self.metadata
        }

