import selectors
import socket
import socketserver
import struct
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import pytest
import requests


class _HealthHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        body = b'{"status":"ok","transport":"socks5"}'
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format, *args):
        pass


def _read_exact(stream, size):
    data = bytearray()
    while len(data) < size:
        chunk = stream.recv(size - len(data))
        if not chunk:
            raise ConnectionError("SOCKS client closed the connection")
        data.extend(chunk)
    return bytes(data)


class _Socks5Handler(socketserver.BaseRequestHandler):
    def handle(self):
        version, method_count = _read_exact(self.request, 2)
        assert version == 5
        _read_exact(self.request, method_count)
        self.request.sendall(b"\x05\x00")

        version, command, _, address_type = _read_exact(self.request, 4)
        assert version == 5
        assert command == 1

        if address_type == 1:
            host = socket.inet_ntoa(_read_exact(self.request, 4))
        elif address_type == 3:
            host_length = _read_exact(self.request, 1)[0]
            host = _read_exact(self.request, host_length).decode("ascii")
        elif address_type == 4:
            host = socket.inet_ntop(
                socket.AF_INET6,
                _read_exact(self.request, 16),
            )
        else:
            raise ValueError(f"Unsupported SOCKS address type: {address_type}")

        port = struct.unpack("!H", _read_exact(self.request, 2))[0]
        with socket.create_connection((host, port), timeout=5) as upstream:
            self.request.sendall(b"\x05\x00\x00\x01\x00\x00\x00\x00\x00\x00")
            self._relay(self.request, upstream)

    @staticmethod
    def _relay(client, upstream):
        selector = selectors.DefaultSelector()
        selector.register(client, selectors.EVENT_READ, upstream)
        selector.register(upstream, selectors.EVENT_READ, client)
        try:
            while True:
                events = selector.select(timeout=5)
                if not events:
                    return
                for key, _ in events:
                    chunk = key.fileobj.recv(65536)
                    if not chunk:
                        return
                    key.data.sendall(chunk)
        finally:
            selector.close()


class _ThreadingSocksServer(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True


@pytest.mark.integration
def test_requests_can_reach_http_api_through_all_proxy(monkeypatch):
    http_server = ThreadingHTTPServer(("127.0.0.1", 0), _HealthHandler)
    socks_server = _ThreadingSocksServer(("127.0.0.1", 0), _Socks5Handler)
    threads = [
        threading.Thread(target=http_server.serve_forever, daemon=True),
        threading.Thread(target=socks_server.serve_forever, daemon=True),
    ]
    for thread in threads:
        thread.start()

    target_url = f"http://127.0.0.1:{http_server.server_port}/health"
    proxy_url = f"socks5h://127.0.0.1:{socks_server.server_address[1]}"
    for variable in (
        "HTTP_PROXY",
        "http_proxy",
        "HTTPS_PROXY",
        "https_proxy",
        "NO_PROXY",
        "no_proxy",
    ):
        monkeypatch.delenv(variable, raising=False)
    monkeypatch.setenv("ALL_PROXY", proxy_url)
    monkeypatch.setenv("all_proxy", proxy_url)

    session = requests.Session()
    try:
        response = session.get(target_url, timeout=5)
        response.raise_for_status()
        assert response.json() == {"status": "ok", "transport": "socks5"}
    finally:
        session.close()
        socks_server.shutdown()
        http_server.shutdown()
        socks_server.server_close()
        http_server.server_close()
        for thread in threads:
            thread.join(timeout=5)
