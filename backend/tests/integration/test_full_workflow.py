"""
完整工作流集成测试

测试从创建项目到导出PPTX的完整流程
"""

import pytest
import time
import io
from pathlib import Path
from flask import current_app
from PIL import Image
from conftest import assert_success_response


class TestFullWorkflow:
    """完整工作流测试"""
    
    def test_create_project_and_get_details(self, client):
        """测试创建项目并获取详情"""
        # 1. 创建项目
        create_response = client.post('/api/projects', json={
            'creation_type': 'idea',
            'idea_prompt': '生成一份关于量子计算的PPT，共3页'
        })
        
        data = assert_success_response(create_response, 201)
        project_id = data['data']['project_id']
        
        # 2. 获取项目详情
        get_response = client.get(f'/api/projects/{project_id}')
        
        data = assert_success_response(get_response)
        assert data['data']['project_id'] == project_id
        assert data['data']['status'] == 'DRAFT'
    
    def test_template_upload_workflow(self, client, sample_image_file):
        """测试模板上传工作流"""
        # 1. 创建项目
        create_response = client.post('/api/projects', json={
            'creation_type': 'idea',
            'idea_prompt': '测试模板上传'
        })
        
        data = assert_success_response(create_response, 201)
        project_id = data['data']['project_id']
        
        # 2. 上传模板
        upload_response = client.post(
            f'/api/projects/{project_id}/template',
            data={'template_image': (sample_image_file, 'template.png')},
            content_type='multipart/form-data'
        )
        
        # 检查上传结果
        assert upload_response.status_code in [200, 201]

    def test_invalid_template_upload_is_rejected_and_does_not_replace_existing(self, client, sample_image_file):
        """扩展名正确但内容不是图片的模板上传应在保存阶段被拒绝"""
        create_response = client.post('/api/projects', json={
            'creation_type': 'idea',
            'idea_prompt': '测试非法模板上传'
        })
        data = assert_success_response(create_response, 201)
        project_id = data['data']['project_id']

        upload_response = client.post(
            f'/api/projects/{project_id}/template',
            data={'template_image': (sample_image_file, 'template.png')},
            content_type='multipart/form-data'
        )
        assert_success_response(upload_response)

        template_path = Path(current_app.config['UPLOAD_FOLDER']) / project_id / 'template' / 'template.png'
        assert template_path.exists()

        invalid_response = client.post(
            f'/api/projects/{project_id}/template',
            data={'template_image': (io.BytesIO(b'<html>not an image</html>'), 'template.png')},
            content_type='multipart/form-data'
        )

        assert invalid_response.status_code == 400
        with Image.open(template_path) as image:
            assert image.size == (100, 100)

    def test_invalid_user_template_upload_is_rejected(self, client):
        """用户模板库也不能保存扩展名伪装的非图片内容"""
        response = client.post(
            '/api/user-templates',
            data={'template_image': (io.BytesIO(b'<html>not an image</html>'), 'template.png')},
            content_type='multipart/form-data'
        )

        assert response.status_code == 400
    
    def test_project_lifecycle(self, client):
        """测试项目完整生命周期"""
        # 1. 创建
        create_response = client.post('/api/projects', json={
            'creation_type': 'idea',
            'idea_prompt': '生命周期测试'
        })
        data = assert_success_response(create_response, 201)
        project_id = data['data']['project_id']
        
        # 2. 读取
        get_response = client.get(f'/api/projects/{project_id}')
        assert_success_response(get_response)
        
        # 3. 更新（如果API支持）
        # update_response = client.put(f'/api/projects/{project_id}', json={...})
        
        # 4. 删除
        delete_response = client.delete(f'/api/projects/{project_id}')
        assert_success_response(delete_response)
        
        # 5. 确认删除
        verify_response = client.get(f'/api/projects/{project_id}')
        assert verify_response.status_code == 404


class TestAPIErrorHandling:
    """API错误处理测试"""
    
    def test_invalid_json_body(self, client):
        """测试无效的JSON请求体"""
        response = client.post(
            '/api/projects',
            data='invalid json',
            content_type='application/json'
        )
        
        assert response.status_code in [400, 415, 422]
    
    def test_missing_required_fields(self, client):
        """测试缺少必需字段"""
        response = client.post('/api/projects', json={})
        
        assert response.status_code in [400, 422]
    
    def test_method_not_allowed(self, client):
        """测试不允许的HTTP方法"""
        response = client.patch('/api/projects')
        
        # PATCH可能不被支持
        assert response.status_code in [404, 405]


class TestConcurrentRequests:
    """并发请求测试"""
    
    def test_multiple_project_creation(self, client):
        """测试多个项目创建不冲突"""
        project_ids = []
        
        for i in range(3):
            response = client.post('/api/projects', json={
                'creation_type': 'idea',
                'idea_prompt': f'并发测试项目 {i}'
            })
            
            data = assert_success_response(response, 201)
            project_ids.append(data['data']['project_id'])
        
        # 确保所有项目ID都不同
        assert len(set(project_ids)) == 3
        
        # 清理
        for pid in project_ids:
            client.delete(f'/api/projects/{pid}')
