"""Safe user-facing classification for AI provider failures."""


def safe_generation_error_message(error: Exception) -> str:
    """Return an actionable provider error without exposing provider details."""
    message = str(error).lower()

    if any(token in message for token in (
        'api key not valid', 'invalid api key', 'api_key_invalid',
        'invalid_api_key', 'incorrect api key', 'unauthorized',
        'authentication failed', 'authentication_error',
    )):
        return 'API key is invalid'
    if any(token in message for token in (
        'insufficient balance', 'balance is insufficient', 'insufficient_quota',
        'quota exceeded', 'quota exhausted', 'usage limit', 'credits exhausted',
    )):
        return 'API quota or balance is insufficient'
    if any(token in message for token in (
        'permission denied', 'permission_denied', 'forbidden', 'access denied',
    )):
        return 'API permission denied'
    if any(token in message for token in (
        'rate limit', 'rate_limit_exceeded', 'too many requests',
        'resource_exhausted', 'resource exhausted',
    )):
        return 'API rate limit exceeded'
    if any(token in message for token in (
        'model not found', 'model does not exist', 'invalid model',
        'not found for api version', 'not supported for generatecontent',
    )):
        return 'Configured AI model is unavailable'
    if any(token in message for token in (
        'connection refused', 'failed to establish a new connection',
        'name or service not known', 'nodename nor servname provided',
    )):
        return 'AI service connection failed; check API base URL'

    return '生成过程中发生内部错误'
