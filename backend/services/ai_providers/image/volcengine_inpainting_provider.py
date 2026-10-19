"""
火山引擎 Inpainting 消除服务提供者
直接HTTP调用，完全绕过SDK限制
"""
import logging
from services.export_control import check_export, retry_export_request, export_sleep
import base64
import json
import requests
from datetime import datetime
from io import BytesIO
from typing import Optional
from PIL import Image
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception

logger = logging.getLogger(__name__)


class VolcengineInpaintingProvider:
    """火山引擎 Inpainting 消除服务（直接HTTP调用）"""
    
    API_URL = "https://visual.volcengineapi.com"
    SERVICE = "cv"
    REGION = "cn-north-1"
    
    def __init__(self, access_key: str, secret_key: str, timeout: int = 60):
        """
        初始化火山引擎 Inpainting 提供者
        
        Args:
            access_key: 火山引擎 Access Key  
            secret_key: 火山引擎 Secret Key
            timeout: API 请求超时时间（秒）
        """
        self.access_key = access_key
        self.secret_key = secret_key
        self.timeout = timeout
        logger.info("火山引擎 Inpainting Provider 初始化（直接HTTP模式）")
        
    def _encode_image_to_base64(self, image: Image.Image, is_mask: bool = False) -> str:
        """
        将 PIL Image 编码为 base64 字符串
        
        Args:
            image: PIL Image对象
            is_mask: 是否是mask图（mask需要特殊处理）
        """
        buffered = BytesIO()
        
        if is_mask:
            # Mask要求：单通道灰度图，或RGB值相等的三通道图
            # 转换为灰度图以确保正确
            if image.mode != 'L':
                image = image.convert('L')
            # 保存为PNG（文档要求8bit PNG，不嵌入ICC Profile）
            image.save(buffered, format="PNG", optimize=True)
        else:
            # 原图：转换为 RGB
            if image.mode in ('RGBA', 'LA', 'P'):
                if image.mode == 'RGBA':
                    background = Image.new('RGB', image.size, (255, 255, 255))
                    background.paste(image, mask=image.split()[3])
                    image = background
                else:
                    image = image.convert('RGB')
            # 保存为 JPEG 减小大小
            image.save(buffered, format="JPEG", quality=85)
        
        return base64.b64encode(buffered.getvalue()).decode('utf-8')
    
    @retry(
        stop=stop_after_attempt(3),  # 最多重试3次
        wait=wait_exponential(multiplier=1, min=2, max=10),  # 指数避让: 2s, 4s, 8s
        retry=retry_if_exception(retry_export_request),
        before=lambda _: check_export(), sleep=export_sleep,
        reraise=True
    )
    def inpaint_image(
        self,
        original_image: Image.Image,
        mask_image: Image.Image,
        inpaint_mode: str = "remove",
        full_page_image: Optional[Image.Image] = None,
        crop_box: Optional[tuple] = None
    ) -> Optional[Image.Image]:
        """
        使用掩码消除图像中的指定区域（带指数避让重试）
        
        Args:
            original_image: 原始图像
            mask_image: 掩码图像（白色=消除，黑色=保留）
            inpaint_mode: 修复模式
            
        Returns:
            处理后的图像，失败返回 None
        """
        try:
            logger.info("🚀 开始调用火山引擎 inpainting（直接HTTP）")
            
            # 1. 压缩图片（火山引擎限制5MB）
            max_dimension = 2048
            if max(original_image.size) > max_dimension:
                ratio = max_dimension / max(original_image.size)
                new_size = tuple(int(dim * ratio) for dim in original_image.size)
                original_image = original_image.resize(new_size, Image.LANCZOS)
                mask_image = mask_image.resize(new_size, Image.LANCZOS)
                logger.info(f"✂️ 压缩图片: {original_image.size}")
            
            # 2. 编码为base64（mask要特殊处理为灰度图）
            logger.info("📦 编码图片为base64...")
            original_base64 = self._encode_image_to_base64(original_image, is_mask=False)
            mask_base64 = self._encode_image_to_base64(mask_image, is_mask=True)
            logger.info(f"✅ 编码完成: 原图={len(original_base64)} bytes, mask={len(mask_base64)} bytes")
            
            # 3. 构建请求参数（按官方文档）
            # 参考：https://www.volcengine.com/docs/86081/1804489
            # mask要求：黑色(0)=保留，白色(255)=消除
            request_body = {
                "req_key": "i2i_inpainting",
                "binary_data_base64": [original_base64, mask_base64],
                "dilate_size": 10,  # mask膨胀半径，帮助完整消除
                "quality": "H",  # 高质量模式（最高质量）
                "steps": 50,  # 采样步数，越大效果越好但耗时更长（默认30）
                "strength": 0.85  # 控制强度，越大越接近文本控制（默认0.8）
            }
            
            # 4. 构建请求URL
            url = f"{self.API_URL}/?Action=CVProcess&Version=2022-08-31"
            
            # 5. 构建请求头（简化版，使用AK/SK直接认证）
            headers = {
                "Content-Type": "application/json",
                "X-Date": datetime.utcnow().strftime('%Y%m%dT%H%M%SZ')
            }
            
            logger.info(f"🌐 发送请求到: {url}")
            logger.debug(f"请求体大小: {len(json.dumps(request_body))} bytes")
            
            # 6. 使用SDK（它会处理签名）
            from volcengine.visual.VisualService import VisualService
            service = VisualService()
            service.set_ak(self.access_key)
            service.set_sk(self.secret_key)
            
            # 使用SDK的json_handler方法（这个方法会处理签名）
            logger.info("使用SDK发送请求（带正确签名）")
            
            try:
                # 使用SDK的通用API调用方法
                response = service.json(
                    "CVProcess",
                    {},  # query params
                    json.dumps(request_body)  # body
                )
                
                # 解析响应
                if isinstance(response, str):
                    response = json.loads(response)
                    
            except Exception as e:
                error_str = str(e)
                logger.error(f"SDK调用错误: {error_str}")
                
                # 尝试从错误信息中提取JSON响应
                if error_str.startswith("b'") and error_str.endswith("'"):
                    try:
                        response_text = error_str[2:-1]  # 去掉 b' 和 '
                        response = json.loads(response_text)
                    except Exception:
                        logger.error("无法解析错误响应")
                        return None
                else:
                    return None
            
            # 8. 解析响应
            logger.debug(f"API响应: {json.dumps(response, ensure_ascii=False)[:300]}")
            
            if response.get("code") == 10000 or response.get("status") == 10000:
                data = response.get("data", {})
                
                # 尝试多种响应格式
                result_base64 = None
                if "binary_data_base64" in data and data["binary_data_base64"]:
                    result_base64 = data["binary_data_base64"][0]
                elif "image_base64" in data:
                    result_base64 = data["image_base64"]
                elif "result_image" in data:
                    result_base64 = data["result_image"]
                
                if result_base64:
                    image_data = base64.b64decode(result_base64)
                    inpainted_image = Image.open(BytesIO(image_data))
                    logger.info(f"✅ Inpainting成功！结果: {inpainted_image.size}, {inpainted_image.mode}")
                    
                    # 合成：只取inpainting结果的mask区域，其他区域用原图覆盖
                    # 确保尺寸一致
                    if inpainted_image.size != original_image.size:
                        logger.warning(f"尺寸不一致，调整inpainting结果: {inpainted_image.size} -> {original_image.size}")
                        inpainted_image = inpainted_image.resize(original_image.size, Image.LANCZOS)
                    
                    # 确保mask尺寸一致
                    if mask_image.size != original_image.size:
                        mask_image = mask_image.resize(original_image.size, Image.LANCZOS)
                    
                    # 确保inpainted_image是RGB模式
                    if inpainted_image.mode != 'RGB':
                        inpainted_image = inpainted_image.convert('RGB')
                    if original_image.mode != 'RGB':
                        original_image = original_image.convert('RGB')
                    
                    # 确保mask是L模式（灰度图）
                    mask_for_composite = mask_image.convert('L')
                    
                    # 使用PIL的composite方法合成图像
                    # mask中白色(255)区域使用inpainting结果，黑色(0)区域使用原图
                    # 注意：Image.composite使用mask，其中白色表示使用image1，黑色表示使用image2
                    # 所以这里image1是inpainting结果，image2是原图
                    result_image = Image.composite(inpainted_image, original_image, mask_for_composite)
                    
                    logger.info(f"✅ 图像合成完成！最终尺寸: {result_image.size}, {result_image.mode}")
                    return result_image
                else:
                    logger.error(f"❌ 响应中无图像数据，keys: {list(data.keys())}")
                    return None
            else:
                code = response.get("code") or response.get("status")
                message = response.get("message", "未知错误")
                logger.error(f"❌ API错误: code={code}, message={message}")
                return None
                
        except Exception as e:
            logger.error(f"❌ Inpainting失败: {str(e)}", exc_info=True)
            return None
    
