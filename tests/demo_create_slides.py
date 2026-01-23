#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Banana Slides - Demo Script: Create Slides from TXT File
=========================================================
Demo entire workflow from outline TXT to PPT.

Usage:
    python tests/demo_create_slides.py
    python tests/demo_create_slides.py --outline tests/demo-outline.txt
    python tests/demo_create_slides.py --generate-images  # Create images (uses API credits)
"""

import argparse
import json
import sys
import time
import io
from pathlib import Path

# Fix Windows console encoding
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

try:
    import requests
except ImportError:
    print("ERROR: Need to install 'requests'. Run: pip install requests")
    sys.exit(1)


BASE_URL = "http://localhost:5000"
TIMEOUT = 120


class Colors:
    GREEN = "\033[92m"
    RED = "\033[91m"
    YELLOW = "\033[93m"
    BLUE = "\033[94m"
    CYAN = "\033[96m"
    RESET = "\033[0m"
    BOLD = "\033[1m"


def colored(text: str, color: str) -> str:
    return f"{color}{text}{Colors.RESET}"


def step(num: int, title: str):
    print(f"\n{colored(f'[STEP {num}]', Colors.YELLOW)} {colored(title, Colors.BOLD)}")
    print("─" * 60)


def success(msg: str):
    print(f"  {colored('✓', Colors.GREEN)} {msg}")


def info(msg: str):
    print(f"  {colored('ℹ', Colors.CYAN)} {msg}")


def error(msg: str):
    print(f"  {colored('✗', Colors.RED)} {msg}")


def demo_workflow(outline_file: str = None, generate_images: bool = False):
    """Demo workflow tạo slide từ file outline"""

    print(colored("\n" + "=" * 60, Colors.BOLD))
    print(colored("  BANANA SLIDES - DEMO TẠO SLIDE TỪ FILE TXT", Colors.YELLOW))
    print(colored("=" * 60, Colors.BOLD))

    # =========================================================================
    # STEP 1: Đọc file outline
    # =========================================================================
    step(1, "Đọc file outline TXT")

    if outline_file:
        outline_path = Path(outline_file)
    else:
        outline_path = Path(__file__).parent / "demo-outline.txt"

    if not outline_path.exists():
        error(f"File không tồn tại: {outline_path}")
        return False

    outline_text = outline_path.read_text(encoding="utf-8")
    lines = outline_text.strip().split("\n")
    info(f"File: {outline_path.name}")
    info(f"Số dòng: {len(lines)}")

    # Hiển thị preview
    print(f"\n  {colored('Preview:', Colors.CYAN)}")
    for line in lines[:10]:
        print(f"    {line}")
    if len(lines) > 10:
        print(f"    ... ({len(lines) - 10} dòng nữa)")

    success("Đọc file thành công")

    # =========================================================================
    # STEP 2: Tạo Project từ Outline
    # =========================================================================
    step(2, "Tạo Project từ Outline")

    try:
        resp = requests.post(
            f"{BASE_URL}/api/projects",
            json={
                "creation_type": "outline",
                "outline_text": outline_text
            },
            timeout=TIMEOUT
        )

        if resp.status_code != 201:
            error(f"Tạo project thất bại: {resp.status_code}")
            error(resp.text[:500])
            return False

        data = resp.json()
        project_id = data["data"]["project_id"]

        success(f"Project ID: {project_id}")

    except requests.exceptions.ConnectionError:
        error("Cannot connect to server. Make sure backend is running!")
        return False

    # =========================================================================
    # STEP 3: Parse Outline into Pages (AI)
    # =========================================================================
    step(3, "Parse Outline into Pages (AI)")

    info("Calling AI to parse outline into structured pages...")
    info("(This may take 10-30 seconds)")

    start_time = time.time()

    resp = requests.post(
        f"{BASE_URL}/api/projects/{project_id}/generate/outline",
        json={},
        timeout=TIMEOUT
    )

    elapsed = time.time() - start_time

    if resp.status_code == 200:
        success(f"Parse outline successful ({elapsed:.1f}s)")
    else:
        error(f"Parse outline failed: {resp.status_code}")
        info("API key might not be configured correctly")
        # Continue anyway to show project info

    # =========================================================================
    # STEP 4: View Project Details
    # =========================================================================
    step(4, "View Project Details & Pages")

    resp = requests.get(f"{BASE_URL}/api/projects/{project_id}", timeout=TIMEOUT)
    project = resp.json()["data"]

    pages = project.get("pages", [])
    info(f"Tổng số slides: {len(pages)}")

    print(f"\n  {colored('Danh sách slides:', Colors.CYAN)}")
    page_ids = []
    for i, page in enumerate(pages, 1):
        page_id = page.get("id")
        title = page.get("outline_title", "Untitled")
        page_ids.append(page_id)
        print(f"    {i}. {title[:50]}...")

    success("Lấy thông tin project thành công")

    # =========================================================================
    # STEP 5: Generate Descriptions
    # =========================================================================
    step(5, "Generate Descriptions (AI creates detailed descriptions)")

    info("Đang gọi AI để tạo mô tả chi tiết cho từng slide...")
    info("(Bước này có thể mất 30-60 giây)")

    start_time = time.time()

    resp = requests.post(
        f"{BASE_URL}/api/projects/{project_id}/generate/descriptions",
        json={"page_ids": page_ids},
        timeout=300  # 5 phút cho batch
    )

    elapsed = time.time() - start_time

    if resp.status_code in [200, 202]:
        success(f"Generate descriptions started ({elapsed:.1f}s)")
        if resp.status_code == 202:
            info("Task running in background...")
            time.sleep(5)  # Wait a bit for task to complete

        # View descriptions
        resp = requests.get(f"{BASE_URL}/api/projects/{project_id}", timeout=TIMEOUT)
        project = resp.json()["data"]

        print(f"\n  {colored('Preview descriptions:', Colors.CYAN)}")
        for page in project.get("pages", [])[:3]:
            title = page.get("outline_title", "")
            desc = page.get("description", "")[:100]
            print(f"    - {title[:30]}: {desc}...")
    else:
        error(f"Generate descriptions thất bại: {resp.status_code}")
        info("Có thể API key chưa được cấu hình đúng")

    # =========================================================================
    # STEP 6: Generate Images (Optional)
    # =========================================================================
    if generate_images:
        step(6, "Generate Images (AI creates slide images)")

        info("⚠️  Bước này tốn API credits!")
        info("Đang tạo hình cho từng slide...")
        info("(Có thể mất 2-5 phút tùy số slides)")

        start_time = time.time()

        resp = requests.post(
            f"{BASE_URL}/api/projects/{project_id}/generate/images",
            json={"page_ids": page_ids[:3]},  # Chỉ generate 3 slides demo
            timeout=600  # 10 phút
        )

        elapsed = time.time() - start_time

        if resp.status_code == 200:
            success(f"Generate images thành công ({elapsed:.1f}s)")
            info("Hình đã được lưu, có thể xem trong Slide Preview")
        else:
            error(f"Generate images thất bại: {resp.status_code}")
    else:
        step(6, "Generate Images (SKIPPED)")
        info("Bỏ qua generate images (tốn API credits)")
        info("Chạy với --generate-images để tạo hình")

    # =========================================================================
    # SUMMARY
    # =========================================================================
    print(colored("\n" + "=" * 60, Colors.BOLD))
    print(colored("  HOÀN THÀNH DEMO!", Colors.GREEN))
    print(colored("=" * 60, Colors.BOLD))

    print(f"""
  {colored('Project ID:', Colors.CYAN)} {project_id}
  {colored('Số slides:', Colors.CYAN)} {len(pages)}

  {colored('Bước tiếp theo:', Colors.YELLOW)}
  1. Mở browser: http://localhost:3000
  2. Vào History → Tìm project vừa tạo
  3. Xem Outline Editor → Chỉnh sửa nếu cần
  4. Vào Slide Preview → Generate Images
  5. Export PPTX/PDF

  {colored('Hoặc dùng API:', Colors.YELLOW)}
  • Xem project: GET /api/projects/{project_id}
  • Generate images: POST /api/projects/{project_id}/generate/images
  • Export PPTX: GET /api/projects/{project_id}/export/pptx
""")

    return True


def main():
    parser = argparse.ArgumentParser(
        description="Demo tạo slide từ file TXT outline"
    )
    parser.add_argument(
        "--outline",
        default=None,
        help="Đường dẫn file outline TXT"
    )
    parser.add_argument(
        "--generate-images",
        action="store_true",
        help="Tạo hình cho slides (tốn API credits)"
    )

    args = parser.parse_args()

    try:
        success = demo_workflow(
            outline_file=args.outline,
            generate_images=args.generate_images
        )
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        print(colored("\n\nĐã hủy bởi người dùng", Colors.YELLOW))
        sys.exit(1)


if __name__ == "__main__":
    main()
