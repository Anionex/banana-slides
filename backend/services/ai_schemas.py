"""
Pydantic models for structured JSON output from AI providers.

Used with Gemini's response_schema to get guaranteed valid JSON.
"""
from typing import List, Optional
from pydantic import BaseModel


# --- Outline schemas ---

class OutlinePage(BaseModel):
    title: str
    points: List[str]


class OutlineItem(BaseModel):
    """A single outline item: either a direct page (title+points) or a part containing pages."""
    title: Optional[str] = None
    points: Optional[List[str]] = None
    part: Optional[str] = None
    pages: Optional[List[OutlinePage]] = None


class OutlineResponse(BaseModel):
    items: List[OutlineItem]


# --- Page descriptions schema ---

class PageDescriptionsResponse(BaseModel):
    descriptions: List[str]


# --- Page content extraction schema ---

class PageContentResponse(BaseModel):
    title: str
    points: List[str]
    description: str


# --- Text attribute extraction schemas (used with image input) ---

class ColoredSegment(BaseModel):
    text: str
    color: str
    is_latex: Optional[bool] = None


class TextAttributeResponse(BaseModel):
    colored_segments: List[ColoredSegment]


class BatchTextAttributeItem(BaseModel):
    element_id: str
    text_content: str
    font_color: str
    is_bold: bool
    is_italic: bool
    is_underline: bool
    text_alignment: str


class BatchTextAttributeResponse(BaseModel):
    items: List[BatchTextAttributeItem]
