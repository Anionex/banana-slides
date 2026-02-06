"""
Rate limiter unit tests
"""
import pytest
import time
import os
from unittest.mock import patch


class TestRateLimiterInternal:
    """速率限制器内部函数测试"""

    def setup_method(self):
        """每个测试前清理存储"""
        # Need to import after sys.path is set up by conftest
        from utils.rate_limiter import clear_rate_limit_storage
        clear_rate_limit_storage()

    def test_is_rate_limited_under_limit(self):
        from utils.rate_limiter import _is_rate_limited
        # 5 requests in 60s window
        for _ in range(4):
            assert _is_rate_limited('test', 'client1', 5, 60) is False

    def test_is_rate_limited_at_limit(self):
        from utils.rate_limiter import _is_rate_limited
        # Exactly at limit
        for _ in range(5):
            _is_rate_limited('test2', 'client1', 5, 60)
        assert _is_rate_limited('test2', 'client1', 5, 60) is True

    def test_is_rate_limited_different_clients(self):
        from utils.rate_limiter import _is_rate_limited
        # Different clients have separate counters
        for _ in range(5):
            _is_rate_limited('test3', 'client1', 5, 60)
        assert _is_rate_limited('test3', 'client1', 5, 60) is True
        assert _is_rate_limited('test3', 'client2', 5, 60) is False

    def test_is_rate_limited_different_keys(self):
        from utils.rate_limiter import _is_rate_limited
        # Different limiter keys have separate counters
        for _ in range(5):
            _is_rate_limited('endpoint1', 'client1', 5, 60)
        assert _is_rate_limited('endpoint1', 'client1', 5, 60) is True
        assert _is_rate_limited('endpoint2', 'client1', 5, 60) is False

    def test_is_rate_limited_window_expiry(self):
        from utils.rate_limiter import _is_rate_limited
        # Use a very short window
        for _ in range(3):
            _is_rate_limited('test4', 'client1', 3, 0.1)
        assert _is_rate_limited('test4', 'client1', 3, 0.1) is True
        # Wait for window to expire
        time.sleep(0.15)
        assert _is_rate_limited('test4', 'client1', 3, 0.1) is False

    def test_clear_storage(self):
        from utils.rate_limiter import _is_rate_limited, clear_rate_limit_storage
        for _ in range(5):
            _is_rate_limited('test5', 'client1', 5, 60)
        assert _is_rate_limited('test5', 'client1', 5, 60) is True
        clear_rate_limit_storage()
        assert _is_rate_limited('test5', 'client1', 5, 60) is False


class TestRateLimitDecorator:
    """速率限制装饰器测试"""

    def test_decorator_skips_in_testing_mode(self, app):
        """测试模式下应跳过速率限制"""
        from utils.rate_limiter import rate_limit

        @rate_limit(max_requests=1, window_seconds=60)
        def test_func():
            return "ok"

        with app.test_request_context():
            # In testing mode, should always pass
            assert test_func() == "ok"
            assert test_func() == "ok"
            assert test_func() == "ok"

    def test_decorator_enforces_in_non_testing_mode(self, app):
        """非测试模式下应强制执行速率限制"""
        from utils.rate_limiter import rate_limit, clear_rate_limit_storage
        clear_rate_limit_storage()

        @rate_limit(max_requests=2, window_seconds=60)
        def limited_func():
            return "ok"

        with app.test_request_context(environ_base={'REMOTE_ADDR': '1.2.3.4'}):
            with patch.dict(os.environ, {'TESTING': 'false'}):
                assert limited_func() == "ok"
                assert limited_func() == "ok"
                # Third call should be rate limited
                result = limited_func()
                # Result should be a tuple (response, status_code)
                assert isinstance(result, tuple)
                assert result[1] == 429

    def test_decorator_with_custom_key_func(self, app):
        """测试自定义key函数"""
        from utils.rate_limiter import rate_limit, clear_rate_limit_storage
        clear_rate_limit_storage()

        custom_key = lambda req: "fixed-key"

        @rate_limit(max_requests=1, window_seconds=60, key_func=custom_key)
        def keyed_func():
            return "ok"

        with app.test_request_context():
            with patch.dict(os.environ, {'TESTING': 'false'}):
                assert keyed_func() == "ok"
                result = keyed_func()
                assert isinstance(result, tuple)
                assert result[1] == 429
