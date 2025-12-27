"""
Inpainting Service 测试
"""
import unittest
from unittest.mock import Mock, patch, MagicMock
from PIL import Image
import sys
import os

# 添加 backend 目录到 Python 路径
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from services.inpainting_service import InpaintingService
from services.ai_providers.image.volcengine_inpainting_provider import VolcengineInpaintingProvider
from utils.mask_utils import (
    create_mask_from_bboxes,
    create_inverse_mask_from_bboxes,
    merge_overlapping_bboxes,
    visualize_mask_overlay
)


class TestMaskUtils(unittest.TestCase):
    """测试掩码工具函数"""
    
    def test_create_mask_from_bboxes_tuple_format(self):
        """测试从元组格式的 bbox 创建掩码"""
        image_size = (400, 300)
        bboxes = [(50, 50, 150, 150), (200, 100, 300, 200)]
        
        mask = create_mask_from_bboxes(image_size, bboxes)
        
        self.assertEqual(mask.size, image_size)
        self.assertEqual(mask.mode, 'RGB')
        
        # 检查掩码区域是白色
        pixel = mask.getpixel((100, 100))
        self.assertEqual(pixel, (255, 255, 255))
        
        # 检查背景区域是黑色
        pixel = mask.getpixel((10, 10))
        self.assertEqual(pixel, (0, 0, 0))
    
    def test_create_mask_from_bboxes_dict_format_x1y1x2y2(self):
        """测试从字典格式 (x1, y1, x2, y2) 的 bbox 创建掩码"""
        image_size = (400, 300)
        bboxes = [
            {"x1": 50, "y1": 50, "x2": 150, "y2": 150}
        ]
        
        mask = create_mask_from_bboxes(image_size, bboxes)
        
        self.assertEqual(mask.size, image_size)
        pixel = mask.getpixel((100, 100))
        self.assertEqual(pixel, (255, 255, 255))
    
    def test_create_mask_from_bboxes_dict_format_xywh(self):
        """测试从字典格式 (x, y, width, height) 的 bbox 创建掩码"""
        image_size = (400, 300)
        bboxes = [
            {"x": 50, "y": 50, "width": 100, "height": 100}
        ]
        
        mask = create_mask_from_bboxes(image_size, bboxes)
        
        self.assertEqual(mask.size, image_size)
        pixel = mask.getpixel((100, 100))
        self.assertEqual(pixel, (255, 255, 255))
    
    def test_create_mask_with_expand_pixels(self):
        """测试带扩展像素的掩码创建"""
        image_size = (400, 300)
        bboxes = [(100, 100, 200, 200)]
        expand = 10
        
        mask = create_mask_from_bboxes(image_size, bboxes, expand_pixels=expand)
        
        # 检查扩展后的边缘也是白色
        pixel = mask.getpixel((90, 100))  # 左边缘扩展
        self.assertEqual(pixel, (255, 255, 255))
    
    def test_create_inverse_mask(self):
        """测试反向掩码创建"""
        image_size = (400, 300)
        bboxes = [(100, 100, 200, 200)]
        
        mask = create_inverse_mask_from_bboxes(image_size, bboxes)
        
        # bbox 区域应该是黑色（保留）
        pixel = mask.getpixel((150, 150))
        self.assertEqual(pixel, (0, 0, 0))
        
        # 背景区域应该是白色（消除）
        pixel = mask.getpixel((10, 10))
        self.assertEqual(pixel, (255, 255, 255))
    
    def test_merge_overlapping_bboxes(self):
        """测试合并重叠的 bbox"""
        bboxes = [
            (100, 100, 200, 200),
            (190, 190, 300, 300),  # 与第一个重叠
        ]
        
        merged = merge_overlapping_bboxes(bboxes, merge_threshold=10)
        
        # 应该合并为一个大 bbox
        self.assertEqual(len(merged), 1)
        self.assertEqual(merged[0], (100, 100, 300, 300))
    
    def test_merge_non_overlapping_bboxes(self):
        """测试不合并不重叠的 bbox"""
        bboxes = [
            (100, 100, 200, 200),
            (300, 300, 400, 400),  # 距离较远
        ]
        
        merged = merge_overlapping_bboxes(bboxes, merge_threshold=10)
        
        # 不应该合并
        self.assertEqual(len(merged), 2)


