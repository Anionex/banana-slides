"""
Export Controller - handles file export endpoints
"""
from flask import Blueprint, request, current_app
from models import db, Project, Page
from utils import error_response, not_found, bad_request, success_response
from services import ExportService, FileService
import os
import io

export_bp = Blueprint('export', __name__, url_prefix='/api/projects')


@export_bp.route('/<project_id>/export/pptx', methods=['GET'])
def export_pptx(project_id):
    """
    GET /api/projects/{project_id}/export/pptx?filename=... - Export PPTX
    
    Returns:
        JSON with download URL, e.g.
        {
            "success": true,
            "data": {
                "download_url": "/files/{project_id}/exports/xxx.pptx",
                "download_url_absolute": "http://host:port/files/{project_id}/exports/xxx.pptx"
            }
        }
    """
    try:
        project = Project.query.get(project_id)
        
        if not project:
            return not_found('Project')
        
        # Get all completed pages
        pages = Page.query.filter_by(project_id=project_id).order_by(Page.order_index).all()
        
        if not pages:
            return bad_request("No pages found for project")
        
        # Get image paths
        file_service = FileService(current_app.config['UPLOAD_FOLDER'])
        
        image_paths = []
        for page in pages:
            if page.generated_image_path:
                abs_path = file_service.get_absolute_path(page.generated_image_path)
                image_paths.append(abs_path)
        
        if not image_paths:
            return bad_request("No generated images found for project")
        
        # Determine export directory and filename
        file_service = FileService(current_app.config['UPLOAD_FOLDER'])
        exports_dir = file_service._get_exports_dir(project_id)
        
        # Get filename from query params or use default
        filename = request.args.get('filename', f'presentation_{project_id}.pptx')
        if not filename.endswith('.pptx'):
            filename += '.pptx'

        output_path = os.path.join(exports_dir, filename)

        # Generate PPTX file on disk
        ExportService.create_pptx_from_images(image_paths, output_file=output_path)

        # Build download URLs
        download_path = f"/files/{project_id}/exports/{filename}"
        base_url = request.url_root.rstrip("/")
        download_url_absolute = f"{base_url}{download_path}"

        return success_response(
            data={
                "download_url": download_path,
                "download_url_absolute": download_url_absolute,
            },
            message="Export PPTX task created"
        )
    
    except Exception as e:
        return error_response('SERVER_ERROR', str(e), 500)


@export_bp.route('/<project_id>/export/pdf', methods=['GET'])
def export_pdf(project_id):
    """
    GET /api/projects/{project_id}/export/pdf?filename=... - Export PDF
    
    Returns:
        JSON with download URL, e.g.
        {
            "success": true,
            "data": {
                "download_url": "/files/{project_id}/exports/xxx.pdf",
                "download_url_absolute": "http://host:port/files/{project_id}/exports/xxx.pdf"
            }
        }
    """
    try:
        project = Project.query.get(project_id)
        
        if not project:
            return not_found('Project')
        
        # Get all completed pages
        pages = Page.query.filter_by(project_id=project_id).order_by(Page.order_index).all()
        
        if not pages:
            return bad_request("No pages found for project")
        
        # Get image paths
        file_service = FileService(current_app.config['UPLOAD_FOLDER'])
        
        image_paths = []
        for page in pages:
            if page.generated_image_path:
                abs_path = file_service.get_absolute_path(page.generated_image_path)
                image_paths.append(abs_path)
        
        if not image_paths:
            return bad_request("No generated images found for project")
        
        # Determine export directory and filename
        file_service = FileService(current_app.config['UPLOAD_FOLDER'])
        exports_dir = file_service._get_exports_dir(project_id)

        # Get filename from query params or use default
        filename = request.args.get('filename', f'presentation_{project_id}.pdf')
        if not filename.endswith('.pdf'):
            filename += '.pdf'

        output_path = os.path.join(exports_dir, filename)

        # Generate PDF file on disk
        ExportService.create_pdf_from_images(image_paths, output_file=output_path)

        # Build download URLs
        download_path = f"/files/{project_id}/exports/{filename}"
        base_url = request.url_root.rstrip("/")
        download_url_absolute = f"{base_url}{download_path}"

        return success_response(
            data={
                "download_url": download_path,
                "download_url_absolute": download_url_absolute,
            },
            message="Export PDF task created"
        )
    
    except Exception as e:
        return error_response('SERVER_ERROR', str(e), 500)


