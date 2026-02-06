"""
Page utilities unit tests
"""
import pytest
from unittest.mock import MagicMock, patch


class TestParsePageIdsFromQuery:
    """查询参数解析测试"""

    def test_parse_comma_separated(self, app):
        from utils.page_utils import parse_page_ids_from_query
        with app.test_request_context('/?page_ids=id1,id2,id3'):
            from flask import request
            result = parse_page_ids_from_query(request)
            assert result == ['id1', 'id2', 'id3']

    def test_parse_single_id(self, app):
        from utils.page_utils import parse_page_ids_from_query
        with app.test_request_context('/?page_ids=single'):
            from flask import request
            result = parse_page_ids_from_query(request)
            assert result == ['single']

    def test_parse_empty(self, app):
        from utils.page_utils import parse_page_ids_from_query
        with app.test_request_context('/'):
            from flask import request
            result = parse_page_ids_from_query(request)
            assert result == []

    def test_parse_empty_string(self, app):
        from utils.page_utils import parse_page_ids_from_query
        with app.test_request_context('/?page_ids='):
            from flask import request
            result = parse_page_ids_from_query(request)
            assert result == []

    def test_parse_with_spaces(self, app):
        from utils.page_utils import parse_page_ids_from_query
        with app.test_request_context('/?page_ids=id1, id2 , id3'):
            from flask import request
            result = parse_page_ids_from_query(request)
            assert result == ['id1', 'id2', 'id3']

    def test_parse_with_empty_segments(self, app):
        from utils.page_utils import parse_page_ids_from_query
        with app.test_request_context('/?page_ids=id1,,id2,'):
            from flask import request
            result = parse_page_ids_from_query(request)
            assert result == ['id1', 'id2']


class TestParsePageIdsFromBody:
    """请求体解析测试"""

    def test_parse_list(self):
        from utils.page_utils import parse_page_ids_from_body
        result = parse_page_ids_from_body({'page_ids': ['id1', 'id2']})
        assert result == ['id1', 'id2']

    def test_parse_empty_list(self):
        from utils.page_utils import parse_page_ids_from_body
        result = parse_page_ids_from_body({'page_ids': []})
        assert result == []

    def test_parse_missing_key(self):
        from utils.page_utils import parse_page_ids_from_body
        result = parse_page_ids_from_body({})
        assert result == []

    def test_parse_non_list_value(self):
        from utils.page_utils import parse_page_ids_from_body
        result = parse_page_ids_from_body({'page_ids': 'not-a-list'})
        assert result == []

    def test_parse_none_value(self):
        from utils.page_utils import parse_page_ids_from_body
        result = parse_page_ids_from_body({'page_ids': None})
        assert result == []
