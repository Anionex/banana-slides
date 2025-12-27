"""
百度表格识别OCR Provider
提供基于百度AI的表格识别能力,支持精确到单元格级别的识别

API文档: https://ai.baidu.com/ai-doc/OCR/1k3h7y3db
"""
import logging
import base64
import requests
import urllib.parse
from typing import Dict, List, Any, Optional
from PIL import Image
import io
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

logger = logging.getLogger(__name__)


class BaiduTableOCRProvider:
    """百度表格OCR Provider - 支持BCEv3签名认证"""
    
    def __init__(self, api_key: str, api_secret: Optional[str] = None):
        """
        初始化百度表格OCR Provider
        
        Args:
            api_key: 百度API Key（BCEv3格式：bce-v3/ALTAK-...）或Access Token
            api_secret: 可选，如果提供则用于BCEv3签名
        """
        self.api_key = api_key
        self.api_secret = api_secret
        self.api_url = "https://aip.baidubce.com/rest/2.0/ocr/v1/table"
        
        if api_key.startswith('bce-v3/'):
            logger.info("✅ 初始化百度表格OCR Provider (使用BCEv3 API Key)")
        else:
            logger.info("✅ 初始化百度表格OCR Provider (使用Access Token)")
    
    @retry(
        stop=stop_after_attempt(3),  # 最多重试3次
        wait=wait_exponential(multiplier=0.5, min=1, max=5),  # 指数避让: 1s, 2s, 4s
        retry=retry_if_exception_type((requests.exceptions.RequestException, Exception)),
        reraise=True
    )
    def recognize_table(
        self,
        image_path: str,
        cell_contents: bool = True,  # 默认开启，获取单元格文字位置
        return_excel: bool = False
    ) -> Dict[str, Any]:
        """
        识别表格图片（带指数避让重试）
        
        Args:
            image_path: 图片路径
            cell_contents: 是否识别单元格内容位置信息，默认True
            return_excel: 是否返回Excel格式，默认False
            
        Returns:
            识别结果字典,包含:
            - log_id: 日志ID
            - table_num: 表格数量
            - tables_result: 表格结果列表
            - cells: 解析后的单元格列表(扁平化)
            - image_size: 原始图片尺
        """
        logger.info(f"🔍 开始识别表格图片: {image_path}")
        
        try:
            # 读取图片并转为base64
            original_width, original_height = 0, 0
            with Image.open(image_path) as img:
                # 获取原始图片尺寸
                original_width, original_height = img.size
                logger.info(f"📏 图片尺寸: {original_width}x{original_height}")
                
                # 转换为RGB模式
                if img.mode != 'RGB':
                    img = img.convert('RGB')
                
                # 压缩图片(如果太大) - 最长边不超过8192px，最短边至少15px
                max_size = 8192
                min_size = 15
                width, height = img.size
                
                if width < min_size or height < min_size:
                    logger.warning(f"⚠️ 图片太小: {width}x{height}, 最短边需要至少{min_size}px")
                
                if width > max_size or height > max_size:
                    ratio = min(max_size / width, max_size / height)
                    new_size = (int(width * ratio), int(height * ratio))
                    img = img.resize(new_size, Image.Resampling.LANCZOS)
                    logger.info(f"✂️ 压缩图片: {img.size}")
                
                # 转为base64
                buffer = io.BytesIO()
                img.save(buffer, format='JPEG', quality=95)
                image_bytes = buffer.getvalue()
                image_base64 = base64.b64encode(image_bytes).decode('utf-8')
                
                # URL encode
                image_encoded = urllib.parse.quote(image_base64)
                logger.info(f"📦 图片编码完成: base64={len(image_base64)} bytes, urlencode={len(image_encoded)} bytes")
            
            # 构建请求头
            headers = {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Accept': 'application/json',
            }
            
            # 选择认证方式
            if self.api_key.startswith('bce-v3/'):
                # 使用BCEv3签名认证 (Authorization头部)
                headers['Authorization'] = f'Bearer {self.api_key}'
                url = self.api_url
                logger.info(f"🔐 使用BCEv3签名认证")
            else:
                # 使用Access Token (URL参数)
                url = f"{self.api_url}?access_token={self.api_key}"
                logger.info(f"🔐 使用Access Token认证")
            
            # 构建表单数据
            data = f"image={image_encoded}&cell_contents={'true' if cell_contents else 'false'}&return_excel={'true' if return_excel else 'false'}"
            
            logger.info(f"🌐 发送请求到百度表格OCR API...")
            response = requests.post(url, headers=headers, data=data, timeout=60)
            response.raise_for_status()
            
            result = response.json()
            
            # 检查错误
            if 'error_code' in result:
                error_msg = result.get('error_msg', 'Unknown error')
                error_code = result.get('error_code')
                logger.error(f"❌ 百度API错误: [{error_code}] {error_msg}")
                raise Exception(f"Baidu API error [{error_code}]: {error_msg}")
            
            # 解析结果
            log_id = result.get('log_id', '')
            table_num = result.get('table_num', 0)
            tables_result = result.get('tables_result', [])
            excel_file = result.get('excel_file', None)
            
            logger.info(f"✅ 表格识别成功! log_id={log_id}, 识别到 {table_num} 个表格")
            
            # 解析单元格信息(扁平化)
            cells = []
            for table_idx, table in enumerate(tables_result):
                table_location = table.get('table_location', [])
                header = table.get('header', [])
                body = table.get('body', [])
                footer = table.get('footer', [])
                
                logger.info(f"  表格 {table_idx + 1}: header={len(header)}, body={len(body)}, footer={len(footer)}")
                
                # 解析表头
                for idx, header_cell in enumerate(header):
                    cell_info = {
                        'table_idx': table_idx,
                        'section': 'header',
                        'section_idx': idx,
                        'text': header_cell.get('words', ''),
                        'bbox': self._location_to_bbox(header_cell.get('location', [])),
                    }
                    cells.append(cell_info)
                
                # 解析表体
                for cell in body:
                    cell_info = {
                        'table_idx': table_idx,
                        'section': 'body',
                        'row_start': cell.get('row_start', 0),
                        'row_end': cell.get('row_end', 0),
                        'col_start': cell.get('col_start', 0),
                        'col_end': cell.get('col_end', 0),
                        'text': cell.get('words', ''),
                        'bbox': self._location_to_bbox(cell.get('cell_location', [])),
                        'contents': cell.get('contents', []),  # 单元格内文字分行信息
                    }
                    cells.append(cell_info)
                
                # 解析表尾
                for idx, footer_cell in enumerate(footer):
                    cell_info = {
                        'table_idx': table_idx,
                        'section': 'footer',
                        'section_idx': idx,
                        'text': footer_cell.get('words', ''),
                        'bbox': self._location_to_bbox(footer_cell.get('location', [])),
                    }
                    cells.append(cell_info)
            
            return {
                'log_id': log_id,
                'table_num': table_num,
                'tables_result': tables_result,
                'cells': cells,
                'image_size': (original_width, original_height),
                'excel_file': excel_file,
            }
            
        except Exception as e:
            logger.error(f"❌ 表格识别失败: {str(e)}")
            raise
    
    def _location_to_bbox(self, location: List[Dict[str, int]]) -> List[int]:
        """
        将四个角点坐标转换为bbox格式 [x0, y0, x1, y1]
        
        Args:
            location: 四个角点 [{x, y}, {x, y}, {x, y}, {x, y}]
            
        Returns:
            bbox [x0, y0, x1, y1]
        """
        if not location or len(location) < 2:
            return [0, 0, 0, 0]
        
        xs = [p['x'] for p in location]
        ys = [p['y'] for p in location]
        
        return [min(xs), min(ys), max(xs), max(ys)]
    
    def get_table_structure(self, cells: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        从单元格列表中提取表格结构
        
        Args:
            cells: 单元格列表
            
        Returns:
            表格结构信息:
            - rows: 行数
            - cols: 列数
            - cells_by_position: {(row, col): cell_info}
        """
        if not cells:
            return {'rows': 0, 'cols': 0, 'cells_by_position': {}}
        
        max_row = max(cell['row_end'] for cell in cells)
        max_col = max(cell['col_end'] for cell in cells)
        
        cells_by_position = {}
        for cell in cells:
            # 使用起始位置作为key
            key = (cell['row_start'], cell['col_start'])
            cells_by_position[key] = cell
        
        return {
            'rows': max_row,
            'cols': max_col,
            'cells_by_position': cells_by_position,
        }


def create_baidu_table_ocr_provider(
    api_key: Optional[str] = None,
    api_secret: Optional[str] = None
) -> Optional[BaiduTableOCRProvider]:
    """
    创建百度表格OCR Provider实例
    
    Args:
        api_key: 百度API Key（BCEv3格式或Access Token），如果不提供则从环境变量读取
        api_secret: 百度API Secret（可选），如果不提供则从环境变量读取
        
    Returns:
        BaiduTableOCRProvider实例，如果api_key不可用则返回None
    """
    import os
    
    if not api_key:
        api_key = os.getenv('BAIDU_OCR_API_KEY')
    
    if not api_secret:
        api_secret = os.getenv('BAIDU_OCR_API_SECRET')
    
    if not api_key:
        logger.warning("⚠️ 未配置百度OCR API Key, 跳过百度表格识别")
        return None
    
    return BaiduTableOCRProvider(api_key, api_secret)

