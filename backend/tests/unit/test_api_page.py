"""
页面管理API单元测试
"""

import pytest

from conftest import assert_success_response


class TestPageCreate:
    """页面创建测试"""

    def test_create_page_inherits_part_from_previous_page(self, client, sample_project):
        """创建页面时，未提供part则继承上一页的part"""
        if not sample_project:
            pytest.skip("项目创建失败")

        project_id = sample_project["project_id"]

        # Create first page with part
        response = client.post(
            f"/api/projects/{project_id}/pages",
            json={
                "order_index": 0,
                "part": "第一部分",
                "outline_content": {"title": "第一页", "points": ["要点1"]},
            },
        )
        data = assert_success_response(response, 201)
        assert data["data"]["order_index"] == 0
        assert data["data"]["part"] == "第一部分"

        # Create second page without part (should inherit)
        response = client.post(
            f"/api/projects/{project_id}/pages",
            json={
                "order_index": 1,
                "outline_content": {"title": "第二页", "points": ["要点2"]},
            },
        )
        data = assert_success_response(response, 201)
        assert data["data"]["order_index"] == 1
        assert data["data"]["part"] == "第一部分"

    def test_create_page_inherits_part_with_order_index_gap(self, client, sample_project):
        """创建页面时，存在index gap时继承最近上一页的part"""
        if not sample_project:
            pytest.skip("项目创建失败")

        project_id = sample_project["project_id"]

        # Create first page with part
        response = client.post(
            f"/api/projects/{project_id}/pages",
            json={
                "order_index": 0,
                "part": "第一部分",
                "outline_content": {"title": "第一页", "points": ["要点1"]},
            },
        )
        data = assert_success_response(response, 201)
        assert data["data"]["order_index"] == 0
        assert data["data"]["part"] == "第一部分"

        # Create page at index=2 (gap at 1) without part (should inherit)
        response = client.post(
            f"/api/projects/{project_id}/pages",
            json={
                "order_index": 2,
                "outline_content": {"title": "第三页", "points": ["要点3"]},
            },
        )
        data = assert_success_response(response, 201)
        assert data["data"]["order_index"] == 2
        assert data["data"]["part"] == "第一部分"

    def test_create_page_at_index_zero_without_previous_keeps_part_null(self, client, sample_project):
        """index=0 且未提供part时，part保持为空"""
        if not sample_project:
            pytest.skip("项目创建失败")

        project_id = sample_project["project_id"]

        response = client.post(
            f"/api/projects/{project_id}/pages",
            json={
                "order_index": 0,
                "outline_content": {"title": "第一页", "points": ["要点1"]},
            },
        )
        data = assert_success_response(response, 201)
        assert data["data"]["order_index"] == 0
        assert data["data"]["part"] is None