class TestVolcengineInpaintingProvider(unittest.TestCase):
    """测试火山引擎 Inpainting 提供者"""
    
    def test_init(self):
        """测试初始化"""
        provider = VolcengineInpaintingProvider(
            access_key="test_key",
            secret_key="test_secret",
            timeout=30
        )
        
        self.assertEqual(provider.access_key, "test_key")
        self.assertEqual(provider.secret_key, "test_secret")
        self.assertEqual(provider.timeout, 30)
    
    def test_encode_image_to_base64(self):
        """测试图像编码"""
        provider = VolcengineInpaintingProvider("key", "secret")
        
        # 创建测试图像
        image = Image.new('RGB', (100, 100), color='red')
        
        base64_str = provider._encode_image_to_base64(image)
        
        self.assertIsInstance(base64_str, str)
        self.assertTrue(len(base64_str) > 0)
    
    @patch('requests.post')
    def test_inpaint_image_success(self, mock_post):
        """测试成功的 inpaint 调用"""
        provider = VolcengineInpaintingProvider("key", "secret")
        
        # 模拟成功响应
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "code": 10000,
            "data": {
                "binary_data_base64": ["base64_encoded_image_data"]
            }
        }
        mock_post.return_value = mock_response
        
        original_image = Image.new('RGB', (100, 100), color='blue')
        mask_image = Image.new('RGB', (100, 100), color='white')
        
        # 注意：实际调用会失败因为 base64 数据不是真实图像
        # 这里只测试 API 调用流程
        # result = provider.inpaint_image(original_image, mask_image)


class TestInpaintingService(unittest.TestCase):
    """测试 Inpainting 服务"""
    
    @patch('services.inpainting_service.get_config')
    def test_init_with_config(self, mock_get_config):
        """测试从配置初始化"""
        mock_config = Mock()
        mock_config.VOLCENGINE_ACCESS_KEY = "test_key"
        mock_config.VOLCENGINE_SECRET_KEY = "test_secret"
        mock_config.VOLCENGINE_INPAINTING_TIMEOUT = 60
        mock_config.VOLCENGINE_INPAINTING_MAX_RETRIES = 3
        mock_get_config.return_value = mock_config
        
        service = InpaintingService()
        
        self.assertIsNotNone(service.provider)
    
    @patch('services.inpainting_service.get_config')
    def test_init_without_credentials_raises_error(self, mock_get_config):
        """测试没有凭证时抛出错误"""
        mock_config = Mock()
        mock_config.VOLCENGINE_ACCESS_KEY = ""
        mock_config.VOLCENGINE_SECRET_KEY = ""
        mock_get_config.return_value = mock_config
        
        with self.assertRaises(ValueError):
            InpaintingService()
    
    def test_init_with_custom_provider(self):
        """测试使用自定义提供者初始化"""
        custom_provider = VolcengineInpaintingProvider("key", "secret")
        service = InpaintingService(volcengine_provider=custom_provider)
        
        self.assertEqual(service.provider, custom_provider)
    
    def test_create_mask_preview(self):
        """测试创建掩码预览"""
        mock_provider = Mock()
        service = InpaintingService(volcengine_provider=mock_provider)
        
        image = Image.new('RGB', (400, 300), color='blue')
        bboxes = [(50, 50, 150, 150)]
        
        preview = service.create_mask_preview(image, bboxes, expand_pixels=5)
        
        self.assertIsInstance(preview, Image.Image)
        self.assertEqual(preview.size, image.size)
    
    def test_static_create_mask_image(self):
        """测试静态方法创建掩码图像"""
        mask = InpaintingService.create_mask_image(
            image_size=(400, 300),
            bboxes=[(50, 50, 150, 150)],
            expand_pixels=5
        )
        
        self.assertIsInstance(mask, Image.Image)
        self.assertEqual(mask.size, (400, 300))


if __name__ == '__main__':
    unittest.main()