@export_bp.route('/<project_id>/export/editable-pptx', methods=['GET'])
def export_editable_pptx(project_id):
    """
    GET /api/projects/{project_id}/export/editable-pptx?filename=... - Export Editable PPTX
    
    This endpoint:
    1. Collects all page images
    2. Converts them to PDF
    3. Sends PDF to MinerU for parsing
    4. Creates editable PPTX from MinerU results
    
    Returns:
        JSON with download URL, e.g.
        {
            "success": true,
            "data": {
                "download_url": "/files/{project_id}/exports/xxx.pptx",
                "download_url_absolute": "http://host:port/files/{project_id}/exports/xxx.pptx"
            }
        }
    """
    try:
        from services.file_parser_service import FileParserService
        from config import Config
        import tempfile
        import uuid
        import logging
        
        logger = logging.getLogger(__name__)
        
        project = Project.query.get(project_id)
        
        if not project:
            return not_found('Project')
        
        # Get all completed pages
        pages = Page.query.filter_by(project_id=project_id).order_by(Page.order_index).all()
        
        if not pages:
            return bad_request("No pages found for project")
        
        # Get image paths
        file_service = FileService(current_app.config['UPLOAD_FOLDER'])
        
        image_paths = []
        for page in pages:
            if page.generated_image_path:
                abs_path = file_service.get_absolute_path(page.generated_image_path)
                image_paths.append(abs_path)
        
        if not image_paths:
            return bad_request("No generated images found for project")
        
        # Initialize for cleanup in finally block
        clean_background_paths = []
        tmp_pdf_path = None
        
        # Step 1: Generate clean background images (remove text, icons, illustrations)
        # Use parallel processing for better performance
        logger.info(f"Generating clean backgrounds for {len(image_paths)} images in parallel...")
        
        from services.ai_service import AIService
        from concurrent.futures import ThreadPoolExecutor, as_completed  # For parallel processing
        
        # Get config values and app instance in main thread (before entering thread pool)
        aspect_ratio = current_app.config.get('DEFAULT_ASPECT_RATIO', '16:9')
        resolution = current_app.config.get('DEFAULT_RESOLUTION', '2K')
        app = current_app._get_current_object()  # Get actual app object for thread context
        
        def generate_single_background(index, original_image_path, aspect_ratio, resolution, app):
            """Generate clean background for a single image (runs in thread pool)"""
            # Use Flask app context in thread
            with app.app_context():
                logger.info(f"Processing background {index+1}/{len(image_paths)}...")
                ai_service = AIService()  # Create instance per thread
                
                clean_bg_path = ExportService.generate_clean_background(
                    original_image_path=original_image_path,
                    ai_service=ai_service,
                    aspect_ratio=aspect_ratio,
                    resolution=resolution
                )
                
                if clean_bg_path:
                    logger.info(f"Clean background {index+1} generated successfully")
                    return (index, clean_bg_path)
                else:
                    # Fallback to original image if generation fails
                    logger.warning(f"Failed to generate clean background {index+1}, using original image")
                    return (index, original_image_path)
        
        # Process backgrounds in parallel
        max_workers = min(len(image_paths), current_app.config.get('MAX_IMAGE_WORKERS', 8))
        results = {}
        
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            futures = {
                executor.submit(generate_single_background, i, path, aspect_ratio, resolution, app): i 
                for i, path in enumerate(image_paths)
            }
            
            for future in as_completed(futures):
                try:
                    index, clean_bg_path = future.result()
                    results[index] = clean_bg_path
                except Exception as e:
                    index = futures[future]
                    logger.error(f"Error generating background {index+1}: {str(e)}")
                    results[index] = image_paths[index]  # Fallback to original
        
        # Sort results by index to maintain page order
        clean_background_paths = [results[i] for i in range(len(image_paths))]
        logger.info(f"Generated {len(clean_background_paths)} clean backgrounds (parallel processing completed)")
        
        try:
            # Step 2: Create temporary PDF from images
            with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as tmp_pdf:
                tmp_pdf_path = tmp_pdf.name
            logger.info(f"Creating PDF from {len(image_paths)} images...")
            ExportService.create_pdf_from_images(image_paths, output_file=tmp_pdf_path)
            logger.info(f"PDF created: {tmp_pdf_path}")
            
            # Step 2: Parse PDF with MinerU
            logger.info("Parsing PDF with MinerU...")
            
            # Get MinerU configuration
            mineru_token = current_app.config.get('MINERU_TOKEN')
            mineru_api_base = current_app.config.get('MINERU_API_BASE', 'https://mineru.net')
            
            if not mineru_token:
                return error_response('CONFIG_ERROR', 'MinerU token not configured', 500)
            
            # Initialize FileParserService
            parser_service = FileParserService(
                mineru_token=mineru_token,
                mineru_api_base=mineru_api_base
            )
            
            # Parse the PDF
            batch_id, markdown_content, extract_id, error_message, failed_image_count = parser_service.parse_file(
                file_path=tmp_pdf_path,
                filename=f'presentation_{project_id}.pdf'
            )
            
            if error_message or not extract_id:
                error_msg = error_message or 'Failed to parse PDF with MinerU - no extract_id returned'
                return error_response('MINERU_ERROR', error_msg, 500)
            
            logger.info(f"MinerU parsing completed, extract_id: {extract_id}")
            
            # Step 3: Create editable PPTX from MinerU results
            mineru_result_dir = os.path.join(
                current_app.config['UPLOAD_FOLDER'],
                'mineru_files',
                extract_id
            )
            
            if not os.path.exists(mineru_result_dir):
                return error_response('MINERU_ERROR', f'MinerU result directory not found: {mineru_result_dir}', 500)
            
            logger.info(f"Creating editable PPTX from MinerU results: {mineru_result_dir}")
            
            # Determine export directory and filename
            exports_dir = file_service._get_exports_dir(project_id)
            
            # Get filename from query params or use default
            filename = request.args.get('filename', f'presentation_editable_{project_id}.pptx')
            if not filename.endswith('.pptx'):
                filename += '.pptx'
            
            output_path = os.path.join(exports_dir, filename)
            
            # Get slide dimensions from first image
            from PIL import Image
            first_img = Image.open(image_paths[0])
            slide_width, slide_height = first_img.size
            first_img.close()
            
            # Generate editable PPTX file with clean background images
            logger.info(f"Creating editable PPTX with {len(clean_background_paths)} clean background images")
            ExportService.create_editable_pptx_from_mineru(
                mineru_result_dir=mineru_result_dir,
                output_file=output_path,
                slide_width_pixels=slide_width,
                slide_height_pixels=slide_height,
                background_images=clean_background_paths  # Use clean backgrounds without text/icons
            )
            
            logger.info(f"Editable PPTX created: {output_path}")
            
            # Build download URLs
            download_path = f"/files/{project_id}/exports/{filename}"
            base_url = request.url_root.rstrip("/")
            download_url_absolute = f"{base_url}{download_path}"
            
            return success_response(
                data={
                    "download_url": download_path,
                    "download_url_absolute": download_url_absolute,
                },
                message="Editable PPTX export completed"
            )
        
        finally:
            # Clean up temporary PDF
            if tmp_pdf_path and os.path.exists(tmp_pdf_path):
                try:
                    os.unlink(tmp_pdf_path)
                    logger.info(f"Cleaned up temporary PDF: {tmp_pdf_path}")
                except Exception as e:
                    logger.warning(f"Failed to clean up temporary PDF: {str(e)}")
            
            # Clean up temporary clean background images
            if clean_background_paths:
                for bg_path in clean_background_paths:
                    # Only delete if it's a temporary file (not the original)
                    if bg_path not in image_paths and os.path.exists(bg_path):
                        try:
                            os.unlink(bg_path)
                            logger.debug(f"Cleaned up temporary background: {bg_path}")
                        except Exception as e:
                            logger.warning(f"Failed to clean up temporary background: {str(e)}")
    
    except Exception as e:
        logger.exception("Error exporting editable PPTX")
        return error_response('SERVER_ERROR', str(e), 500)

