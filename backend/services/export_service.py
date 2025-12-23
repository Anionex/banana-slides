"""
Export Service - handles PPTX and PDF export
Based on demo.py create_pptx_from_images()
"""
import os
import json
import logging
from pathlib import Path
from typing import List, Dict, Any, Optional
from textwrap import dedent
from pptx import Presentation
from pptx.util import Inches
from PIL import Image
import io
import tempfile

logger = logging.getLogger(__name__)


class ExportService:
    """Service for exporting presentations"""
    
    @staticmethod
    def generate_clean_background(original_image_path: str, ai_service, aspect_ratio: str = "16:9", resolution: str = "2K") -> Optional[str]:
        """
        Generate clean background image by removing text, icons, and illustrations
        
        Args:
            original_image_path: Path to the original generated image
            ai_service: AIService instance for image editing
            aspect_ratio: Target aspect ratio
            resolution: Target resolution
            
        Returns:
            Path to the generated clean background image, or None if failed
        """
        try:
            # Create edit instruction to remove foreground elements
            edit_instruction  = """\
去除当前ppt页面的所有前景元素，包括标题、正文、注释等文字，以及插画、图标、配图、表格等图像。
保持原有文本框布局、配色、风格、渐变、背景装饰线条、背景图案等背景元素不变。
最终输出一张纯背景图像，尺寸与原图一致。
"""
            
            logger.info(f"Generating clean background from: {original_image_path}")
            
            # Use AI service to edit the image
            clean_bg_image = ai_service.edit_image(
                prompt=edit_instruction,
                current_image_path=original_image_path,
                aspect_ratio=aspect_ratio,
                resolution=resolution,
                original_description=None,
                additional_ref_images=None
            )
            
            if not clean_bg_image:
                logger.error("Failed to generate clean background image")
                return None
            
            # Convert Google GenAI Image to PIL Image if needed
            if not isinstance(clean_bg_image, Image.Image):
                # Google GenAI returns its own Image type with _pil_image attribute
                if hasattr(clean_bg_image, '_pil_image'):
                    clean_bg_image = clean_bg_image._pil_image
                else:
                    logger.error(f"Unexpected image type: {type(clean_bg_image)}, no _pil_image attribute")
                    return None
            
            # Save the clean background to a temporary file
            with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as tmp_file:
                clean_bg_path = tmp_file.name
                clean_bg_image.save(clean_bg_path, format='PNG')
                logger.info(f"Clean background saved to: {clean_bg_path}")
                return clean_bg_path
        
        except Exception as e:
            logger.error(f"Error generating clean background: {str(e)}", exc_info=True)
            return None
    
    @staticmethod
    def create_pptx_from_images(image_paths: List[str], output_file: str = None) -> bytes:
        """
        Create PPTX file from image paths
        Based on demo.py create_pptx_from_images()
        
        Args:
            image_paths: List of absolute paths to images
            output_file: Optional output file path (if None, returns bytes)
        
        Returns:
            PPTX file as bytes if output_file is None
        """
        # Create presentation
        prs = Presentation()
        
        # Set slide dimensions to 16:9 (width 10 inches, height 5.625 inches)
        prs.slide_width = Inches(10)
        prs.slide_height = Inches(5.625)
        
        # Add each image as a slide
        for image_path in image_paths:
            if not os.path.exists(image_path):
                logger.warning(f"Image not found: {image_path}")
                continue
            
            # Add blank slide layout (layout 6 is typically blank)
            blank_slide_layout = prs.slide_layouts[6]
            slide = prs.slides.add_slide(blank_slide_layout)
            
            # Add image to fill entire slide
            slide.shapes.add_picture(
                image_path,
                left=0,
                top=0,
                width=prs.slide_width,
                height=prs.slide_height
            )
        
        # Save or return bytes
        if output_file:
            prs.save(output_file)
            return None
        else:
            # Save to bytes
            pptx_bytes = io.BytesIO()
            prs.save(pptx_bytes)
            pptx_bytes.seek(0)
            return pptx_bytes.getvalue()
    
    @staticmethod
    def create_pdf_from_images(image_paths: List[str], output_file: str = None) -> bytes:
        """
        Create PDF file from image paths
        
        Args:
            image_paths: List of absolute paths to images
            output_file: Optional output file path (if None, returns bytes)
        
        Returns:
            PDF file as bytes if output_file is None
        """
        images = []
        
        # Load all images
        for image_path in image_paths:
            if not os.path.exists(image_path):
                logger.warning(f"Image not found: {image_path}")
                continue
            
            img = Image.open(image_path)
            
            # Convert to RGB if necessary (PDF requires RGB)
            if img.mode != 'RGB':
                img = img.convert('RGB')
            
            images.append(img)
        
        if not images:
            raise ValueError("No valid images found for PDF export")
        
        # Save as PDF
        if output_file:
            images[0].save(
                output_file,
                save_all=True,
                append_images=images[1:],
                format='PDF'
            )
            return None
        else:
            # Save to bytes
            pdf_bytes = io.BytesIO()
            images[0].save(
                pdf_bytes,
                save_all=True,
                append_images=images[1:],
                format='PDF'
            )
            pdf_bytes.seek(0)
            return pdf_bytes.getvalue()
    
    @staticmethod
    def create_editable_pptx_from_mineru(
        mineru_result_dir: str,
        output_file: str = None,
        slide_width_pixels: int = 1920,
        slide_height_pixels: int = 1080,
        background_images: List[str] = None
    ) -> bytes:
        """
        Create editable PPTX file from MinerU parsing results
        
        Args:
            mineru_result_dir: Directory containing MinerU results (content_list.json, images/, etc.)
            output_file: Optional output file path (if None, returns bytes)
            slide_width_pixels: Original slide width in pixels (default: 1920)
            slide_height_pixels: Original slide height in pixels (default: 1080)
            background_images: Optional list of background image paths (one per page)
        
        Returns:
            PPTX file as bytes if output_file is None
        """
        from utils.pptx_builder import PPTXBuilder
        
        mineru_dir = Path(mineru_result_dir)
        
        # Find content_list.json file
        content_list_files = list(mineru_dir.glob("*_content_list.json"))
        if not content_list_files:
            raise FileNotFoundError(f"No content_list.json found in {mineru_result_dir}")
        
        content_list_file = content_list_files[0]
        logger.info(f"Loading MinerU content from: {content_list_file}")
        
        # Load content list for text_level info
        with open(content_list_file, 'r', encoding='utf-8') as f:
            content_list = json.load(f)
        
        if not content_list:
            raise ValueError("Empty content list from MinerU")
        
        logger.info(f"Loaded {len(content_list)} items from MinerU content_list")
        
        # Load layout.json for accurate coordinates
        layout_file = mineru_dir / 'layout.json'
        layout_data = None
        actual_page_width = slide_width_pixels
        actual_page_height = slide_height_pixels
        use_layout_coords = False
        
        if layout_file.exists():
            try:
                with open(layout_file, 'r', encoding='utf-8') as f:
                    layout_data = json.load(f)
                    if 'pdf_info' in layout_data and len(layout_data['pdf_info']) > 0:
                        page_size = layout_data['pdf_info'][0].get('page_size')
                        if page_size and len(page_size) == 2:
                            actual_page_width, actual_page_height = page_size
                            use_layout_coords = True
                            logger.info(f"✓ Using layout.json for accurate coordinates: {actual_page_width}x{actual_page_height}")
                        else:
                            logger.warning("page_size not found in layout.json")
                    else:
                        logger.warning("pdf_info not found in layout.json")
            except Exception as e:
                logger.warning(f"Failed to read layout.json: {e}")
        else:
            logger.warning(f"layout.json not found, using content_list coordinates")
        
        logger.info(f"Target slide dimensions: {slide_width_pixels}x{slide_height_pixels}")
        logger.info(f"Actual page dimensions: {actual_page_width}x{actual_page_height}")
        
        # Log first few items for debugging
        for i, item in enumerate(content_list[:3]):
            logger.debug(f"Sample item {i}: type={item.get('type')}, bbox={item.get('bbox')}, text={item.get('text', '')[:50] if 'text' in item else 'N/A'}")
        
        # Build text_level map from content_list (for font sizing)
        text_level_map = {}
        for item in content_list:
            if item.get('type') == 'text' and 'text' in item:
                text = item['text'].strip()
                text_level_map[text] = item.get('text_level')
        
        logger.info(f"Built text_level map with {len(text_level_map)} entries")
        
        # Group content by page
        pages_content = {}
        
        if use_layout_coords and layout_data:
            # Use layout.json for accurate coordinates
            logger.info("Using layout.json coordinates (accurate)")
            
            for page_info in layout_data['pdf_info']:
                page_idx = page_info.get('page_idx', 0)
                pages_content[page_idx] = []
                
                for block in page_info.get('para_blocks', []):
                    block_type = block.get('type', 'text')
                    bbox = block.get('bbox')
                    
                    if not bbox:
                        continue
                    
                    # Handle text blocks
                    if block_type in ['text', 'title'] and block.get('lines'):
                        for line in block['lines']:
                            for span in line.get('spans', []):
                                if span.get('type') == 'text' and span.get('content'):
                                    text = span['content'].strip()
                                    text_level = text_level_map.get(text)
                                    
                                    pages_content[page_idx].append({
                                        'type': block_type,
                                        'text': text,
                                        'text_level': text_level,
                                        'bbox': bbox,  # Use layout bbox (accurate!)
                                        'page_idx': page_idx
                                    })
                    
                    # Handle image and table blocks (tables rendered as images)
                    elif block_type in ['image', 'table'] and block.get('blocks'):
                        # Find image path in spans
                        img_path = None
                        
                        for sub_block in block['blocks']:
                            for line in sub_block.get('lines', []):
                                for span in line.get('spans', []):
                                    if span.get('image_path'):
                                        img_path = span['image_path']
                                        break
                                if img_path:
                                    break
                            if img_path:
                                break
                        
                        if img_path:
                            pages_content[page_idx].append({
                                'type': block_type,
                                'img_path': 'images/' + img_path if not img_path.startswith('images/') else img_path,
                                'bbox': bbox,  # Block-level bbox (accurate!)
                                'page_idx': page_idx
                            })
        
        else:
            # Fallback to content_list.json
            logger.info("Using content_list.json coordinates (need scaling)")
            
            for item in content_list:
                page_idx = item.get('page_idx', 0)
                if page_idx not in pages_content:
                    pages_content[page_idx] = []
                pages_content[page_idx].append(item)
        
        total_extracted = sum(len(items) for items in pages_content.values())
        logger.info(f"Grouped {total_extracted} items into {len(pages_content)} pages")
        
        # Calculate scale factors (from actual page size to target slide size)
        scale_x = slide_width_pixels / actual_page_width
        scale_y = slide_height_pixels / actual_page_height
        
        logger.info(f"Scale factors: X={scale_x:.4f} ({slide_width_pixels}/{actual_page_width}), Y={scale_y:.4f} ({slide_height_pixels}/{actual_page_height})")
        
        if scale_x == 1.0 and scale_y == 1.0:
            logger.info("✓ No scaling needed - using accurate layout.json coordinates!")
        
        # Create PPTX builder
        builder = PPTXBuilder()
        builder.create_presentation()
        builder.setup_presentation_size(slide_width_pixels, slide_height_pixels)
        
        # Process each page
        for page_idx in sorted(pages_content.keys()):
            logger.info(f"Processing page {page_idx}")
            slide = builder.add_blank_slide()
            
            # Add background image if provided (should be first, behind everything)
            if background_images and page_idx < len(background_images):
                bg_image_path = background_images[page_idx]
                if bg_image_path and os.path.exists(bg_image_path):
                    logger.info(f"Adding background image for page {page_idx}: {bg_image_path}")
                    try:
                        # Add background image to fill entire slide
                        slide.shapes.add_picture(
                            bg_image_path,
                            left=0,
                            top=0,
                            width=builder.prs.slide_width,
                            height=builder.prs.slide_height
                        )
                    except Exception as e:
                        logger.error(f"Failed to add background image: {str(e)}")
                else:
                    logger.warning(f"Background image not found or not provided for page {page_idx}")
            
            page_items = pages_content[page_idx]
            
            # Separate items by type
            text_items = []
            image_items = []
            table_count = 0
            
            for item in page_items:
                item_type = item.get('type', '')
                
                if item_type in ['text', 'title', 'header', 'footer']:
                    text_items.append(item)
                elif item_type in ['image', 'table']:
                    # Both image and table items can have img_path
                    # Tables are rendered as images by MinerU
                    if item.get('img_path'):
                        image_items.append(item)
                        if item_type == 'table':
                            table_count += 1
            
            # Add MinerU extracted images (on top of background, behind text)
            for img_item in image_items:
                ExportService._add_mineru_image_to_slide(
                    builder, slide, img_item, mineru_dir, scale_x, scale_y
                )
            
            # Add text elements
            for text_item in text_items:
                ExportService._add_mineru_text_to_slide(
                    builder, slide, text_item, scale_x, scale_y
                )
            
            has_background = background_images and page_idx < len(background_images) and background_images[page_idx]
            logger.info(f"Page {page_idx}: background={'✓' if has_background else '✗'}, {len(text_items)} texts, {len(image_items)} images (including {table_count} tables)")
        
        # Log summary
        total_items = len(content_list)
        total_with_images = len([item for item in content_list if item.get('img_path')])
        total_text = len([item for item in content_list if item.get('type') in ['text', 'title', 'header', 'footer']])
        title_count = len([item for item in content_list if item.get('text_level') == 1])
        body_count = total_text - title_count
        
        bg_count = len(background_images) if background_images else 0
        
        logger.info(f"Completed processing {len(pages_content)} pages:")
        logger.info(f"  - Background images: {bg_count}")
        logger.info(f"  - Total MinerU items: {total_items}")
        logger.info(f"  - Text items: {total_text} (titles: {title_count}, body: {body_count})")
        logger.info(f"  - Image items: {total_with_images}")
        logger.info(f"All text uses dynamic font sizing based on bbox dimensions")
        
        # Save or return bytes
        if output_file:
            builder.save(output_file)
            return None
        else:
            # Save to bytes
            pptx_bytes = io.BytesIO()
            builder.get_presentation().save(pptx_bytes)
            pptx_bytes.seek(0)
            return pptx_bytes.getvalue()
    
    @staticmethod
    def _add_mineru_text_to_slide(builder, slide, text_item: Dict[str, Any], scale_x: float = 1.0, scale_y: float = 1.0):
        """
        Add text item from MinerU to slide
        
        Args:
            builder: PPTXBuilder instance
            slide: Target slide
            text_item: Text item from MinerU content_list
            scale_x: X-axis scale factor
            scale_y: Y-axis scale factor
        """
        text = text_item.get('text', '').strip()
        if not text:
            return
        
        bbox = text_item.get('bbox')
        if not bbox or len(bbox) != 4:
            logger.warning(f"Invalid bbox for text item: {text_item}")
            return
        
        original_bbox = bbox.copy()
        
        # Apply scale factors to bbox
        x0, y0, x1, y1 = bbox
        bbox = [
            int(x0 * scale_x),
            int(y0 * scale_y),
            int(x1 * scale_x),
            int(y1 * scale_y)
        ]
        
        if scale_x != 1.0 or scale_y != 1.0:
            logger.debug(f"Text bbox scaled: {original_bbox} -> {bbox} (scale: {scale_x:.3f}x{scale_y:.3f})")
        
        # Determine text level (only used for styling like bold, NOT for font size)
        # Font size is purely calculated from bbox dimensions
        item_type = text_item.get('type', 'text')
        text_level = text_item.get('text_level')
        
        # Map to level for styling purposes (bold titles)
        if item_type == 'title' or text_level == 1:
            level = 'title'  # Will be bold
        else:
            level = 'default'
        
        # Add text element
        # Note: text_level is only used for bold styling, not font size calculation
        try:
            builder.add_text_element(
                slide=slide,
                text=text,
                bbox=bbox,
                text_level=level  # For styling (bold) only, not font size
            )
        except Exception as e:
            logger.error(f"Failed to add text element: {str(e)}")
    
    @staticmethod
    def _add_mineru_image_to_slide(
        builder,
        slide,
        image_item: Dict[str, Any],
        mineru_dir: Path,
        scale_x: float = 1.0,
        scale_y: float = 1.0
    ):
        """
        Add image or table item from MinerU to slide
        
        Args:
            builder: PPTXBuilder instance
            slide: Target slide
            image_item: Image/table item from MinerU content_list
            mineru_dir: MinerU result directory
            scale_x: X-axis scale factor
            scale_y: Y-axis scale factor
        """
        bbox = image_item.get('bbox')
        if not bbox or len(bbox) != 4:
            logger.warning(f"Invalid bbox for image item: {image_item}")
            return
        
        original_bbox = bbox.copy()
        
        # Apply scale factors to bbox
        x0, y0, x1, y1 = bbox
        bbox = [
            int(x0 * scale_x),
            int(y0 * scale_y),
            int(x1 * scale_x),
            int(y1 * scale_y)
        ]
        
        if scale_x != 1.0 or scale_y != 1.0:
            logger.debug(f"Item bbox scaled: {original_bbox} -> {bbox} (scale: {scale_x:.3f}x{scale_y:.3f})")
        
        # Check if this is a table with HTML data
        html_table = image_item.get('html_table')
        item_type = image_item.get('type', 'image')
        
        if html_table and item_type == 'table':
            # Add editable table from HTML
            try:
                builder.add_table_element(
                    slide=slide,
                    html_table=html_table,
                    bbox=bbox
                )
                logger.info(f"Added editable table at bbox {bbox}")
                return  # Table added successfully
            except Exception as e:
                logger.error(f"Failed to add table: {str(e)}, falling back to image")
                # Fall through to add as image instead
        
        # Add as image (either image type or table fallback)
        img_path_str = image_item.get('img_path', '')
        if not img_path_str:
            logger.warning(f"No img_path in item: {image_item}")
            return
        
        # Try to find the image file
        # MinerU may store images in 'images/' subdirectory
        possible_paths = [
            mineru_dir / img_path_str,
            mineru_dir / 'images' / Path(img_path_str).name,
            mineru_dir / Path(img_path_str).name,
        ]
        
        image_path = None
        for path in possible_paths:
            if path.exists():
                image_path = str(path)
                break
        
        if not image_path:
            logger.warning(f"Image file not found: {img_path_str}")
            # Add placeholder
            builder.add_image_placeholder(slide, bbox)
            return
        
        # Add image element
        try:
            builder.add_image_element(
                slide=slide,
                image_path=image_path,
                bbox=bbox
            )
        except Exception as e:
            logger.error(f"Failed to add image element: {str(e)}")

