"""
百度图像修复 Provider
基于百度AI的图像修复能力，在指定矩形区域去除遮挡物并用背景内容填充

API文档: https://ai.baidu.com/ai-doc/IMAGEPROCESS/Mk4i6o3w3
"""
import logging
import base64
import requests
import json
from typing import Dict, List, Any, Optional, Tuple
from PIL import Image
import io
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

logger = logging.getLogger(__name__)


class BaiduInpaintingProvider:
    """
    百度图像修复 Provider
    
    在图片中指定位置框定一个或多个规则矩形，去掉不需要的遮挡物，并用背景内容填充。
    
    特点：
    - 支持多个矩形区域同时修复
    - 使用背景内容智能填充
    - 快速响应，适合批量处理
    """
    
    def __init__(self, api_key: str, api_secret: Optional[str] = None):
        """
        初始化百度图像修复 Provider
        
        Args:
            api_key: 百度API Key（BCEv3格式：bce-v3/ALTAK-...）或Access Token
            api_secret: 可选，如果提供则用于BCEv3签名
        """
        self.api_key = api_key
        self.api_secret = api_secret
        self.api_url = "https://aip.baidubce.com/rest/2.0/image-process/v1/inpainting"
        
        if api_key.startswith('bce-v3/'):
            logger.info("✅ 初始化百度图像修复 Provider (使用BCEv3 API Key)")
        else:
            logger.info("✅ 初始化百度图像修复 Provider (使用Access Token)")
    
    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=0.5, min=1, max=5),
        retry=retry_if_exception_type((requests.exceptions.RequestException, Exception)),
        reraise=True
    )
    def inpaint(
        self,
        image: Image.Image,
        rectangles: List[Dict[str, int]]
    ) -> Optional[Image.Image]:
        """
        修复图片中指定的矩形区域
        
        Args:
            image: PIL Image对象
            rectangles: 矩形区域列表，每个矩形包含:
                - left: 左上角x坐标
                - top: 左上角y坐标
                - width: 宽度
                - height: 高度
        
        Returns:
            修复后的PIL Image对象，失败返回None
        """
        if not rectangles:
            logger.warning("没有提供矩形区域，返回原图")
            return image.copy()
        
        logger.info(f"🔧 开始百度图像修复，共 {len(rectangles)} 个区域")
        
        try:
            # 转换图片为RGB模式
            if image.mode != 'RGB':
                image = image.convert('RGB')
            
            original_width, original_height = image.size
            logger.info(f"📏 图片尺寸: {original_width}x{original_height}")
            
            # 检查并调整图片大小（最长边不超过5000px）
            max_size = 5000
            scale = 1.0
            if original_width > max_size or original_height > max_size:
                scale = min(max_size / original_width, max_size / original_height)
                new_size = (int(original_width * scale), int(original_height * scale))
                image = image.resize(new_size, Image.Resampling.LANCZOS)
                logger.info(f"✂️ 压缩图片: {image.size}")
                
                # 同时缩放矩形区域
                rectangles = [
                    {
                        'left': int(r['left'] * scale),
                        'top': int(r['top'] * scale),
                        'width': int(r['width'] * scale),
                        'height': int(r['height'] * scale)
                    }
                    for r in rectangles
                ]
            
            # 过滤掉无效的矩形（宽或高为0）
            valid_rectangles = [
                r for r in rectangles 
                if r['width'] > 0 and r['height'] > 0
            ]
            
            if not valid_rectangles:
                logger.warning("过滤后没有有效的矩形区域，返回原图")
                return image.copy()
            
            # 转为base64
            buffer = io.BytesIO()
            image.save(buffer, format='JPEG', quality=95)
            image_bytes = buffer.getvalue()
            image_base64 = base64.b64encode(image_bytes).decode('utf-8')
            
            logger.info(f"📦 图片编码完成: {len(image_base64)} bytes, {len(valid_rectangles)} 个矩形区域")
            
            # 构建请求头
            headers = {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            }
            
            # 选择认证方式
            if self.api_key.startswith('bce-v3/'):
                headers['Authorization'] = f'Bearer {self.api_key}'
                url = self.api_url
                logger.info("🔐 使用BCEv3签名认证")
            else:
                url = f"{self.api_url}?access_token={self.api_key}"
                logger.info("🔐 使用Access Token认证")
            
            # 构建请求体
            request_body = {
                'image': image_base64,
                'rectangle': valid_rectangles
            }
            
            logger.info("🌐 发送请求到百度图像修复API...")
            response = requests.post(
                url, 
                headers=headers, 
                json=request_body, 
                timeout=60
            )
            response.raise_for_status()
            
            result = response.json()
            
            # 检查错误 - 抛出异常以触发 @retry 装饰器
            if 'error_code' in result:
                error_msg = result.get('error_msg', 'Unknown error')
                error_code = result.get('error_code')
                logger.error(f"❌ 百度API错误: [{error_code}] {error_msg}")
                raise Exception(f"Baidu API error [{error_code}]: {error_msg}")
            
            # 解析结果
            result_image_base64 = result.get('image')
            if not result_image_base64:
                logger.error("❌ 百度API返回结果中没有图片")
                return None
            
            # 解码返回的图片
            result_image_bytes = base64.b64decode(result_image_base64)
            result_image = Image.open(io.BytesIO(result_image_bytes))
            
            # 如果之前缩放过，恢复到原始尺寸
            if scale < 1.0:
                result_image = result_image.resize(
                    (original_width, original_height), 
                    Image.Resampling.LANCZOS
                )
                logger.info(f"📐 恢复图片尺寸: {result_image.size}")
            
            logger.info(f"✅ 百度图像修复完成!")
            return result_image
            
        except Exception as e:
            logger.error(f"❌ 百度图像修复失败: {str(e)}")
            raise
    
    def inpaint_bboxes(
        self,
        image: Image.Image,
        bboxes: List[Tuple[float, float, float, float]],
        expand_pixels: int = 2
    ) -> Optional[Image.Image]:
        """
        使用bbox格式修复图片
        
        Args:
            image: PIL Image对象
            bboxes: bbox列表，每个bbox格式为 (x0, y0, x1, y1)
            expand_pixels: 扩展像素数，默认2
        
        Returns:
            修复后的PIL Image对象
        """
        # 将bbox转换为rectangle格式
        rectangles = []
        for bbox in bboxes:
            x0, y0, x1, y1 = bbox
            # 扩展区域
            x0 = max(1, x0 - expand_pixels)
            y0 = max(1, y0 - expand_pixels)
            x1 = min(image.width - 1, x1 + expand_pixels)
            y1 = min(image.height - 1, y1 + expand_pixels)
            
            rectangles.append({
                'left': int(x0),
                'top': int(y0),
                'width': int(x1 - x0),
                'height': int(y1 - y0)
            })
        
        return self.inpaint(image, rectangles)


def create_baidu_inpainting_provider(
    api_key: Optional[str] = None,
    api_secret: Optional[str] = None
) -> Optional[BaiduInpaintingProvider]:
    """
    创建百度图像修复 Provider 实例
    
    Args:
        api_key: 百度API Key，如果不提供则从 config.py 读取
        api_secret: 百度API Secret（可选），如果不提供则从 config.py 读取
        
    Returns:
        BaiduInpaintingProvider实例，如果api_key不可用则返回None
    """
    from config import Config
    
    if not api_key:
        api_key = Config.BAIDU_OCR_API_KEY
    
    if not api_secret:
        api_secret = Config.BAIDU_OCR_API_SECRET
    
    if not api_key:
        logger.warning("⚠️ 未配置百度API Key (BAIDU_OCR_API_KEY), 跳过百度图像修复")
        return None
    
    return BaiduInpaintingProvider(api_key, api_secret)

