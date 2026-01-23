#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Banana Slides - Create 46 Slides from JSON File
================================================
Script tạo slides từ file noidung43slide.txt (JSON format).

Usage:
    python tests/create_slides_from_json.py
    python tests/create_slides_from_json.py --generate-images
    python tests/create_slides_from_json.py --export-pptx
    python tests/create_slides_from_json.py --all  # Full workflow
"""

import argparse
import json
import sys
import time
import io
import re
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
LONG_TIMEOUT = 600


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


def warning(msg: str):
    print(f"  {colored('⚠', Colors.YELLOW)} {msg}")


def clean_json_content(content: str) -> str:
    """Clean JSON content by removing citation markers and fixing syntax"""
    # Remove [cite_start] markers
    content = re.sub(r'\[cite_start\]', '', content)

    # Remove [cite: xxx] patterns
    content = re.sub(r'\[cite:\s*[^\]]+\]', '', content)

    # Fix lines that have [cite_start] at the start making invalid JSON
    # Pattern: [cite_start]"key": -> "key":
    content = re.sub(r',\s*\n\s*"sources"', ',\n      "sources"', content)

    return content


def parse_json_file(file_path: Path) -> dict:
    """Parse file JSON có thể chứa nhiều JSON objects"""
    content = file_path.read_text(encoding='utf-8')

    # Clean the content first
    content = clean_json_content(content)

    # File có thể chứa 2 JSON objects liên tiếp
    # Tìm và merge chúng
    slides = []
    metadata = None

    # Tìm tất cả JSON objects trong file
    depth = 0
    start = -1
    objects = []

    for i, char in enumerate(content):
        if char == '{':
            if depth == 0:
                start = i
            depth += 1
        elif char == '}':
            depth -= 1
            if depth == 0 and start != -1:
                obj_str = content[start:i+1]
                try:
                    obj = json.loads(obj_str)
                    objects.append(obj)
                except json.JSONDecodeError:
                    pass
                start = -1

    # Merge slides từ các objects
    for obj in objects:
        if "presentationMetadata" in obj:
            metadata = obj["presentationMetadata"]
        if "slides" in obj:
            slides.extend(obj["slides"])

    return {
        "metadata": metadata,
        "slides": slides
    }


def convert_slide_to_description(slide: dict) -> str:
    """Chuyển đổi slide JSON thành description text chi tiết cho AI"""
    parts = []

    # Title và type
    title = slide.get("title", "")
    slide_type = slide.get("type", "")
    parts.append(f"**{title}** (Type: {slide_type})")

    # Session và section
    session = slide.get("session", "")
    section = slide.get("section", "")
    if session or section:
        parts.append(f"Session: {session}, Section: {section}")

    # Objective
    objective = slide.get("objective", "")
    if objective:
        parts.append(f"Objective: {objective}")

    # Bullets (main content)
    bullets = slide.get("bullets", [])
    if bullets:
        parts.append("Content:")
        for bullet in bullets:
            parts.append(f"• {bullet}")

    # Definition box
    def_box = slide.get("definitionBox")
    if def_box:
        parts.append(f"\n[DEFINITION BOX - {def_box.get('label', 'DEFINITION')}]")
        parts.append(def_box.get("text", ""))

    # Remember box
    rem_box = slide.get("rememberBox")
    if rem_box:
        parts.append(f"\n[REMEMBER BOX - {rem_box.get('label', 'GHI NHỚ')}]")
        for item in rem_box.get("items", []):
            parts.append(f"• {item}")

    # Visual description
    visual = slide.get("visual", {})
    if visual:
        parts.append(f"\n[VISUAL: {visual.get('kind', 'image')}]")
        parts.append(f"Description: {visual.get('description', '')}")
        if visual.get("altText"):
            parts.append(f"Alt: {visual.get('altText')}")

    # Style/Layout
    style = slide.get("style", {})
    if style:
        parts.append(f"\nLayout: {style.get('layout', 'default')}")

    # Key terms
    key_terms = slide.get("keyTerms", [])
    if key_terms:
        parts.append(f"\nKey terms: {', '.join(key_terms)}")

    # Overlays (watermark/author)
    overlays = slide.get("overlays", [])
    if overlays:
        for overlay in overlays:
            if overlay.get("type") == "text":
                parts.append(f"\nOverlay text: {overlay.get('text', '')} at {overlay.get('anchor', 'bottom_right')}")

    return "\n".join(parts)


def create_outline_from_json(data: dict) -> str:
    """Tạo outline text từ JSON data"""
    slides = data.get("slides", [])
    metadata = data.get("metadata", {})

    lines = []

    # Header
    if metadata:
        lines.append(f"# {metadata.get('title', 'Presentation')}")
        lines.append(f"Total slides: {metadata.get('totalSlides', len(slides))}")
        if metadata.get("designSystem"):
            ds = metadata["designSystem"]
            lines.append(f"Theme: {ds.get('theme', 'Default')}, Primary Color: {ds.get('primaryColor', '#2E5266')}")
        lines.append("")

    # Slides
    for slide in slides:
        num = slide.get("slideNumber", 0)
        title = slide.get("title", "Untitled")
        slide_type = slide.get("type", "")
        session = slide.get("session", "")

        # Format: "1. [session] Title - Type"
        line = f"{num}. [{session}] {title} - {slide_type}"
        lines.append(line)

    return "\n".join(lines)


def create_project_with_descriptions(data: dict):
    """Tạo project và thêm từng slide với descriptions"""
    slides = data.get("slides", [])
    metadata = data.get("metadata", {})

    # Tạo outline text
    outline_text = create_outline_from_json(data)

    step(1, "Tạo Project từ Outline")

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
            return None

        project_data = resp.json()
        project_id = project_data["data"]["project_id"]
        success(f"Project ID: {project_id}")

    except requests.exceptions.ConnectionError:
        error("Cannot connect to server. Make sure backend is running!")
        return None

    # Parse outline to create pages
    step(2, "Parse Outline thành Pages")

    info("Calling AI to parse outline...")
    resp = requests.post(
        f"{BASE_URL}/api/projects/{project_id}/generate/outline",
        json={},
        timeout=TIMEOUT
    )

    if resp.status_code == 200:
        success("Parse outline thành công")
    else:
        warning(f"Parse outline status: {resp.status_code}")

    # Get project và update descriptions
    step(3, "Lấy danh sách Pages")

    resp = requests.get(f"{BASE_URL}/api/projects/{project_id}", timeout=TIMEOUT)
    project = resp.json()["data"]
    pages = project.get("pages", [])

    info(f"Số pages hiện tại: {len(pages)}")

    # Nếu số pages khác số slides trong JSON, cần đồng bộ
    if len(pages) != len(slides):
        warning(f"Pages ({len(pages)}) != Slides trong JSON ({len(slides)})")
        info("Sẽ cập nhật descriptions cho các pages hiện có...")

    # Update descriptions cho từng page
    step(4, "Cập nhật Descriptions từ JSON")

    for i, page in enumerate(pages):
        page_id = page.get("id")

        # Tìm slide tương ứng trong JSON (theo index)
        if i < len(slides):
            slide = slides[i]
            description = convert_slide_to_description(slide)

            # Update page với description
            try:
                resp = requests.put(
                    f"{BASE_URL}/api/projects/{project_id}/pages/{page_id}",
                    json={"description": description},
                    timeout=TIMEOUT
                )

                if resp.status_code == 200:
                    print(f"  {colored('✓', Colors.GREEN)} Page {i+1}: {slide.get('title', '')[:40]}...")
                else:
                    print(f"  {colored('✗', Colors.RED)} Page {i+1}: Update failed ({resp.status_code})")
            except Exception as e:
                print(f"  {colored('✗', Colors.RED)} Page {i+1}: Error - {e}")

    success(f"Đã cập nhật {min(len(pages), len(slides))} descriptions")

    return project_id


def generate_descriptions_ai(project_id: str, page_ids: list):
    """Generate descriptions bằng AI (nếu cần)"""
    step(5, "Generate Descriptions bằng AI")

    info("Đang gọi AI để tạo mô tả chi tiết...")
    info("(Có thể mất 1-2 phút)")

    start_time = time.time()

    resp = requests.post(
        f"{BASE_URL}/api/projects/{project_id}/generate/descriptions",
        json={"page_ids": page_ids},
        timeout=LONG_TIMEOUT
    )

    elapsed = time.time() - start_time

    if resp.status_code in [200, 202]:
        success(f"Generate descriptions xong ({elapsed:.1f}s)")
        if resp.status_code == 202:
            info("Task đang chạy background...")
            time.sleep(10)  # Wait for completion
    else:
        warning(f"Generate descriptions status: {resp.status_code}")


def generate_images(project_id: str, page_ids: list, batch_size: int = 5):
    """Generate images cho slides theo batch"""
    step(6, "Generate Images")

    info(f"Sẽ generate {len(page_ids)} slides")
    info(f"Batch size: {batch_size}")
    info("⚠️  Bước này tốn API credits!")

    total_batches = (len(page_ids) + batch_size - 1) // batch_size

    for batch_num in range(total_batches):
        start_idx = batch_num * batch_size
        end_idx = min(start_idx + batch_size, len(page_ids))
        batch_ids = page_ids[start_idx:end_idx]

        info(f"Batch {batch_num + 1}/{total_batches}: Slides {start_idx + 1}-{end_idx}")

        start_time = time.time()

        resp = requests.post(
            f"{BASE_URL}/api/projects/{project_id}/generate/images",
            json={"page_ids": batch_ids},
            timeout=LONG_TIMEOUT
        )

        elapsed = time.time() - start_time

        if resp.status_code == 200:
            success(f"Batch {batch_num + 1} xong ({elapsed:.1f}s)")
        elif resp.status_code == 202:
            info(f"Batch {batch_num + 1} đang chạy background...")
            # Wait for batch to complete before next
            time.sleep(30)
        else:
            warning(f"Batch {batch_num + 1} status: {resp.status_code}")

        # Small delay between batches
        if batch_num < total_batches - 1:
            time.sleep(2)


def export_pptx(project_id: str) -> str:
    """Export project thành PPTX"""
    step(7, "Export PPTX")

    info("Đang export file PPTX...")

    try:
        resp = requests.get(
            f"{BASE_URL}/api/projects/{project_id}/export/pptx",
            timeout=LONG_TIMEOUT,
            stream=True
        )

        if resp.status_code == 200:
            # Save to file
            output_dir = Path(__file__).parent.parent / "output"
            output_dir.mkdir(exist_ok=True)

            output_file = output_dir / f"ky-thuat-xung-{project_id[:8]}.pptx"

            with open(output_file, 'wb') as f:
                for chunk in resp.iter_content(chunk_size=8192):
                    f.write(chunk)

            success(f"Đã lưu: {output_file}")
            return str(output_file)
        else:
            error(f"Export thất bại: {resp.status_code}")
            return None

    except Exception as e:
        error(f"Export error: {e}")
        return None


def main():
    parser = argparse.ArgumentParser(
        description="Tạo 46 slides từ file JSON noidung43slide.txt"
    )
    parser.add_argument(
        "--json-file",
        default=None,
        help="Đường dẫn file JSON (default: noidung43slide.txt)"
    )
    parser.add_argument(
        "--generate-images",
        action="store_true",
        help="Generate images cho tất cả slides"
    )
    parser.add_argument(
        "--export-pptx",
        action="store_true",
        help="Export file PPTX"
    )
    parser.add_argument(
        "--all",
        action="store_true",
        help="Full workflow: Create + Generate Images + Export"
    )
    parser.add_argument(
        "--project-id",
        default=None,
        help="Sử dụng project đã tạo (skip create)"
    )

    args = parser.parse_args()

    print(colored("\n" + "=" * 60, Colors.BOLD))
    print(colored("  BANANA SLIDES - TẠO 46 SLIDES KỸ THUẬT XUNG", Colors.YELLOW))
    print(colored("=" * 60, Colors.BOLD))

    # Determine JSON file path
    if args.json_file:
        json_path = Path(args.json_file)
    else:
        # Try multiple locations
        possible_paths = [
            Path(__file__).parent.parent / "noidung43slide.txt",
            Path("noidung43slide.txt"),
            Path(__file__).parent / "noidung43slide.txt",
        ]
        json_path = None
        for p in possible_paths:
            if p.exists():
                json_path = p
                break

        if not json_path:
            error("Không tìm thấy file noidung43slide.txt")
            error("Hãy chỉ định đường dẫn với --json-file")
            sys.exit(1)

    info(f"File JSON: {json_path}")

    # Parse JSON
    try:
        data = parse_json_file(json_path)
        slides = data.get("slides", [])
        info(f"Số slides trong JSON: {len(slides)}")
    except Exception as e:
        error(f"Lỗi parse JSON: {e}")
        sys.exit(1)

    project_id = args.project_id

    # Create project if not provided
    if not project_id:
        project_id = create_project_with_descriptions(data)
        if not project_id:
            error("Không thể tạo project")
            sys.exit(1)
    else:
        info(f"Sử dụng project: {project_id}")

    # Get page IDs
    resp = requests.get(f"{BASE_URL}/api/projects/{project_id}", timeout=TIMEOUT)
    project = resp.json()["data"]
    pages = project.get("pages", [])
    page_ids = [p["id"] for p in pages]

    info(f"Số pages: {len(page_ids)}")

    # Generate images
    if args.generate_images or args.all:
        generate_images(project_id, page_ids)

    # Export PPTX
    if args.export_pptx or args.all:
        output_file = export_pptx(project_id)
        if output_file:
            info(f"File PPTX: {output_file}")

    # Summary
    print(colored("\n" + "=" * 60, Colors.BOLD))
    print(colored("  HOÀN THÀNH!", Colors.GREEN))
    print(colored("=" * 60, Colors.BOLD))

    print(f"""
  {colored('Project ID:', Colors.CYAN)} {project_id}
  {colored('Số slides:', Colors.CYAN)} {len(pages)}

  {colored('Xem project:', Colors.YELLOW)}
  • Browser: http://localhost:3000 → History → Tìm project
  • API: GET /api/projects/{project_id}

  {colored('Các bước tiếp theo:', Colors.YELLOW)}
  1. Chạy với --generate-images để tạo hình
  2. Chạy với --export-pptx để xuất file
  3. Hoặc dùng --all để chạy full workflow
""")

    return project_id


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print(colored("\n\nĐã hủy bởi người dùng", Colors.YELLOW))
        sys.exit(1)
