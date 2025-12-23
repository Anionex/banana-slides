"""
PPTX Builder - utilities for creating editable PPTX files
Based on OpenDCAI/DataFlow-Agent's implementation
"""
import os
import logging
from typing import List, Dict, Any, Optional, Tuple
from pathlib import Path
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.enum.text import PP_ALIGN
from PIL import Image
from html.parser import HTMLParser

logger = logging.getLogger(__name__)


class HTMLTableParser(HTMLParser):
    """Parse HTML table into row/column data"""
    
    def __init__(self):
        super().__init__()
        self.table_data = []
        self.current_row = []
        self.current_cell = []
        self.in_table = False
        self.in_row = False
        self.in_cell = False
    
    def handle_starttag(self, tag, attrs):
        if tag == 'table':
            self.in_table = True
            self.table_data = []
        elif tag == 'tr':
            self.in_row = True
            self.current_row = []
        elif tag in ['td', 'th']:
            self.in_cell = True
            self.current_cell = []
    
    def handle_endtag(self, tag):
        if tag == 'table':
            self.in_table = False
        elif tag == 'tr':
            self.in_row = False
            if self.current_row:
                self.table_data.append(self.current_row)
        elif tag in ['td', 'th']:
            self.in_cell = False
            cell_text = ''.join(self.current_cell).strip()
            self.current_row.append(cell_text)
    
    def handle_data(self, data):
        if self.in_cell:
            self.current_cell.append(data)
    
    @staticmethod
    def parse_html_table(html: str) -> List[List[str]]:
        """Parse HTML table string into 2D array of cells"""
        parser = HTMLTableParser()
        parser.feed(html)
        return parser.table_data


