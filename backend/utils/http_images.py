"""Safe helpers for downloading remote images."""
import io
import ipaddress
import logging
import os
import socket
from urllib.parse import urlparse

import requests
from PIL import Image

logger = logging.getLogger(__name__)

MAX_REMOTE_IMAGE_BYTES = int(os.getenv("MAX_REMOTE_IMAGE_BYTES", str(20 * 1024 * 1024)))


def _host_resolves_to_public_ips(hostname: str, port: int) -> bool:
    try:
        addr_infos = socket.getaddrinfo(hostname, port)
    except socket.gaierror:
        return False

    if not addr_infos:
        return False

    for info in addr_infos:
        sockaddr = info[4]
        try:
            ip = ipaddress.ip_address(sockaddr[0])
        except ValueError:
            return False
        if (
            ip.is_private
            or ip.is_loopback
            or ip.is_link_local
            or ip.is_multicast
            or ip.is_reserved
            or ip.is_unspecified
        ):
            return False
    return True


def assert_safe_remote_image_url(raw_url: str) -> str:
    parsed = urlparse((raw_url or "").strip())
    if parsed.scheme != "https":
        raise ValueError("Only https image URLs are allowed")
    if not parsed.hostname:
        raise ValueError("Image URL must include a hostname")
    if parsed.username or parsed.password:
        raise ValueError("Image URL credentials are not allowed")

    port = parsed.port or 443
    if not _host_resolves_to_public_ips(parsed.hostname, port):
        raise ValueError("Image URL host is not public")

    return raw_url.strip()


def download_remote_image(raw_url: str, *, timeout: tuple[int, int] = (5, 30)) -> Image.Image:
    url = assert_safe_remote_image_url(raw_url)
    logger.debug("Downloading remote image from validated URL host: %s", urlparse(url).hostname)

    with requests.get(url, timeout=timeout, stream=True, allow_redirects=False) as response:
        if 300 <= response.status_code < 400:
            raise ValueError("Image URL redirects are not allowed")
        response.raise_for_status()

        content_length = response.headers.get("content-length")
        if content_length:
            try:
                parsed_content_length = int(content_length)
            except ValueError:
                raise ValueError("Remote image has invalid content length")
            if parsed_content_length > MAX_REMOTE_IMAGE_BYTES:
                raise ValueError("Remote image is too large")

        content_type = response.headers.get("content-type", "").split(";", 1)[0].lower()
        if content_type and content_type not in {"application/octet-stream"} and not content_type.startswith("image/"):
            raise ValueError("Remote URL did not return image content")

        data = bytearray()
        for chunk in response.iter_content(chunk_size=8192):
            if not chunk:
                continue
            data.extend(chunk)
            if len(data) > MAX_REMOTE_IMAGE_BYTES:
                raise ValueError("Remote image is too large")

    image_bytes = bytes(data)
    with Image.open(io.BytesIO(image_bytes)) as image:
        image.verify()

    with Image.open(io.BytesIO(image_bytes)) as image:
        return image.copy()
