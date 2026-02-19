"""
Abstract base class for image generation providers
"""
from abc import ABC, abstractmethod
from typing import Optional, List, Union
from PIL import Image


class ImageProvider(ABC):
    """Abstract base class for image generation"""

    @abstractmethod
    def generate_image(
        self,
        contents: List[Union[str, Image.Image]],
        aspect_ratio: str = "16:9",
        resolution: str = "2K",
        enable_thinking: bool = False,
        thinking_budget: int = 0
    ) -> Optional[Image.Image]:
        """
        Generate image from interleaved contents (text + images)

        Args:
            contents: Interleaved list of text strings and PIL Image objects,
                      e.g. ["text1", <Image>, "text2", <Image>, "text3"]
            aspect_ratio: Image aspect ratio (e.g., "16:9", "1:1", "4:3")
            resolution: Image resolution ("1K", "2K", "4K") - note: OpenAI format only supports 1K
            enable_thinking: If True, enable thinking/reasoning mode (GenAI only)
            thinking_budget: Thinking budget for the model (GenAI only)

        Returns:
            Generated PIL Image object, or None if failed
        """
        pass
