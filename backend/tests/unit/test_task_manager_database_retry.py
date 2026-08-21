from sqlalchemy.exc import OperationalError

from services.task_manager import _is_retryable_database_conflict


class DatabaseError(Exception):
    pass


def operational_error(code, message):
    return OperationalError('statement', {}, DatabaseError(code, message))


def test_mysql_deadlock_and_lock_timeout_are_retryable():
    assert _is_retryable_database_conflict(operational_error(1213, 'deadlock'))
    assert _is_retryable_database_conflict(operational_error(1205, 'lock wait timeout'))


def test_sqlite_lock_is_retryable_but_other_database_errors_are_not():
    assert _is_retryable_database_conflict(operational_error(None, 'database is locked'))
    assert not _is_retryable_database_conflict(operational_error(1062, 'duplicate key'))
