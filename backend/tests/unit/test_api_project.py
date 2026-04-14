"""
项目管理API单元测试
"""

import pytest
from unittest.mock import MagicMock, patch
from conftest import assert_success_response, assert_error_response


class TestProjectCreate:
    """项目创建测试"""
    
    def test_create_project_idea_mode(self, client):
        """测试从想法创建项目"""
        response = client.post('/api/projects', json={
            'creation_type': 'idea',
            'idea_prompt': '生成一份关于AI的PPT'
        })
        
        data = assert_success_response(response, 201)
        assert 'project_id' in data['data']
        assert data['data']['status'] == 'DRAFT'
    
    def test_create_project_outline_mode(self, client):
        """测试从大纲创建项目"""
        response = client.post('/api/projects', json={
            'creation_type': 'outline',
            'outline': [
                {'title': '第一页', 'points': ['要点1']},
                {'title': '第二页', 'points': ['要点2']}
            ]
        })
        
        data = assert_success_response(response, 201)
        assert 'project_id' in data['data']
    
    def test_create_project_missing_type(self, client):
        """测试缺少creation_type参数"""
        response = client.post('/api/projects', json={
            'idea_prompt': '测试'
        })
        
        # 应该返回错误
        assert response.status_code in [400, 422]
    
    def test_create_project_invalid_type(self, client):
        """测试无效的creation_type"""
        response = client.post('/api/projects', json={
            'creation_type': 'invalid_type',
            'idea_prompt': '测试'
        })
        
        assert response.status_code in [400, 422]


class TestProjectGet:
    """项目获取测试"""
    
    def test_get_project_success(self, client, sample_project):
        """测试获取项目成功"""
        if not sample_project:
            pytest.skip("项目创建失败")
        
        project_id = sample_project['project_id']
        response = client.get(f'/api/projects/{project_id}')
        
        data = assert_success_response(response)
        assert data['data']['project_id'] == project_id
    
    def test_get_project_not_found(self, client):
        """测试获取不存在的项目"""
        response = client.get('/api/projects/non-existent-id')
        
        assert response.status_code == 404
    
    def test_get_project_invalid_id_format(self, client):
        """测试无效的项目ID格式"""
        response = client.get('/api/projects/invalid!@#$%id')
        
        # 可能返回404或400
        assert response.status_code in [400, 404]


class TestProjectUpdate:
    """项目更新测试"""
    
    def test_update_project_status(self, client, sample_project):
        """测试更新项目状态"""
        if not sample_project:
            pytest.skip("项目创建失败")
        
        project_id = sample_project['project_id']
        response = client.put(f'/api/projects/{project_id}', json={
            'status': 'GENERATING'
        })
        
        # 状态更新应该成功
        assert response.status_code == 200
        data = response.get_json()
        assert data['success'] is True


class TestProjectDelete:
    """项目删除测试"""
    
    def test_delete_project_success(self, client, sample_project):
        """测试删除项目成功"""
        if not sample_project:
            pytest.skip("项目创建失败")
        
        project_id = sample_project['project_id']
        response = client.delete(f'/api/projects/{project_id}')
        
        data = assert_success_response(response)
        
        # 确认项目已删除
        get_response = client.get(f'/api/projects/{project_id}')
        assert get_response.status_code == 404
    
    def test_delete_project_not_found(self, client):
        """测试删除不存在的项目"""
        response = client.delete('/api/projects/non-existent-id')
        
        assert response.status_code == 404


class TestGenerateImagesPoints:
    """批量生图积分规则测试"""

    @staticmethod
    def _auth_headers(user):
        from utils.auth import generate_tokens

        tokens = generate_tokens(user.id, user.role)
        return {'Authorization': f"Bearer {tokens['access_token']}"}

    @staticmethod
    def _create_project_with_page(db_session, user):
        from models import Page, Project

        project = Project(
            idea_prompt='测试批量生图',
            creation_type='idea',
            template_style='clean medical style',
            status='DESCRIPTIONS_GENERATED',
            user_id=user.id,
        )
        db_session.add(project)
        db_session.flush()

        page = Page(project_id=project.id, order_index=0, status='DRAFT')
        page.set_outline_content({'title': '第一页', 'points': ['要点1']})
        page.set_description_content({'text': '这是完整的页面描述，可用于生成图片。'})
        db_session.add(page)
        db_session.commit()

        return project, page

    def test_generate_images_blocks_regular_user_with_insufficient_points(self, client, db_session):
        from models import User

        user = User(username='normal-user', role='user', points=2)
        db_session.add(user)
        db_session.commit()

        project, page = self._create_project_with_page(db_session, user)

        response = client.post(
            f'/api/projects/{project.id}/generate/images',
            json={'page_ids': [page.id], 'use_template': False},
            headers=self._auth_headers(user),
        )

        data = assert_error_response(response, 402)
        assert data['error'] == 'insufficient_points'
        assert data['required'] == 3
        assert data['current'] == 2

    def test_generate_images_skips_points_for_admin_user(self, client, db_session):
        from models import PointsTransaction, User

        admin = User(username='admin-user', role='admin', points=0)
        db_session.add(admin)
        db_session.commit()

        project, page = self._create_project_with_page(db_session, admin)

        with patch('controllers.project_controller.get_ai_service', return_value=MagicMock()), \
             patch('controllers.project_controller.task_manager.submit_task'):
            response = client.post(
                f'/api/projects/{project.id}/generate/images',
                json={'page_ids': [page.id], 'use_template': False},
                headers=self._auth_headers(admin),
            )

        data = assert_success_response(response, 202)
        assert data['data']['total_pages'] == 1

        db_session.refresh(admin)
        assert admin.points == 0
        assert PointsTransaction.query.filter_by(user_id=admin.id, type='generation').count() == 0

    def test_generate_images_passes_authenticated_user_to_background_task(self, client, db_session):
        from models import User

        admin = User(username='admin-runtime-user', role='admin', points=0)
        db_session.add(admin)
        db_session.commit()

        project, page = self._create_project_with_page(db_session, admin)

        with patch('controllers.project_controller.task_manager.submit_task') as mock_submit:
            response = client.post(
                f'/api/projects/{project.id}/generate/images',
                json={'page_ids': [page.id], 'use_template': False},
                headers=self._auth_headers(admin),
            )

        data = assert_success_response(response, 202)
        assert data['data']['total_pages'] == 1
        assert mock_submit.called
        submit_args = mock_submit.call_args[0]
        assert submit_args[-1] == admin.id
