from zipfile import ZipFile

from PIL import Image

from services.export_service import ExportService
from services.image_editability.text_attribute_extractors import ColoredSegment, TextStyleResult
from utils.pptx_builder import PPTXBuilder
from utils.pptx_math import latex_to_display_text


def _slide_xml(pptx_path):
    with ZipFile(pptx_path) as archive:
        return archive.read("ppt/slides/slide1.xml").decode("utf-8")


def test_builder_writes_native_omml_equation_instead_of_raw_tex(tmp_path):
    builder = PPTXBuilder()
    builder.create_presentation()
    slide = builder.add_blank_slide()

    assert builder.add_math_element(
        slide=slide,
        latex=r"\frac{x^2}{y_1}",
        bbox=[10, 10, 180, 60],
    )

    output = tmp_path / "equation.pptx"
    builder.save(str(output))
    slide_xml = _slide_xml(output)

    assert "<m:oMath" in slide_xml
    assert "<m:oMathPara" not in slide_xml
    assert "<m:f>" in slide_xml
    assert "<m:sSup>" in slide_xml
    assert "<m:sSub>" in slide_xml
    assert slide_xml.index("<m:oMath") < slide_xml.index("<a:endParaRPr")
    assert r"\frac" not in slide_xml


def test_builder_applies_math_color_to_omml_runs(tmp_path):
    builder = PPTXBuilder()
    builder.create_presentation()
    slide = builder.add_blank_slide()
    style = TextStyleResult(font_color_rgb=(255, 0, 0))

    assert builder.add_math_element(
        slide=slide,
        latex=r"x^2",
        bbox=[10, 10, 180, 60],
        text_style=style,
    )

    output = tmp_path / "colored-equation.pptx"
    builder.save(str(output))
    slide_xml = _slide_xml(output)

    assert "<m:rPr><a:rPr" in slide_xml
    assert '<a:srgbClr val="FF0000"/>' in slide_xml


def test_single_character_script_argument_does_not_consume_next_script(tmp_path):
    builder = PPTXBuilder()
    builder.create_presentation()
    slide = builder.add_blank_slide()

    assert builder.add_math_element(
        slide=slide,
        latex=r"x^2_3",
        bbox=[10, 10, 180, 60],
    )

    output = tmp_path / "subsup-equation.pptx"
    builder.save(str(output))
    slide_xml = _slide_xml(output)

    assert "<m:sSubSup>" in slide_xml
    assert "<m:sup><m:r>" in slide_xml
    assert "<m:sub><m:r>" in slide_xml


def test_latex_display_fallback_does_not_expose_raw_tex_commands():
    fallback = latex_to_display_text(r"\begin{matrix}a & b\end{matrix}")

    assert "\\" not in fallback
    assert "{" not in fallback
    assert "}" not in fallback


def test_mixed_latex_segments_use_display_text_for_plain_text_rendering(tmp_path):
    builder = PPTXBuilder()
    builder.create_presentation()
    slide = builder.add_blank_slide()
    style = TextStyleResult(
        colored_segments=[
            ColoredSegment(text="Area = "),
            ColoredSegment(text="x^2", is_latex=True),
        ]
    )

    builder.add_text_element(
        slide=slide,
        text="Area = x^2",
        bbox=[10, 10, 180, 60],
        text_style=style,
    )

    output = tmp_path / "mixed-segments.pptx"
    builder.save(str(output))
    slide_xml = _slide_xml(output)

    assert "Area = " in slide_xml
    assert "x²" in slide_xml
    assert "x^2" not in slide_xml


def test_text_fallback_can_disable_redundant_math_conversion(tmp_path, monkeypatch):
    builder = PPTXBuilder()
    builder.create_presentation()
    slide = builder.add_blank_slide()
    style = TextStyleResult(
        colored_segments=[ColoredSegment(text=r"\unsupported{x}", is_latex=True)]
    )
    calls = []

    def fake_add_math_element(*args, **kwargs):
        calls.append((args, kwargs))
        return False

    monkeypatch.setattr(builder, "add_math_element", fake_add_math_element)
    builder.add_text_element(
        slide=slide,
        text=r"\unsupported{x}",
        bbox=[10, 10, 180, 60],
        text_style=style,
        allow_math_conversion=False,
    )

    output = tmp_path / "fallback.pptx"
    builder.save(str(output))
    slide_xml = _slide_xml(output)

    assert calls == []
    assert "unsupportedx" in slide_xml
    assert r"\unsupported" not in slide_xml


class _BBox:
    def __init__(self, x0, y0, x1, y1):
        self.x0 = x0
        self.y0 = y0
        self.x1 = x1
        self.y1 = y1

    @property
    def area(self):
        return (self.x1 - self.x0) * (self.y1 - self.y0)


class _EquationElement:
    element_id = "eq_0"
    element_type = "equation"
    content = r"\frac{E}{mc^2}"
    image_path = None
    children = []
    inpainted_background_path = None

    def __init__(self):
        self.bbox = _BBox(40, 30, 260, 90)
        self.bbox_global = self.bbox


class _EditableImage:
    width = 300
    height = 120
    clean_background = None

    def __init__(self, image_path):
        self.image_path = image_path
        self.elements = [_EquationElement()]


def test_editable_export_renders_equation_element_as_native_omml(tmp_path):
    background = tmp_path / "slide.png"
    Image.new("RGB", (300, 120), "white").save(background)
    output = tmp_path / "editable-equation.pptx"

    _, warnings = ExportService.create_editable_pptx_with_recursive_analysis(
        editable_images=[_EditableImage(str(background))],
        output_file=str(output),
        slide_width_pixels=300,
        slide_height_pixels=120,
        fail_fast=True,
    )

    slide_xml = _slide_xml(output)
    assert not warnings.text_render_failed
    assert "<m:oMath" in slide_xml
    assert "<m:oMathPara" not in slide_xml
    assert "<m:f>" in slide_xml
    assert r"\frac" not in slide_xml
