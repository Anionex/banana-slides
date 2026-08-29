"""Safe user-facing classification for AI provider failures."""


_SAFE_ERROR_PRIORITY = {
    'API key is invalid': 0,
    'API quota or balance is insufficient': 1,
    'API permission denied': 2,
    'API rate limit exceeded': 3,
    'Configured AI model is unavailable': 4,
    'AI service connection failed; check API base URL': 5,
    'Generation failed due to an internal error': 6,
}


def safe_generation_error_message(error: Exception) -> str:
    """Return an actionable provider error without exposing provider details."""
    message = str(error).lower()

    if (
        any(token in message for token in (
            'api key not valid', 'invalid api key', 'api_key_invalid',
            'invalid_api_key', 'incorrect api key', 'unauthorized',
            'authentication failed', 'authentication_error', 'api key is required',
            'oauth is not connected',
        ))
        or ('api_key' in message and 'is required' in message)
    ):
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

    return 'Generation failed due to an internal error'


def prioritized_generation_error_message(errors) -> str:
    """Choose the most actionable safe message from a batch of failures."""
    messages = [safe_generation_error_message(RuntimeError(error)) for error in errors if error]
    if not messages:
        return 'Generation failed due to an internal error'
    return min(messages, key=lambda message: _SAFE_ERROR_PRIORITY.get(message, 99))
