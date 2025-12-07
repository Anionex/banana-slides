import requests
from flask import Blueprint, send_file, jsonify, request
from urllib.parse import unquote
import io
from werkzeug.utils import secure_filename
import logging

# ��建蓝图
proxy_bp = Blueprint('proxy', __name__)
logger = logging.getLogger(__name__)

@proxy_bp.route('/api/proxy/image')
def proxy_image():
    """代理外部图片请求，解决CORS问题"""
    try:
        image_url = unquote(request.args.get('url', ''))
        if not image_url:
            return jsonify({'error': 'Missing URL parameter'}), 400

        logger.info(f"Proxying image request: {image_url}")

        # 设置请求头，模拟浏览器请求
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
            'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
            'Accept-Encoding': 'gzip, deflate, br',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
        }

        # 发起图片请求
        response = requests.get(image_url, headers=headers, timeout=10, stream=True)
        response.raise_for_status()

        # 获取内容类型
        content_type = response.headers.get('content-type', 'image/jpeg')

        # 创建流式响应
        def generate():
            for chunk in response.iter_content(chunk_size=8192):
                yield chunk

        return send_file(
            io.BytesIO(response.content),
            mimetype=content_type,
            as_attachment=False,
            download_name=secure_filename(image_url.split('/')[-1].split('?')[0] or 'image')
        )

    except requests.exceptions.RequestException as e:
        logger.error(f"Failed to proxy image {image_url}: {str(e)}")
        return jsonify({'error': f'Failed to fetch image: {str(e)}'}), 500
    except Exception as e:
        logger.error(f"Unexpected error in image proxy: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500