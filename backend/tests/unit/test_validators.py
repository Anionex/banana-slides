"""
Validators utility unit tests
"""
import pytest


class TestValidateProjectStatus:
    """项目状态验证测试"""

    def test_valid_statuses(self):
        from utils.validators import validate_project_status
        for status in ['DRAFT', 'OUTLINE_GENERATED', 'DESCRIPTIONS_GENERATED',
                        'GENERATING_IMAGES', 'COMPLETED']:
            assert validate_project_status(status) is True

    def test_invalid_status(self):
        from utils.validators import validate_project_status
        assert validate_project_status('INVALID') is False
        assert validate_project_status('') is False
        assert validate_project_status('draft') is False  # case-sensitive


class TestValidatePageStatus:
    """页面状态验证测试"""

    def test_valid_statuses(self):
        from utils.validators import validate_page_status
        for status in ['DRAFT', 'DESCRIPTION_GENERATED', 'GENERATING',
                        'COMPLETED', 'FAILED']:
            assert validate_page_status(status) is True

    def test_invalid_status(self):
        from utils.validators import validate_page_status
        assert validate_page_status('UNKNOWN') is False
        assert validate_page_status('completed') is False


class TestValidateTaskStatus:
    """任务状态验证测试"""

    def test_valid_statuses(self):
        from utils.validators import validate_task_status
        for status in ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED']:
            assert validate_task_status(status) is True

    def test_invalid_status(self):
        from utils.validators import validate_task_status
        assert validate_task_status('RUNNING') is False
        assert validate_task_status('') is False


class TestValidateTaskType:
    """任务类型验证测试"""

    def test_valid_types(self):
        from utils.validators import validate_task_type
        for t in ['GENERATE_DESCRIPTIONS', 'GENERATE_IMAGES', 'EXPORT_EDITABLE_PPTX']:
            assert validate_task_type(t) is True

    def test_invalid_type(self):
        from utils.validators import validate_task_type
        assert validate_task_type('UNKNOWN') is False


class TestAllowedFile:
    """文件扩展名验证测试"""

    def test_allowed_extensions(self):
        from utils.validators import allowed_file
        extensions = {'pdf', 'docx', 'md'}
        assert allowed_file('test.pdf', extensions) is True
        assert allowed_file('test.docx', extensions) is True
        assert allowed_file('test.MD', extensions) is True  # case-insensitive

    def test_disallowed_extensions(self):
        from utils.validators import allowed_file
        extensions = {'pdf', 'docx'}
        assert allowed_file('test.exe', extensions) is False
        assert allowed_file('test.sh', extensions) is False

    def test_no_extension(self):
        from utils.validators import allowed_file
        assert allowed_file('noextension', {'pdf'}) is False

    def test_empty_filename(self):
        from utils.validators import allowed_file
        assert allowed_file('', {'pdf'}) is False

    def test_double_extension(self):
        from utils.validators import allowed_file
        assert allowed_file('test.tar.gz', {'gz'}) is True
        assert allowed_file('test.tar.gz', {'tar'}) is False


class TestIsDisposableEmail:
    """临时邮箱检测测试"""

    def test_disposable_emails(self):
        from utils.validators import is_disposable_email
        assert is_disposable_email('user@mailinator.com') is True
        assert is_disposable_email('user@guerrillamail.com') is True
        assert is_disposable_email('user@tempmail.com') is True
        assert is_disposable_email('USER@YOPMAIL.COM') is True  # case-insensitive

    def test_normal_emails(self):
        from utils.validators import is_disposable_email
        assert is_disposable_email('user@gmail.com') is False
        assert is_disposable_email('user@outlook.com') is False
        assert is_disposable_email('user@company.cn') is False

    def test_edge_cases(self):
        from utils.validators import is_disposable_email
        # No @ sign - rsplit('@',1)[-1] returns the whole string
        assert is_disposable_email('noemail') is False
        # Email with internal space still matches after strip
        assert is_disposable_email('user@ mailinator.com ') is True
