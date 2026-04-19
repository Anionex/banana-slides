from models import Page


class TestPageDesignContent:
    def test_get_design_content_with_valid_json(self):
        page = Page()
        page.set_design_content({
            "text": "布局方式：左右分栏",
            "generated_at": "2026-04-14T00:00:00"
        })

        assert page.get_design_content() == {
            "text": "布局方式：左右分栏",
            "generated_at": "2026-04-14T00:00:00"
        }

    def test_get_design_content_with_invalid_json(self):
        page = Page()
        page.design_content = "{invalid json"

        assert page.get_design_content() is None

    def test_get_design_content_with_null(self):
        page = Page()
        page.design_content = None

        assert page.get_design_content() is None
