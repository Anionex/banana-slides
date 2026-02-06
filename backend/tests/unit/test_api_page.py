"""
Page controller API unit tests
"""
import pytest
from conftest import assert_success_response, assert_error_response


def _create_project_with_pages(authenticated_client):
    """Helper: create a project and add pages via API"""
    # Create project
    resp = authenticated_client.post('/api/projects', json={
        'creation_type': 'outline',
        'outline_text': '第一页: 要点1\n第二页: 要点2\n第三页: 要点3'
    })
    data = resp.get_json()
    if not data.get('success'):
        return None, []
    project_id = data['data']['project_id']

    # Add pages via create_page endpoint
    pages = []
    for i, title in enumerate(['第一页', '第二页', '第三页']):
        page_resp = authenticated_client.post(
            f'/api/projects/{project_id}/pages',
            json={
                'order_index': i,
                'outline_content': {'title': title, 'points': [f'要点{i+1}']}
            }
        )
        if page_resp.status_code == 201:
            pages.append(page_resp.get_json()['data'])

    return project_id, pages


class TestCreatePage:
    """页面创建测试"""

    def test_create_page_success(self, authenticated_client):
        project_id, pages = _create_project_with_pages(authenticated_client)
        if not project_id:
            pytest.skip("项目创建失败")

        response = authenticated_client.post(f'/api/projects/{project_id}/pages', json={
            'order_index': 1,
            'outline_content': {'title': '新页面', 'points': ['新要点']}
        })
        data = assert_success_response(response, 201)
        assert data['data']['order_index'] == 1

    def test_create_page_missing_order_index(self, authenticated_client):
        project_id, _ = _create_project_with_pages(authenticated_client)
        if not project_id:
            pytest.skip("项目创建失败")

        response = authenticated_client.post(f'/api/projects/{project_id}/pages', json={
            'outline_content': {'title': '新页面'}
        })
        assert response.status_code == 400

    def test_create_page_project_not_found(self, authenticated_client):
        response = authenticated_client.post('/api/projects/nonexistent/pages', json={
            'order_index': 0
        })
        assert response.status_code == 404

    def test_create_page_unauthorized(self, client):
        response = client.post('/api/projects/some-id/pages', json={
            'order_index': 0
        })
        assert response.status_code == 401


class TestDeletePage:
    """页面删除测试"""

    def test_delete_page_success(self, authenticated_client):
        project_id, pages = _create_project_with_pages(authenticated_client)
        if not project_id or not pages:
            pytest.skip("项目创建失败")

        page_id = pages[0]['page_id']
        response = authenticated_client.delete(
            f'/api/projects/{project_id}/pages/{page_id}'
        )
        assert_success_response(response)

    def test_delete_page_not_found(self, authenticated_client):
        project_id, _ = _create_project_with_pages(authenticated_client)
        if not project_id:
            pytest.skip("项目创建失败")

        response = authenticated_client.delete(
            f'/api/projects/{project_id}/pages/nonexistent-page-id'
        )
        assert response.status_code == 404

    def test_delete_page_wrong_project(self, authenticated_client):
        """删除不属于该项目的页面"""
        project_id1, pages1 = _create_project_with_pages(authenticated_client)
        project_id2, pages2 = _create_project_with_pages(authenticated_client)
        if not pages1 or not pages2:
            pytest.skip("项目创建失败")

        # Try to delete page from project1 using project2's URL
        response = authenticated_client.delete(
            f'/api/projects/{project_id2}/pages/{pages1[0]["page_id"]}'
        )
        assert response.status_code == 404


class TestUpdatePage:
    """页面更新测试"""

    def test_update_page_part(self, authenticated_client):
        project_id, pages = _create_project_with_pages(authenticated_client)
        if not project_id or not pages:
            pytest.skip("项目创建失败")

        page_id = pages[0]['page_id']
        response = authenticated_client.put(
            f'/api/projects/{project_id}/pages/{page_id}',
            json={'part': '第一章'}
        )
        data = assert_success_response(response)
        assert data['data']['part'] == '第一章'

    def test_update_page_no_body(self, authenticated_client):
        project_id, pages = _create_project_with_pages(authenticated_client)
        if not project_id or not pages:
            pytest.skip("项目创建失败")

        page_id = pages[0]['page_id']
        response = authenticated_client.put(
            f'/api/projects/{project_id}/pages/{page_id}',
            content_type='application/json',
            data='null'
        )
        assert response.status_code == 400

    def test_update_page_not_found(self, authenticated_client):
        project_id, _ = _create_project_with_pages(authenticated_client)
        if not project_id:
            pytest.skip("项目创建失败")

        response = authenticated_client.put(
            f'/api/projects/{project_id}/pages/nonexistent',
            json={'part': 'test'}
        )
        assert response.status_code == 404


class TestUpdatePageOutline:
    """页面大纲更新测试"""

    def test_update_outline_success(self, authenticated_client):
        project_id, pages = _create_project_with_pages(authenticated_client)
        if not project_id or not pages:
            pytest.skip("项目创建失败")

        page_id = pages[0]['page_id']
        new_outline = {'title': '更新后的标题', 'points': ['新要点1', '新要点2']}
        response = authenticated_client.put(
            f'/api/projects/{project_id}/pages/{page_id}/outline',
            json={'outline_content': new_outline}
        )
        data = assert_success_response(response)

    def test_update_outline_missing_content(self, authenticated_client):
        project_id, pages = _create_project_with_pages(authenticated_client)
        if not project_id or not pages:
            pytest.skip("项目创建失败")

        page_id = pages[0]['page_id']
        response = authenticated_client.put(
            f'/api/projects/{project_id}/pages/{page_id}/outline',
            json={}
        )
        assert response.status_code == 400


class TestUpdatePageDescription:
    """页面描述更新测试"""

    def test_update_description_success(self, authenticated_client):
        project_id, pages = _create_project_with_pages(authenticated_client)
        if not project_id or not pages:
            pytest.skip("项目创建失败")

        page_id = pages[0]['page_id']
        response = authenticated_client.put(
            f'/api/projects/{project_id}/pages/{page_id}/description',
            json={
                'description_content': {
                    'text': '这是页面描述',
                    'generated_at': '2024-01-01T00:00:00'
                }
            }
        )
        data = assert_success_response(response)

    def test_update_description_missing_content(self, authenticated_client):
        project_id, pages = _create_project_with_pages(authenticated_client)
        if not project_id or not pages:
            pytest.skip("项目创建失败")

        page_id = pages[0]['page_id']
        response = authenticated_client.put(
            f'/api/projects/{project_id}/pages/{page_id}/description',
            json={}
        )
        assert response.status_code == 400


class TestGetPageImageVersions:
    """页面图片版本测试"""

    def test_get_versions_empty(self, authenticated_client):
        project_id, pages = _create_project_with_pages(authenticated_client)
        if not project_id or not pages:
            pytest.skip("项目创建失败")

        page_id = pages[0]['page_id']
        response = authenticated_client.get(
            f'/api/projects/{project_id}/pages/{page_id}/image-versions'
        )
        data = assert_success_response(response)
        assert data['data']['versions'] == []

    def test_get_versions_not_found(self, authenticated_client):
        project_id, _ = _create_project_with_pages(authenticated_client)
        if not project_id:
            pytest.skip("项目创建失败")

        response = authenticated_client.get(
            f'/api/projects/{project_id}/pages/nonexistent/image-versions'
        )
        assert response.status_code == 404
