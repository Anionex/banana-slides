"""
百度通用文字识别（高精度含位置版）OCR Provider
提供多场景、多语种、高精度的整图文字检测和识别服务，支持返回文字位置信息

API文档: https://ai.baidu.com/ai-doc/OCR/1k3h7y3db
"""
import logging
import base64
import requests
import urllib.parse
from typing import Dict, List, Any, Optional, Literal
from PIL import Image
import io
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

logger = logging.getLogger(__name__)


# 支持的语言类型
LanguageType = Literal[
    'auto_detect',  # 自动检测语言
    'CHN_ENG',      # 中英文混合
    'ENG',          # 英文
    'JAP',          # 日语
    'KOR',          # 韩语
    'FRE',          # 法语
    'SPA',          # 西班牙语
    'POR',          # 葡萄牙语
    'GER',          # 德语
    'ITA',          # 意大利语
    'RUS',          # 俄语
    'DAN',          # 丹麦语
    'DUT',          # 荷兰语
    'MAL',          # 马来语
    'SWE',          # 瑞典语
    'IND',          # 印尼语
    'POL',          # 波兰语
    'ROM',          # 罗马尼亚语
    'TUR',          # 土耳其语
    'GRE',          # 希腊语
    'HUN',          # 匈牙利语
    'THA',          # 泰语
    'VIE',          # 越南语
    'ARA',          # 阿拉伯语
    'HIN',          # 印地语
]


