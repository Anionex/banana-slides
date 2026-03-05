"""Add thumb_path to user_templates table

Revision ID: 011_add_user_template_thumb
Revises: 010_add_cached_image_path
Create Date: 2025-01-18
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '011_add_user_template_thumb'
down_revision = '010_add_cached_image_path'
branch_labels = None
depends_on = None


def generate_user_template_thumbnails():
    """Generate thumbnails for existing user templates"""
    import os
    from pathlib import Path

    # Get upload folder - use parent directory's uploads folder
    script_dir = Path(__file__).resolve().parent
    project_root = script_dir.parent.parent.parent  # migrations/versions -> migrations -> backend -> project
    upload_folder = os.environ.get('UPLOAD_FOLDER', str(project_root / 'uploads'))

    try:
        from PIL import Image
    except ImportError:
        print("PIL not available, skipping thumbnail generation")
        return

    # Get database connection
    connection = op.get_bind()

    # Query user templates without thumbnail
    result = connection.execute(
        sa.text("""
            SELECT id, file_path
            FROM user_templates
            WHERE thumb_path IS NULL
            AND file_path IS NOT NULL
        """)
    )
    templates = result.fetchall()

    print(f"Generating thumbnails for {len(templates)} user templates...")

    for template_id, file_path in templates:
        try:
            # Open original image
            original_path = Path(upload_folder) / file_path.replace('\\', '/')
            if not original_path.exists():
                print(f"  Skipped {template_id}: file not found")
                continue

            image = Image.open(str(original_path))

            # Resize if too large (600px for template thumbnails)
            max_width = 600
            if image.width > max_width:
                ratio = max_width / image.width
                new_height = int(image.height * ratio)
                image = image.resize((max_width, new_height), Image.Resampling.LANCZOS)

            # Convert to RGB
            if image.mode in ('RGBA', 'LA', 'P'):
                background = Image.new('RGB', image.size, (255, 255, 255))
                if image.mode == 'P':
                    image = image.convert('RGBA')
                if image.mode in ('RGBA', 'LA'):
                    background.paste(image, mask=image.split()[-1])
                else:
                    background.paste(image)
                image = background
            elif image.mode != 'RGB':
                image = image.convert('RGB')

            # Save thumbnail
            thumb_filename = "template-thumb.webp"
            thumb_dir = Path(upload_folder) / "user-templates" / template_id
            thumb_dir.mkdir(parents=True, exist_ok=True)
            thumb_full_path = thumb_dir / thumb_filename
            thumb_relative_path = f"user-templates/{template_id}/{thumb_filename}"

            image.save(str(thumb_full_path), 'WEBP', quality=80)
            image.close()

            # Update database
            connection.execute(
                sa.text("UPDATE user_templates SET thumb_path = :path WHERE id = :id"),
                {"path": thumb_relative_path, "id": template_id}
            )
            print(f"  Generated: {thumb_relative_path}")

        except Exception as e:
            print(f"  Failed for template {template_id}: {e}")
            continue

    print("User template thumbnail generation complete")


def generate_page_thumbnails():
    """Generate thumbnails for existing pages (in case 010 ran without this)"""
    import os
    from pathlib import Path

    # Get upload folder - use parent directory's uploads folder
    script_dir = Path(__file__).resolve().parent
    project_root = script_dir.parent.parent.parent  # migrations/versions -> migrations -> backend -> project
    upload_folder = os.environ.get('UPLOAD_FOLDER', str(project_root / 'uploads'))

    try:
        from PIL import Image
    except ImportError:
        print("PIL not available, skipping page thumbnail generation")
        return

    connection = op.get_bind()

    result = connection.execute(
        sa.text("""
            SELECT id, project_id, generated_image_path
            FROM pages
            WHERE generated_image_path IS NOT NULL
            AND cached_image_path IS NULL
        """)
    )
    pages = result.fetchall()

    if not pages:
        print("No pages need thumbnail generation")
        return

    print(f"Generating thumbnails for {len(pages)} pages...")

    for page_id, project_id, image_path in pages:
        try:
            # Generate thumbnail filename based on original filename
            original_filename = Path(image_path).stem  # e.g., "page_id_timestamp" or "page_id_v1"
            thumb_filename = f"{original_filename}_thumb.jpg"
            thumb_relative_path = f"{project_id}/pages/{thumb_filename}"
            thumb_full_path = Path(upload_folder) / thumb_relative_path

            if thumb_full_path.exists():
                connection.execute(
                    sa.text("UPDATE pages SET cached_image_path = :path WHERE id = :id"),
                    {"path": thumb_relative_path, "id": page_id}
                )
                continue

            original_path = Path(upload_folder) / image_path.replace('\\', '/')
            if not original_path.exists():
                print(f"  Skipped {page_id}: file not found")
                continue

            image = Image.open(str(original_path))

            max_width = 1920
            if image.width > max_width:
                ratio = max_width / image.width
                image = image.resize((max_width, int(image.height * ratio)), Image.Resampling.LANCZOS)

            if image.mode in ('RGBA', 'LA', 'P'):
                background = Image.new('RGB', image.size, (255, 255, 255))
                if image.mode == 'P':
                    image = image.convert('RGBA')
                if image.mode in ('RGBA', 'LA'):
                    background.paste(image, mask=image.split()[-1])
                else:
                    background.paste(image)
                image = background
            elif image.mode != 'RGB':
                image = image.convert('RGB')

            thumb_full_path.parent.mkdir(parents=True, exist_ok=True)
            image.save(str(thumb_full_path), 'JPEG', quality=85, optimize=True)
            image.close()

            connection.execute(
                sa.text("UPDATE pages SET cached_image_path = :path WHERE id = :id"),
                {"path": thumb_relative_path, "id": page_id}
            )
            print(f"  Generated: {thumb_relative_path}")

        except Exception as e:
            print(f"  Failed for page {page_id}: {e}")

    print("Page thumbnail generation complete")


def upgrade():
    # Add thumb_path column to user_templates table
    op.add_column('user_templates', sa.Column('thumb_path', sa.String(500), nullable=True))

    # Generate thumbnails for existing user templates
    generate_user_template_thumbnails()

    # Also generate page thumbnails if 010 migration ran without the auto-generation
    generate_page_thumbnails()


def downgrade():
    # Remove thumb_path column from user_templates table
    op.drop_column('user_templates', 'thumb_path')
