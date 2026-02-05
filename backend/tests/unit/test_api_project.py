"""
项目管理API单元测试 - SaaS版本（需要认证）
"""

import pytest
from conftest import assert_success_response, assert_error_response


class TestProjectCreate:
    """项目创建测试"""

    def test_create_project_idea_mode(self, authenticated_client):
        """测试从想法创建项目"""
        response = authenticated_client.post('/api/projects', json={
            'creation_type': 'idea',
            'idea_prompt': '生成一份关于AI的PPT'
        })

        data = assert_success_response(response, 201)
        assert 'project_id' in data['data']
        assert data['data']['status'] == 'DRAFT'

    def test_create_project_outline_mode(self, authenticated_client):
        """测试从大纲创建项目"""
        response = authenticated_client.post('/api/projects', json={
            'creation_type': 'outline',
            'outline': [
                {'title': '第一页', 'points': ['要点1']},
                {'title': '第二页', 'points': ['要点2']}
            ]
        })

        data = assert_success_response(response, 201)
        assert 'project_id' in data['data']

    def test_create_project_missing_type(self, authenticated_client):
        """测试缺少creation_type参数"""
        response = authenticated_client.post('/api/projects', json={
            'idea_prompt': '测试'
        })

        # 应该返回错误
        assert response.status_code in [400, 422]

    def test_create_project_invalid_type(self, authenticated_client):
        """测试无效的creation_type"""
        response = authenticated_client.post('/api/projects', json={
            'creation_type': 'invalid_type',
            'idea_prompt': '测试'
        })

        assert response.status_code in [400, 422]

    def test_create_project_unauthorized(self, client):
        """测试未认证时无法创建项目"""
        response = client.post('/api/projects', json={
            'creation_type': 'idea',
            'idea_prompt': '测试'
        })

        assert response.status_code == 401


class TestProjectGet:
    """项目获取测试"""

    def test_get_project_success(self, authenticated_client, sample_project):
        """测试获取项目成功"""
        if not sample_project:
            pytest.skip("项目创建失败")

        project_id = sample_project['project_id']
        response = authenticated_client.get(f'/api/projects/{project_id}')

        data = assert_success_response(response)
        assert data['data']['project_id'] == project_id

    def test_get_project_not_found(self, authenticated_client):
        """测试获取不存在的项目"""
        response = authenticated_client.get('/api/projects/non-existent-id')

        assert response.status_code == 404

    def test_get_project_invalid_id_format(self, authenticated_client):
        """测试无效的项目ID格式"""
        response = authenticated_client.get('/api/projects/invalid!@#$%id')

        # 可能返回404或400
        assert response.status_code in [400, 404]

    def test_get_project_unauthorized(self, client):
        """测试未认证时无法获取项目"""
        response = client.get('/api/projects/some-id')

        assert response.status_code == 401


class TestProjectUpdate:
    """项目更新测试"""

    def test_update_project_status(self, authenticated_client, sample_project):
        """测试更新项目状态"""
        if not sample_project:
            pytest.skip("项目创建失败")

        project_id = sample_project['project_id']
        response = authenticated_client.put(f'/api/projects/{project_id}', json={
            'status': 'GENERATING'
        })

        # 状态更新应该成功
        assert response.status_code == 200
        data = response.get_json()
        assert data['success'] is True


class TestProjectDelete:
    """项目删除测试"""

    def test_delete_project_success(self, authenticated_client, sample_project):
        """测试删除项目成功"""
        if not sample_project:
            pytest.skip("项目创建失败")

        project_id = sample_project['project_id']
        response = authenticated_client.delete(f'/api/projects/{project_id}')

        data = assert_success_response(response)

        # 确认项目已删除
        get_response = authenticated_client.get(f'/api/projects/{project_id}')
        assert get_response.status_code == 404

    def test_delete_project_not_found(self, authenticated_client):
        """测试删除不存在的项目"""
        response = authenticated_client.delete('/api/projects/non-existent-id')

        assert response.status_code == 404

    def test_delete_project_unauthorized(self, client):
        """测试未认证时无法删除项目"""
        response = client.delete('/api/projects/some-id')

        assert response.status_code == 401