class PPTXBuilder:
    """Builder class for creating editable PPTX files from structured content"""
    
    # Standard slide dimensions (16:9 aspect ratio)
    DEFAULT_SLIDE_WIDTH_INCHES = 10
    DEFAULT_SLIDE_HEIGHT_INCHES = 5.625
    
    # Default DPI for pixel to inch conversion
    DEFAULT_DPI = 96
    
    # Global font size limits (to prevent extreme cases)
    MIN_FONT_SIZE = 6   # Minimum readable size
    MAX_FONT_SIZE = 200  # Maximum reasonable size
    
    def __init__(self, slide_width_inches: float = None, slide_height_inches: float = None):
        """
        Initialize PPTX builder
        
        Args:
            slide_width_inches: Slide width in inches (default: 10)
            slide_height_inches: Slide height in inches (default: 5.625)
        """
        self.slide_width_inches = slide_width_inches or self.DEFAULT_SLIDE_WIDTH_INCHES
        self.slide_height_inches = slide_height_inches or self.DEFAULT_SLIDE_HEIGHT_INCHES
        self.prs = None
        self.current_slide = None
        
    def create_presentation(self) -> Presentation:
        """Create a new presentation with configured dimensions"""
        self.prs = Presentation()
        self.prs.slide_width = Inches(self.slide_width_inches)
        self.prs.slide_height = Inches(self.slide_height_inches)
        return self.prs
    
    def setup_presentation_size(self, width_pixels: int, height_pixels: int, dpi: int = None):
        """
        Setup presentation size based on pixel dimensions
        
        Args:
            width_pixels: Width in pixels
            height_pixels: Height in pixels
            dpi: DPI for conversion (default: 96)
        """
        dpi = dpi or self.DEFAULT_DPI
        self.slide_width_inches = width_pixels / dpi
        self.slide_height_inches = height_pixels / dpi
        
        if self.prs:
            self.prs.slide_width = Inches(self.slide_width_inches)
            self.prs.slide_height = Inches(self.slide_height_inches)
    
    def add_blank_slide(self):
        """Add a blank slide to the presentation"""
        if not self.prs:
            self.create_presentation()
        
        # Use blank layout (layout 6 is typically blank)
        blank_layout = self.prs.slide_layouts[6]
        self.current_slide = self.prs.slides.add_slide(blank_layout)
        return self.current_slide
    
    def pixels_to_inches(self, pixels: float, dpi: int = None) -> float:
        """
        Convert pixels to inches
        
        Args:
            pixels: Pixel value
            dpi: DPI for conversion (default: 96)
            
        Returns:
            Value in inches
        """
        dpi = dpi or self.DEFAULT_DPI
        return pixels / dpi
    
    def calculate_font_size(self, bbox: List[int], text: str, text_level: Any = None, dpi: int = None) -> float:
        """
        Calculate appropriate font size based on bounding box and text content
        Pure bbox-based calculation without text_level restrictions
        
        Args:
            bbox: Bounding box [x0, y0, x1, y1] in pixels
            text: Text content
            text_level: Text level (kept for compatibility, not used in calculation)
            dpi: DPI for pixel to inch conversion
            
        Returns:
            Font size in points (float for precision)
        """
        dpi = dpi or self.DEFAULT_DPI
        
        # Get bbox dimensions in pixels
        width_px = bbox[2] - bbox[0]
        height_px = bbox[3] - bbox[1]
        
        # Add small padding to prevent overflow (3% on each side = 6% total reduction)
        padding_ratio = 0.03
        width_px = width_px * (1 - 2 * padding_ratio)
        height_px = height_px * (1 - 2 * padding_ratio)
        
        # Convert to inches for PPTX calculations
        width_in = width_px / dpi
        height_in = height_px / dpi
        
        text_length = len(text)
        
        # For very short text (1-3 chars), use height-based sizing
        if text_length <= 3:
            # Use 70% of height for single line text
            estimated_size = height_in * 0.7 * 72  # 72 points per inch
            return max(self.MIN_FONT_SIZE, min(self.MAX_FONT_SIZE, estimated_size))
        
        # Binary search with finer granularity (0.5pt steps)
        # Start from maximum, work down to find best fit
        best_size = self.MIN_FONT_SIZE
        
        # Use 0.5pt steps for more precision
        font_sizes = [size / 2.0 for size in range(int(self.MAX_FONT_SIZE * 2), int(self.MIN_FONT_SIZE * 2) - 1, -1)]
        
        for font_size in font_sizes:
            # Estimate character width (proportional fonts)
            # For CJK characters (Chinese/Japanese/Korean), use slightly wider ratio
            has_cjk = any('\u4e00' <= char <= '\u9fff' or '\u3040' <= char <= '\u30ff' for char in text)
            char_width_ratio = 0.7 if has_cjk else 0.55
            
            char_width_pts = font_size * char_width_ratio
            char_width_in = char_width_pts / 72
            
            # Account for text box padding (we set 0.05 inch margins)
            usable_width = width_in - 0.1  # Left + right margins
            usable_height = height_in - 0.1  # Top + bottom margins
            
            if usable_width <= 0 or usable_height <= 0:
                continue
            
            # Calculate how many characters fit per line
            chars_per_line = max(1, int(usable_width / char_width_in))
            
            # Calculate required lines
            required_lines = max(1, (text_length + chars_per_line - 1) // chars_per_line)
            
            # Line height is typically 1.2x font size
            line_height_in = (font_size * 1.2) / 72
            total_height_needed = required_lines * line_height_in
            
            # If text fits within usable space, this is our size
            if total_height_needed <= usable_height:
                best_size = font_size
                break
        
        return best_size
    
    def add_text_element(
        self,
        slide,
        text: str,
        bbox: List[int],
        text_level: Any = None,
        dpi: int = None,
        align: str = 'left'
    ):
        """
        Add text element to slide
        
        Args:
            slide: Target slide
            text: Text content
            bbox: Bounding box [x0, y0, x1, y1] in pixels
            text_level: Text level (1=title, 2=heading, etc.) or type string
            dpi: DPI for conversion (default: 96)
            align: Text alignment ('left', 'center', 'right')
        """
        dpi = dpi or self.DEFAULT_DPI
        
        # Convert bbox to inches
        left = Inches(self.pixels_to_inches(bbox[0], dpi))
        top = Inches(self.pixels_to_inches(bbox[1], dpi))
        width = Inches(self.pixels_to_inches(bbox[2] - bbox[0], dpi))
        height = Inches(self.pixels_to_inches(bbox[3] - bbox[1], dpi))
        
        # Add text box
        textbox = slide.shapes.add_textbox(left, top, width, height)
        text_frame = textbox.text_frame
        text_frame.text = text
        text_frame.word_wrap = True
        
        # Set font size (pass original bbox in pixels and dpi)
        font_size = self.calculate_font_size(bbox, text, text_level, dpi)
        paragraph = text_frame.paragraphs[0]
        paragraph.font.size = Pt(font_size)
        
        # Remove default margins for better fit
        text_frame.margin_left = Inches(0.05)
        text_frame.margin_right = Inches(0.05)
        text_frame.margin_top = Inches(0.05)
        text_frame.margin_bottom = Inches(0.05)
        
        # Set alignment
        if align == 'center':
            paragraph.alignment = PP_ALIGN.CENTER
        elif align == 'right':
            paragraph.alignment = PP_ALIGN.RIGHT
        else:
            paragraph.alignment = PP_ALIGN.LEFT
        
        # Make title text bold
        if text_level == 1 or text_level == 'title':
            paragraph.font.bold = True
        
        # Calculate bbox dimensions for logging
        bbox_width = bbox[2] - bbox[0]
        bbox_height = bbox[3] - bbox[1]
        logger.debug(f"Text: '{text[:35]}' | box: {bbox_width}x{bbox_height}px | font: {font_size:.1f}pt | chars: {len(text)}")
    
    def add_image_element(
        self,
        slide,
        image_path: str,
        bbox: List[int],
        dpi: int = None
    ):
        """
        Add image element to slide
        
        Args:
            slide: Target slide
            image_path: Path to image file
            bbox: Bounding box [x0, y0, x1, y1] in pixels
            dpi: DPI for conversion (default: 96)
        """
        dpi = dpi or self.DEFAULT_DPI
        
        # Check if image exists
        if not os.path.exists(image_path):
            logger.warning(f"Image not found: {image_path}, adding placeholder")
            self.add_image_placeholder(slide, bbox, dpi)
            return
        
        # Convert bbox to inches
        left = Inches(self.pixels_to_inches(bbox[0], dpi))
        top = Inches(self.pixels_to_inches(bbox[1], dpi))
        width = Inches(self.pixels_to_inches(bbox[2] - bbox[0], dpi))
        height = Inches(self.pixels_to_inches(bbox[3] - bbox[1], dpi))
        
        try:
            # Add image
            slide.shapes.add_picture(image_path, left, top, width, height)
            logger.debug(f"Added image: {image_path} at bbox {bbox}")
        except Exception as e:
            logger.error(f"Failed to add image {image_path}: {str(e)}")
            self.add_image_placeholder(slide, bbox, dpi)
    
    def add_image_placeholder(
        self,
        slide,
        bbox: List[int],
        dpi: int = None
    ):
        """
        Add a placeholder for missing images
        
        Args:
            slide: Target slide
            bbox: Bounding box [x0, y0, x1, y1] in pixels
            dpi: DPI for conversion (default: 96)
        """
        dpi = dpi or self.DEFAULT_DPI
        
        # Convert bbox to inches
        left = Inches(self.pixels_to_inches(bbox[0], dpi))
        top = Inches(self.pixels_to_inches(bbox[1], dpi))
        width = Inches(self.pixels_to_inches(bbox[2] - bbox[0], dpi))
        height = Inches(self.pixels_to_inches(bbox[3] - bbox[1], dpi))
        
        # Add a text box as placeholder
        textbox = slide.shapes.add_textbox(left, top, width, height)
        text_frame = textbox.text_frame
        text_frame.text = "[Image]"
        paragraph = text_frame.paragraphs[0]
        paragraph.alignment = PP_ALIGN.CENTER
        paragraph.font.size = Pt(12)
        paragraph.font.italic = True
    
    def add_table_element(
        self,
        slide,
        html_table: str,
        bbox: List[int],
        dpi: int = None
    ):
        """
        Add editable table to slide from HTML table string
        
        Args:
            slide: Target slide
            html_table: HTML table string
            bbox: Bounding box [x0, y0, x1, y1] in pixels
            dpi: DPI for conversion (default: 96)
        """
        dpi = dpi or self.DEFAULT_DPI
        
        # Parse HTML table
        try:
            table_data = HTMLTableParser.parse_html_table(html_table)
        except Exception as e:
            logger.error(f"Failed to parse HTML table: {str(e)}")
            return
        
        if not table_data or not table_data[0]:
            logger.warning("Empty table data")
            return
        
        rows = len(table_data)
        cols = len(table_data[0])
        
        # Convert bbox to inches
        left = Inches(self.pixels_to_inches(bbox[0], dpi))
        top = Inches(self.pixels_to_inches(bbox[1], dpi))
        width = Inches(self.pixels_to_inches(bbox[2] - bbox[0], dpi))
        height = Inches(self.pixels_to_inches(bbox[3] - bbox[1], dpi))
        
        try:
            # Add table shape
            table_shape = slide.shapes.add_table(rows, cols, left, top, width, height)
            table = table_shape.table
            
            # Calculate cell dimensions
            cell_width = width / cols
            cell_height = height / rows
            
            # Fill table with data
            for row_idx, row_data in enumerate(table_data):
                for col_idx, cell_text in enumerate(row_data):
                    if col_idx < cols:  # Safety check
                        cell = table.cell(row_idx, col_idx)
                        cell.text = cell_text
                        
                        # Style the cell
                        text_frame = cell.text_frame
                        text_frame.word_wrap = True
                        
                        # Calculate font size for table cell
                        # Use a conservative size to fit in cell
                        cell_height_px = (bbox[3] - bbox[1]) / rows
                        cell_width_px = (bbox[2] - bbox[0]) / cols
                        
                        # Estimate font size (smaller for tables)
                        font_size = min(18, max(8, cell_height_px * 0.3))
                        
                        for paragraph in text_frame.paragraphs:
                            paragraph.font.size = Pt(font_size)
                            paragraph.alignment = PP_ALIGN.CENTER
                            
                            # Header row (first row) should be bold
                            if row_idx == 0:
                                paragraph.font.bold = True
            
            logger.info(f"Added editable table: {rows}x{cols} at bbox {bbox}")
            
        except Exception as e:
            logger.error(f"Failed to create table: {str(e)}")
    
    def save(self, output_path: str):
        """
        Save presentation to file
        
        Args:
            output_path: Output file path
        """
        if not self.prs:
            raise ValueError("No presentation to save")
        
        # Ensure directory exists
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        
        self.prs.save(output_path)
        logger.info(f"Saved presentation to: {output_path}")
    
    def get_presentation(self) -> Presentation:
        """Get the current presentation object"""
        return self.prs