class BaiduAccurateOCRProvider:
    """
    百度高精度OCR Provider - 通用文字识别（高精度含位置版）
    
    特点:
    - 高精度文字识别
    - 支持25种语言
    - 返回文字位置信息（支持行级别和字符级别）
    - 支持图片朝向检测
    - 支持段落输出
    """
    
    def __init__(self, api_key: str, api_secret: Optional[str] = None):
        """
        初始化百度高精度OCR Provider
        
        Args:
            api_key: 百度API Key（BCEv3格式：bce-v3/ALTAK-...）或Access Token
            api_secret: 可选，如果提供则用于BCEv3签名
        """
        self.api_key = api_key
        self.api_secret = api_secret
        self.api_url = "https://aip.baidubce.com/rest/2.0/ocr/v1/accurate"
        
        if api_key.startswith('bce-v3/'):
            logger.info("✅ 初始化百度高精度OCR Provider (使用BCEv3 API Key)")
        else:
            logger.info("✅ 初始化百度高精度OCR Provider (使用Access Token)")
    
    @retry(
        stop=stop_after_attempt(3),  # 最多重试3次
        wait=wait_exponential(multiplier=0.5, min=1, max=5),  # 指数避让: 1s, 2s, 4s
        retry=retry_if_exception_type((requests.exceptions.RequestException, Exception)),
        reraise=True
    )
    def recognize(
        self,
        image_path: str,
        language_type: LanguageType = 'CHN_ENG',
        recognize_granularity: Literal['big', 'small'] = 'big',
        detect_direction: bool = False,
        vertexes_location: bool = False,
        paragraph: bool = False,
        probability: bool = False,
        char_probability: bool = False,
        multidirectional_recognize: bool = False,
        eng_granularity: Optional[Literal['word', 'letter']] = None,
    ) -> Dict[str, Any]:
        """
        识别图片中的文字（高精度含位置版）
        
        Args:
            image_path: 图片路径
            language_type: 识别语言类型，默认中英文混合
            recognize_granularity: 是否定位单字符位置，big=不定位，small=定位
            detect_direction: 是否检测图像朝向
            vertexes_location: 是否返回文字外接多边形顶点位置
            paragraph: 是否输出段落信息
            probability: 是否返回每一行的置信度
            char_probability: 是否返回单字符置信度（需要recognize_granularity=small）
            multidirectional_recognize: 是否开启行级别的多方向文字识别
            eng_granularity: 英文单字符结果维度（word/letter），当recognize_granularity=small时生效
            
        Returns:
            识别结果字典，包含:
            - log_id: 唯一日志ID
            - words_result_num: 识别结果数
            - words_result: 识别结果数组
                - words: 识别的文字
                - location: 位置信息 {left, top, width, height}
                - chars: 单字符结果（当recognize_granularity=small时）
                - probability: 置信度（当probability=true时）
                - vertexes_location: 外接多边形顶点（当vertexes_location=true时）
            - direction: 图像方向（当detect_direction=true时）
            - paragraphs_result: 段落结果（当paragraph=true时）
            - image_size: 原始图片尺寸
        """
        logger.info(f"🔍 开始高精度OCR识别: {image_path}")
        
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
                logger.info(f"📦 图片编码完成: base64={len(image_base64)} bytes")
            
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
                logger.info("🔐 使用BCEv3签名认证")
            else:
                # 使用Access Token (URL参数)
                url = f"{self.api_url}?access_token={self.api_key}"
                logger.info("🔐 使用Access Token认证")
            
            # 构建表单数据
            form_data = {
                'image': image_encoded,
                'language_type': language_type,
                'recognize_granularity': recognize_granularity,
                'detect_direction': 'true' if detect_direction else 'false',
                'vertexes_location': 'true' if vertexes_location else 'false',
                'paragraph': 'true' if paragraph else 'false',
                'probability': 'true' if probability else 'false',
                'multidirectional_recognize': 'true' if multidirectional_recognize else 'false',
            }
            
            if recognize_granularity == 'small' and char_probability:
                form_data['char_probability'] = 'true'
            
            if recognize_granularity == 'small' and eng_granularity:
                form_data['eng_granularity'] = eng_granularity
            
            # 转换为URL编码的表单数据
            data = '&'.join([f"{k}={v}" for k, v in form_data.items()])
            
            logger.info("🌐 发送请求到百度高精度OCR API...")
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
            words_result_num = result.get('words_result_num', 0)
            words_result = result.get('words_result', [])
            direction = result.get('direction', None)
            paragraphs_result_num = result.get('paragraphs_result_num', 0)
            paragraphs_result = result.get('paragraphs_result', [])
            
            logger.info(f"✅ 高精度OCR识别成功! log_id={log_id}, 识别到 {words_result_num} 行文字")
            
            # 解析文字行信息
            text_lines = []
            for line in words_result:
                line_info = {
                    'text': line.get('words', ''),
                    'location': line.get('location', {}),
                    'bbox': self._location_to_bbox(line.get('location', {})),
                }
                
                # 单字符结果
                if 'chars' in line:
                    line_info['chars'] = []
                    for char in line['chars']:
                        char_info = {
                            'char': char.get('char', ''),
                            'location': char.get('location', {}),
                            'bbox': self._location_to_bbox(char.get('location', {})),
                        }
                        if 'char_prob' in char:
                            char_info['probability'] = char['char_prob']
                        line_info['chars'].append(char_info)
                
                # 置信度
                if 'probability' in line:
                    line_info['probability'] = line['probability']
                
                # 外接多边形顶点
                if 'vertexes_location' in line:
                    line_info['vertexes_location'] = line['vertexes_location']
                
                if 'finegrained_vertexes_location' in line:
                    line_info['finegrained_vertexes_location'] = line['finegrained_vertexes_location']
                
                if 'min_finegrained_vertexes_location' in line:
                    line_info['min_finegrained_vertexes_location'] = line['min_finegrained_vertexes_location']
                
                text_lines.append(line_info)
            
            # 解析段落信息
            paragraphs = []
            if paragraphs_result:
                for para in paragraphs_result:
                    para_info = {
                        'words_result_idx': para.get('words_result_idx', []),
                    }
                    if 'finegrained_vertexes_location' in para:
                        para_info['finegrained_vertexes_location'] = para['finegrained_vertexes_location']
                    if 'min_finegrained_vertexes_location' in para:
                        para_info['min_finegrained_vertexes_location'] = para['min_finegrained_vertexes_location']
                    paragraphs.append(para_info)
            
            return {
                'log_id': log_id,
                'words_result_num': words_result_num,
                'words_result': words_result,  # 原始结果
                'text_lines': text_lines,  # 解析后的文字行
                'direction': direction,
                'paragraphs_result_num': paragraphs_result_num,
                'paragraphs_result': paragraphs_result,  # 原始段落结果
                'paragraphs': paragraphs,  # 解析后的段落
                'image_size': (original_width, original_height),
            }
            
        except Exception as e:
            logger.error(f"❌ 高精度OCR识别失败: {str(e)}")
            raise
    
    def _location_to_bbox(self, location: Dict[str, int]) -> List[int]:
        """
        将location格式转换为bbox格式 [x0, y0, x1, y1]
        
        Args:
            location: {left, top, width, height}
            
        Returns:
            bbox [x0, y0, x1, y1]
        """
        if not location:
            return [0, 0, 0, 0]
        
        left = location.get('left', 0)
        top = location.get('top', 0)
        width = location.get('width', 0)
        height = location.get('height', 0)
        
        return [left, top, left + width, top + height]
    
    def get_full_text(self, result: Dict[str, Any], separator: str = '\n') -> str:
        """
        从识别结果中提取完整文本
        
        Args:
            result: recognize()返回的结果
            separator: 行分隔符，默认换行
            
        Returns:
            完整的文本字符串
        """
        text_lines = result.get('text_lines', [])
        return separator.join([line.get('text', '') for line in text_lines])
    
    def get_text_with_positions(self, result: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        获取带位置信息的文字列表
        
        Args:
            result: recognize()返回的结果
            
        Returns:
            文字位置列表，每项包含 text 和 bbox
        """
        text_lines = result.get('text_lines', [])
        return [
            {
                'text': line.get('text', ''),
                'bbox': line.get('bbox', [0, 0, 0, 0]),
            }
            for line in text_lines
        ]


def create_baidu_accurate_ocr_provider(
    api_key: Optional[str] = None,
    api_secret: Optional[str] = None
) -> Optional[BaiduAccurateOCRProvider]:
    """
    创建百度高精度OCR Provider实例
    
    Args:
        api_key: 百度API Key（BCEv3格式或Access Token），如果不提供则从环境变量读取
        api_secret: 百度API Secret（可选），如果不提供则从环境变量读取
        
    Returns:
        BaiduAccurateOCRProvider实例，如果api_key不可用则返回None
    """
    import os
    
    if not api_key:
        api_key = os.getenv('BAIDU_OCR_API_KEY')
    
    if not api_secret:
        api_secret = os.getenv('BAIDU_OCR_API_SECRET')
    
    if not api_key:
        logger.warning("⚠️ 未配置百度OCR API Key, 跳过百度高精度OCR")
        return None
    
    return BaiduAccurateOCRProvider(api_key, api_secret)

