"""
Image utility functions
"""
from typing import Tuple
from PIL import Image


def check_image_resolution(image: Image.Image, expected_resolution: str) -> Tuple[str, bool]:
    """
    Check if the actual image resolution matches expected resolution.
    
    Args:
        image: PIL Image object
        expected_resolution: Expected resolution setting ("1K", "2K", "4K")
        
    Returns:
        Tuple of (actual_resolution_category, is_match)
    """
    max_dimension = max(image.width, image.height)
    
    # Determine actual resolution category
    if max_dimension < 1500:
        actual = "1K"
    elif max_dimension < 3000:
        actual = "2K"
    else:
        actual = "4K"
    
    is_match = actual == expected_resolution.upper()
    return actual, is_match
