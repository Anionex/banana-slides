"""
Export controller API unit tests
"""
import pytest
from conftest import assert_success_response


def _create_project_with_pages(authenticated_client):
    """Helper: create a project and add pages via API"""
    resp = authenticated_client.post('/api/projects', json={
        'creation_type': 'outline',
        'outline_text': '第一页: 要点1\n第二页: 要点2'
    })
    data = resp.get_json()
    if not data.get('success'):
        return None, []
    project_id = data['data']['project_id']

    pages = []
    for i, title in enumerate(['第一页', '第二页']):
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


class TestExportPptx:
    """PPTX导出测试"""

    def test_export_pptx_no_images(self, authenticated_client):
        """无生成图片时应返回错误"""
        project_id, _ = _create_project_with_pages(authenticated_client)
        if not project_id:
            pytest.skip("项目创建失败")

        response = authenticated_client.get(f'/api/projects/{project_id}/export/pptx')
        assert response.status_code == 400

    def test_export_pptx_project_not_found(self, authenticated_client):
        response = authenticated_client.get('/api/projects/nonexistent/export/pptx')
        assert response.status_code == 404

    def test_export_pptx_unauthorized(self, client):
        response = client.get('/api/projects/some-id/export/pptx')
        assert response.status_code == 401


class TestExportPdf:
    """PDF导出测试"""

    def test_export_pdf_no_images(self, authenticated_client):
        """无生成图片时应返回错误"""
        project_id, _ = _create_project_with_pages(authenticated_client)
        if not project_id:
            pytest.skip("项目创建失败")

        response = authenticated_client.get(f'/api/projects/{project_id}/export/pdf')
        assert response.status_code == 400

    def test_export_pdf_project_not_found(self, authenticated_client):
        response = authenticated_client.get('/api/projects/nonexistent/export/pdf')
        assert response.status_code == 404

    def test_export_pdf_unauthorized(self, client):
        response = client.get('/api/projects/some-id/export/pdf')
        assert response.status_code == 401


class TestExportEditablePptx:
    """可编辑PPTX导出测试"""

    def test_export_editable_no_images(self, authenticated_client):
        """无生成图片时应返回错误"""
        project_id, _ = _create_project_with_pages(authenticated_client)
        if not project_id:
            pytest.skip("项目创建失败")

        response = authenticated_client.post(
            f'/api/projects/{project_id}/export/editable-pptx',
            json={}
        )
        assert response.status_code == 400

    def test_export_editable_project_not_found(self, authenticated_client):
        response = authenticated_client.post(
            '/api/projects/nonexistent/export/editable-pptx',
            json={}
        )
        assert response.status_code == 404

    def test_export_editable_invalid_max_depth(self, authenticated_client):
        """无效的max_depth参数"""
        project_id, _ = _create_project_with_pages(authenticated_client)
        if not project_id:
            pytest.skip("项目创建失败")

        response = authenticated_client.post(
            f'/api/projects/{project_id}/export/editable-pptx',
            json={'max_depth': 10}  # max is 5
        )
        assert response.status_code == 400

    def test_export_editable_invalid_max_workers(self, authenticated_client):
        """无效的max_workers参数"""
        project_id, _ = _create_project_with_pages(authenticated_client)
        if not project_id:
            pytest.skip("项目创建失败")

        response = authenticated_client.post(
            f'/api/projects/{project_id}/export/editable-pptx',
            json={'max_workers': 100}  # max is 16
        )
        assert response.status_code == 400

    def test_export_editable_unauthorized(self, client):
        response = client.post(
            '/api/projects/some-id/export/editable-pptx',
            json={}
        )
        assert response.status_code == 401
