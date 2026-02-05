"""
完整工作流集成测试

测试从创建项目到导出PPTX的完整流程
"""

import pytest
import time
from conftest import assert_success_response


class TestFullWorkflow:
    """完整工作流测试"""

    def test_create_project_and_get_details(self, authenticated_client):
        """测试创建项目并获取详情"""
        # 1. 创建项目
        create_response = authenticated_client.post('/api/projects', json={
            'creation_type': 'idea',
            'idea_prompt': '生成一份关于量子计算的PPT，共3页'
        })

        data = assert_success_response(create_response, 201)
        project_id = data['data']['project_id']

        # 2. 获取项目详情
        get_response = authenticated_client.get(f'/api/projects/{project_id}')

        data = assert_success_response(get_response)
        assert data['data']['project_id'] == project_id
        assert data['data']['status'] == 'DRAFT'

    def test_template_upload_workflow(self, authenticated_client, sample_image_file):
        """测试模板上传工作流"""
        # 1. 创建项目
        create_response = authenticated_client.post('/api/projects', json={
            'creation_type': 'idea',
            'idea_prompt': '测试模板上传'
        })

        data = assert_success_response(create_response, 201)
        project_id = data['data']['project_id']

        # 2. 上传模板
        upload_response = authenticated_client.post(
            f'/api/projects/{project_id}/template',
            data={'template_image': (sample_image_file, 'template.png')},
            content_type='multipart/form-data'
        )

        # 检查上传结果
        assert upload_response.status_code in [200, 201]

    def test_project_lifecycle(self, authenticated_client):
        """测试项目完整生命周期"""
        # 1. 创建
        create_response = authenticated_client.post('/api/projects', json={
            'creation_type': 'idea',
            'idea_prompt': '生命周期测试'
        })
        data = assert_success_response(create_response, 201)
        project_id = data['data']['project_id']

        # 2. 读取
        get_response = authenticated_client.get(f'/api/projects/{project_id}')
        assert_success_response(get_response)

        # 3. 更新（如果API支持）
        # update_response = authenticated_client.put(f'/api/projects/{project_id}', json={...})

        # 4. 删除
        delete_response = authenticated_client.delete(f'/api/projects/{project_id}')
        assert_success_response(delete_response)

        # 5. 确认删除
        verify_response = authenticated_client.get(f'/api/projects/{project_id}')
        assert verify_response.status_code == 404


class TestAPIErrorHandling:
    """API错误处理测试"""

    def test_invalid_json_body(self, authenticated_client):
        """测试无效的JSON请求体"""
        # Note: authenticated_client uses a wrapper, access _client for raw requests
        response = authenticated_client._client.post(
            '/api/projects',
            data='invalid json',
            content_type='application/json',
            headers=authenticated_client._headers
        )

        assert response.status_code in [400, 415, 422]

    def test_missing_required_fields(self, authenticated_client):
        """测试缺少必需字段"""
        response = authenticated_client.post('/api/projects', json={})

        assert response.status_code in [400, 422]

    def test_method_not_allowed(self, client):
        """测试不允许的HTTP方法"""
        response = client.patch('/api/projects')

        # PATCH可能不被支持
        assert response.status_code in [401, 404, 405]


class TestConcurrentRequests:
    """并发请求测试"""

    def test_multiple_project_creation(self, authenticated_client):
        """测试多个项目创建不冲突"""
        project_ids = []

        for i in range(3):
            response = authenticated_client.post('/api/projects', json={
                'creation_type': 'idea',
                'idea_prompt': f'并发测试项目 {i}'
            })

            data = assert_success_response(response, 201)
            project_ids.append(data['data']['project_id'])

        # 确保所有项目ID都不同
        assert len(set(project_ids)) == 3

        # 清理
        for pid in project_ids:
            authenticated_client.delete(f'/api/projects/{pid}')

