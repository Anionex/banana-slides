"""Real local HTTP sockets prove stalled SDK calls finish before the SSE deadline."""
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import pytest

from services.ai_providers.text.genai_provider import GenAITextProvider
from services.ai_providers.text.openai_provider import OpenAITextProvider
from services.ai_providers.text.anthropic_provider import AnthropicTextProvider
from utils.sse import with_heartbeat


@pytest.mark.parametrize('provider_type', [GenAITextProvider, OpenAITextProvider, AnthropicTextProvider])
def test_blocked_sdk_request_finishes_before_heartbeat_deadline(provider_type):
    release = threading.Event()
    closed = threading.Event()
    requests = []

    class Handler(BaseHTTPRequestHandler):
        def do_POST(self):
            requests.append(self.path)
            self.rfile.read(int(self.headers.get('Content-Length', '0')))
            release.wait(3)  # The SDK must time out without receiving even headers.

        def log_message(self, *_args):
            pass

    server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    provider = provider_type(api_key='test-only', api_base=f'http://127.0.0.1:{server.server_port}',
                             model='gemini-3-flash-preview')
    # Warm SDK lazy imports outside the shortened network-timeout measurement.
    if provider_type is OpenAITextProvider:
        assert provider.client.chat.completions
    original_timeout = provider.request_timeout_seconds

    def generate(stopped):
        try:
            yield from provider.generate_text_stream('Hello')
        except Exception:
            yield 'event: error\ndata: {"message":"provider timed out"}\n\n'
        finally:
            closed.set()

    try:
        start = time.monotonic()
        result = ''.join(with_heartbeat(generate, interval=0.05, idle_timeout=2))
        assert closed.wait(0.1), 'Producer remains blocked after SSE response ends'
        assert time.monotonic() - start < 2
        assert 'provider timed out' in result
        assert len(requests) == 1, 'Retries must not outlive the SSE deadline'
        assert provider.request_timeout_seconds == original_timeout
    finally:
        release.set()
        provider.client.close()
        server.shutdown()
        server.server_close()
        thread.join(timeout=1)
