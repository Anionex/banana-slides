#!/usr/bin/env python3
"""
Script to generate JPG cache for existing PNG images.
Run this after database migration to cache existing images.

Usage:
    cd backend
    python scripts/generate_image_cache.py
"""
import os
import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from PIL import Image
from flask import Flask
from models import db, Page
from config import Config


def generate_cache_for_existing_images():
    """Generate JPG thumbnails for all existing PNG images"""
    app = Flask(__name__)
    app.config.from_object(Config)

    db.init_app(app)

    with app.app_context():
        # Get all pages with generated images but no cache
        pages = Page.query.filter(
            Page.generated_image_path.isnot(None),
            Page.cached_image_path.is_(None)
        ).all()

        print(f"Found {len(pages)} pages with images but no cache")

        upload_folder = Path(app.config['UPLOAD_FOLDER'])
        processed = 0
        skipped = 0
        errors = 0

        for page in pages:
            try:
                # Get original image path
                original_path = upload_folder / page.generated_image_path

                if not original_path.exists():
                    print(f"  [SKIP] Original image not found: {original_path}")
                    skipped += 1
                    continue

                # Generate cache path (replace extension with _thumb.jpg)
                # e.g., xxx_v1.png -> xxx_v1_thumb.jpg
                stem = original_path.stem  # xxx_v1
                cache_filename = f"{stem}_thumb.jpg"
                cache_path = original_path.parent / cache_filename

                # Load and convert image
                image = Image.open(original_path)

                # Convert to RGB if necessary
                if image.mode in ('RGBA', 'LA', 'P'):
                    background = Image.new('RGB', image.size, (255, 255, 255))
                    if image.mode == 'P':
                        image = image.convert('RGBA')
                    background.paste(image, mask=image.split()[-1] if image.mode == 'RGBA' else None)
                    image = background
                elif image.mode != 'RGB':
                    image = image.convert('RGB')

                # Save as compressed JPEG
                image.save(str(cache_path), 'JPEG', quality=85, optimize=True)

                # Update database
                cached_relative_path = cache_path.relative_to(upload_folder).as_posix()
                page.cached_image_path = cached_relative_path

                processed += 1
                print(f"  [OK] {page.id}: {cache_filename}")

            except Exception as e:
                print(f"  [ERROR] {page.id}: {e}")
                errors += 1

        # Commit all changes
        db.session.commit()

        print(f"\nDone!")
        print(f"  Processed: {processed}")
        print(f"  Skipped: {skipped}")
        print(f"  Errors: {errors}")


if __name__ == '__main__':
    generate_cache_for_existing_images()
