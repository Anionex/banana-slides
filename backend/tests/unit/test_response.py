"""
Response utilities unit tests
"""
import pytest


class TestSuccessResponse:
    """成功响应测试"""

    def test_default_success_response(self, app):
        from utils.response import success_response
        with app.test_request_context():
            response, status = success_response()
            data = response.get_json()
            assert status == 200
            assert data['success'] is True
            assert data['message'] == 'Success'

    def test_success_with_data(self, app):
        from utils.response import success_response
        with app.test_request_context():
            response, status = success_response(data={'key': 'value'})
            data = response.get_json()
            assert data['data'] == {'key': 'value'}

    def test_success_with_custom_message(self, app):
        from utils.response import success_response
        with app.test_request_context():
            response, status = success_response(message='Created')
            data = response.get_json()
            assert data['message'] == 'Created'

    def test_success_with_custom_status(self, app):
        from utils.response import success_response
        with app.test_request_context():
            _, status = success_response(status_code=201)
            assert status == 201

    def test_success_no_data_key_when_none(self, app):
        from utils.response import success_response
        with app.test_request_context():
            response, _ = success_response()
            data = response.get_json()
            assert 'data' not in data


class TestErrorResponse:
    """错误响应测试"""

    def test_default_error_response(self, app):
        from utils.response import error_response
        with app.test_request_context():
            response, status = error_response('TEST_ERROR', 'Something went wrong')
            data = response.get_json()
            assert status == 400
            assert data['success'] is False
            assert data['error']['code'] == 'TEST_ERROR'
            assert data['error']['message'] == 'Something went wrong'

    def test_error_with_custom_status(self, app):
        from utils.response import error_response
        with app.test_request_context():
            _, status = error_response('NOT_FOUND', 'Not found', 404)
            assert status == 404


class TestCommonErrors:
    """常用错误响应测试"""

    def test_bad_request(self, app):
        from utils.response import bad_request
        with app.test_request_context():
            _, status = bad_request()
            assert status == 400

    def test_bad_request_custom_message(self, app):
        from utils.response import bad_request
        with app.test_request_context():
            response, _ = bad_request('Custom error')
            data = response.get_json()
            assert data['error']['message'] == 'Custom error'

    def test_not_found(self, app):
        from utils.response import not_found
        with app.test_request_context():
            response, status = not_found('Project')
            assert status == 404
            data = response.get_json()
            assert data['error']['code'] == 'PROJECT_NOT_FOUND'

    def test_not_found_default(self, app):
        from utils.response import not_found
        with app.test_request_context():
            response, status = not_found()
            data = response.get_json()
            assert data['error']['code'] == 'RESOURCE_NOT_FOUND'

    def test_invalid_status(self, app):
        from utils.response import invalid_status
        with app.test_request_context():
            _, status = invalid_status()
            assert status == 400

    def test_ai_service_error(self, app):
        from utils.response import ai_service_error
        with app.test_request_context():
            _, status = ai_service_error()
            assert status == 503

    def test_rate_limit_error(self, app):
        from utils.response import rate_limit_error
        with app.test_request_context():
            _, status = rate_limit_error()
            assert status == 429
