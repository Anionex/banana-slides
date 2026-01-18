#!/usr/bin/env python3
"""
Script to generate JPG cache for existing PNG images.
Run this after database migration to cache existing images.

Usage:
    cd backend
    python scripts/generate_image_cache.py
"""
import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from PIL import Image
from flask import Flask
from models import db, Page
from config import Config
from services.file_service import convert_image_to_rgb, resize_image_for_thumbnail


def generate_cache_for_existing_images(batch_size=100):
    """
    Generate JPG thumbnails for all existing PNG images

    Args:
        batch_size: Number of images to process before committing to database
                   This ensures progress is saved even if script is interrupted
    """
    app = Flask(__name__)
    app.config.from_object(Config)

    db.init_app(app)

    with app.app_context():
        # Count total pages with generated images but no cache
        total_count = Page.query.filter(
            Page.generated_image_path.isnot(None),
            Page.cached_image_path.is_(None)
        ).count()

        print(f"Found {total_count} pages with images but no cache")

        if total_count == 0:
            print("No pages to process")
            return

        upload_folder = Path(app.config['UPLOAD_FOLDER'])
        processed = 0
        skipped = 0
        errors = 0

        # Process in batches using offset/limit pagination to avoid memory issues
        # This is safer than yield_per() + expunge_all() which can conflict
        offset = 0
        while offset < total_count:
            # Fetch a batch of pages
            pages_batch = Page.query.filter(
                Page.generated_image_path.isnot(None),
                Page.cached_image_path.is_(None)
            ).order_by(Page.id).offset(offset).limit(batch_size).all()

            # Break if no more pages to process
            if not pages_batch:
                break

            for page in pages_batch:
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

                    # Resize image to reduce file size and improve loading speed
                    image = resize_image_for_thumbnail(image, max_width=1920)

                    # Convert to RGB using shared function
                    image = convert_image_to_rgb(image)

                    # Save as compressed JPEG
                    image.save(str(cache_path), 'JPEG', quality=85, optimize=True)

                    # Close image to free memory
                    image.close()

                    # Update database
                    cached_relative_path = cache_path.relative_to(upload_folder).as_posix()
                    page.cached_image_path = cached_relative_path

                    processed += 1
                    print(f"  [OK] {page.id}: {cache_filename}")

                except Exception as e:
                    print(f"  [ERROR] {page.id}: {e}")
                    errors += 1

            # Commit this batch
            db.session.commit()
            # Clear session to free memory
            db.session.expunge_all()

            print(f"  [PROGRESS] Committed batch, total processed: {processed}/{total_count}")

            # Move to next batch
            offset += batch_size

        print(f"\nDone!")
        print(f"  Processed: {processed}")
        print(f"  Skipped: {skipped}")
        print(f"  Errors: {errors}")


if __name__ == '__main__':
    generate_cache_for_existing_images()
