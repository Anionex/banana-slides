"""
项目管理API单元测试
"""

import pytest
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


class TestProjectGenerationTasks:
    """项目生成异步任务测试"""

    def test_generate_outline_task_returns_task_id(self, client, monkeypatch):
        """主页从大纲生成应启动异步任务，而不是等待同步 AI 请求"""
        response = client.post('/api/projects', json={
            'creation_type': 'outline',
            'outline_text': '第一页\n- 要点1'
        })
        data = assert_success_response(response, 201)
        project_id = data['data']['project_id']

        submitted = {}

        def fake_submit(task_id, func, *args, **kwargs):
            submitted['task_id'] = task_id
            submitted['func'] = func.__name__
            submitted['args'] = args

        monkeypatch.setattr('controllers.project_controller.task_manager.submit_task', fake_submit)

        task_response = client.post(f'/api/projects/{project_id}/generate/outline/task', json={'language': 'zh'})
        task_data = assert_success_response(task_response, 202)

        assert task_data['data']['task_id']
        assert task_data['data']['status'] == 'GENERATING_OUTLINE'
        assert submitted['task_id'] == task_data['data']['task_id']
        assert submitted['func'] == 'generate_outline_task'

        status_response = client.get(f"/api/projects/{project_id}/tasks/{task_data['data']['task_id']}")
        status_data = assert_success_response(status_response)
        assert status_data['data']['task_type'] == 'GENERATE_OUTLINE'
        assert status_data['data']['status'] == 'PENDING'

        project_response = client.get(f'/api/projects/{project_id}')
        project_data = assert_success_response(project_response)
        assert project_data['data']['status'] == 'GENERATING_OUTLINE'

    def test_generate_from_description_task_returns_task_id(self, client, monkeypatch):
        """主页从描述生成应启动异步任务，并保留可轮询的项目状态"""
        response = client.post('/api/projects', json={
            'creation_type': 'descriptions',
            'description_text': '第一页：介绍主题'
        })
        data = assert_success_response(response, 201)
        project_id = data['data']['project_id']

        submitted = {}

        def fake_submit(task_id, func, *args, **kwargs):
            submitted['task_id'] = task_id
            submitted['func'] = func.__name__
            submitted['args'] = args

        monkeypatch.setattr('controllers.project_controller.task_manager.submit_task', fake_submit)

        task_response = client.post(
            f'/api/projects/{project_id}/generate/from-description/task',
            json={'description_text': '第一页：介绍主题', 'language': 'zh'}
        )
        task_data = assert_success_response(task_response, 202)

        assert task_data['data']['task_id']
        assert task_data['data']['status'] == 'GENERATING_DESCRIPTIONS'
        assert submitted['task_id'] == task_data['data']['task_id']
        assert submitted['func'] == 'generate_from_description_task'

        status_response = client.get(f"/api/projects/{project_id}/tasks/{task_data['data']['task_id']}")
        status_data = assert_success_response(status_response)
        assert status_data['data']['task_type'] == 'GENERATE_FROM_DESCRIPTION'
        assert status_data['data']['status'] == 'PENDING'

        project_response = client.get(f'/api/projects/{project_id}')
        project_data = assert_success_response(project_response)
        assert project_data['data']['status'] == 'GENERATING_DESCRIPTIONS'

    def test_generate_outline_task_persists_pages(self, client, app, monkeypatch):
        """后台任务真实执行后应落库页面，并将任务标记完成"""
        response = client.post('/api/projects', json={
            'creation_type': 'outline',
            'outline_text': '第一页\n- 要点1'
        })
        data = assert_success_response(response, 201)
        project_id = data['data']['project_id']

        class FakeAIService:
            def parse_outline_text(self, project_context, language=None):
                return [{'title': '第一页', 'points': ['要点1']}]

            def flatten_outline(self, outline):
                return outline

        monkeypatch.setattr('services.task_manager.get_ai_service', lambda: FakeAIService())

        from models import db, Task, Project, Page
        from services.task_manager import generate_outline_task

        with app.app_context():
            task = Task(project_id=project_id, task_type='GENERATE_OUTLINE', status='PENDING')
            db.session.add(task)
            db.session.commit()
            task_id = task.id

        generate_outline_task(task_id, project_id, language='zh', app=app)

        with app.app_context():
            task = Task.query.get(task_id)
            project = Project.query.get(project_id)
            pages = Page.query.filter_by(project_id=project_id).order_by(Page.order_index).all()

            assert task.status == 'COMPLETED'
            assert task.get_progress()['completed'] == 1
            assert project.status == 'OUTLINE_GENERATED'
            assert len(pages) == 1
            assert pages[0].get_outline_content()['title'] == '第一页'

    def test_generate_from_description_task_persists_descriptions(self, client, app, monkeypatch):
        """从描述生成后台任务真实执行后应落库大纲和页面描述"""
        response = client.post('/api/projects', json={
            'creation_type': 'descriptions',
            'description_text': '第一页：介绍主题'
        })
        data = assert_success_response(response, 201)
        project_id = data['data']['project_id']

        class FakeAIService:
            def parse_description_to_outline(self, project_context, language=None):
                return [{'title': '第一页', 'points': ['介绍主题']}]

            def parse_description_to_page_descriptions(self, project_context, outline, language=None):
                return ['介绍主题的页面描述']

            def flatten_outline(self, outline):
                return outline

        monkeypatch.setattr('services.task_manager.get_ai_service', lambda: FakeAIService())

        from models import db, Task, Project, Page
        from services.task_manager import generate_from_description_task

        with app.app_context():
            task = Task(project_id=project_id, task_type='GENERATE_FROM_DESCRIPTION', status='PENDING')
            db.session.add(task)
            db.session.commit()
            task_id = task.id

        generate_from_description_task(task_id, project_id, description_text='第一页：介绍主题', language='zh', app=app)

        with app.app_context():
            task = Task.query.get(task_id)
            project = Project.query.get(project_id)
            pages = Page.query.filter_by(project_id=project_id).order_by(Page.order_index).all()

            assert task.status == 'COMPLETED'
            assert task.get_progress()['completed'] == 2
            assert project.status == 'DESCRIPTIONS_GENERATED'
            assert len(pages) == 1
            assert pages[0].get_outline_content()['title'] == '第一页'
            assert pages[0].get_description_content()['text'] == '介绍主题的页面描述'


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

    def test_update_project_title(self, client, sample_project):
        """测试更新项目标题不影响 idea_prompt"""
        if not sample_project:
            pytest.skip("项目创建失败")

        project_id = sample_project['project_id']
        get_before = client.get(f'/api/projects/{project_id}')
        before_data = assert_success_response(get_before)

        response = client.put(f'/api/projects/{project_id}', json={
            'project_title': '新的项目标题'
        })

        data = assert_success_response(response)
        assert data['data']['project_title'] == '新的项目标题'
        assert data['data']['idea_prompt'] == before_data['data']['idea_prompt']


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
