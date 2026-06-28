from zipfile import ZipFile

from PIL import Image

from services.export_service import ExportService
from services.image_editability.text_attribute_extractors import ColoredSegment, TextStyleResult
from utils.pptx_builder import PPTXBuilder
from utils.pptx_math import latex_to_display_text, looks_like_latex_math


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

    assert "<a14:m" in slide_xml
    assert "<m:oMath" in slide_xml
    assert "<m:oMathPara" in slide_xml
    assert "<m:f>" in slide_xml
    assert "<m:sSup>" in slide_xml
    assert "<m:sSub>" in slide_xml
    assert slide_xml.index("<a14:m") < slide_xml.index("<m:oMathPara")
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

    assert "<m:r><a:rPr" in slide_xml
    assert "<m:rPr><a:rPr" not in slide_xml
    assert '<a:srgbClr val="FF0000"/>' in slide_xml


def test_game_theory_latex_lines_are_native_omml_not_raw_tex(tmp_path):
    builder = PPTXBuilder()
    builder.create_presentation()
    slide = builder.add_blank_slide()
    formulas = [
        r"U_i(s)=\pi_i(S_1,\dots,S_n)",
        r"s_i^* = \arg\max_{s_j} U_i(s_i, s_{-i})",
        r"\forall i, U_i(s^*) \geq U_i(s_i, s_{-i}^*)",
    ]

    for idx, formula in enumerate(formulas):
        assert builder.add_math_element(
            slide=slide,
            latex=formula,
            bbox=[10, 10 + idx * 35, 280, 40 + idx * 35],
        )

    output = tmp_path / "game-theory-equations.pptx"
    builder.save(str(output))
    slide_xml = _slide_xml(output)

    assert slide_xml.count("<a14:m") == len(formulas)
    assert slide_xml.count("<m:oMathPara") == len(formulas)
    assert slide_xml.count("<m:oMath>") == len(formulas)
    for raw_tex in (r"\pi", r"\dots", r"\arg", r"\max", r"\forall", r"\geq"):
        assert raw_tex not in slide_xml
    assert "π" in slide_xml
    assert "…" in slide_xml
    assert "arg" in slide_xml
    assert "∀" in slide_xml
    assert "≥" in slide_xml


def test_latex_math_detection_uses_content_not_metadata():
    assert looks_like_latex_math(r"\frac{x^2}{y_1}")
    assert looks_like_latex_math(r"\begin{matrix}a & b\end{matrix}")
    assert looks_like_latex_math(r"$x^2 + y^2 = z^2$")
    assert looks_like_latex_math(r"E = mc^2")
    assert looks_like_latex_math("∀ i, Uᵢ(s^*) ge Uᵢ(sᵢ, s₋ᵢ^*)")
    assert not looks_like_latex_math("Area = x^2")
    assert not looks_like_latex_math("Revenue formula")
    assert not looks_like_latex_math("https://example.com/math/x^2")
    assert not looks_like_latex_math(r"C:\Users\me\x_1")
    assert not looks_like_latex_math(r"folder\x_1")
    assert not looks_like_latex_math(r"folder\subdir\value_2")
    assert not looks_like_latex_math("/tmp/export/x_1")


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


def test_math_element_uses_only_native_formula_shape_without_visible_fallback(tmp_path):
    builder = PPTXBuilder()
    builder.create_presentation()
    slide = builder.add_blank_slide()
    style = TextStyleResult(font_color_rgb=(210, 250, 100))

    assert builder.add_math_element(
        slide=slide,
        latex=r"\forall i, U_i(s^*) ge U_i(s_i, s_{-i}^*)",
        bbox=[10, 10, 280, 60],
        text_style=style,
    )

    output = tmp_path / "equation-preview.pptx"
    builder.save(str(output))
    slide_xml = _slide_xml(output)

    assert "<a14:m" in slide_xml
    assert "<mc:AlternateContent" not in slide_xml
    assert "<mc:Fallback>" not in slide_xml
    assert "<p:pic>" not in slide_xml
    assert "<a:t>" not in slide_xml
    assert " ge " not in slide_xml
    assert r"\forall" not in slide_xml
    assert r"\ge" not in slide_xml
    assert '<a:srgbClr val="D2FA64"/>' in slide_xml


def test_formula_fallback_uses_sanitized_text_not_raw_style_segments(tmp_path):
    builder = PPTXBuilder()
    builder.create_presentation()
    slide = builder.add_blank_slide()
    raw_formula = r"\unsupported{x}"
    fallback = latex_to_display_text(raw_formula)
    style = TextStyleResult(
        colored_segments=[ColoredSegment(text=raw_formula, color_rgb=(120, 200, 40))]
    )

    builder.add_text_element(
        slide=slide,
        text=fallback,
        bbox=[10, 10, 180, 60],
        text_style=style,
        allow_math_conversion=False,
    )

    output = tmp_path / "sanitized-fallback.pptx"
    builder.save(str(output))
    slide_xml = _slide_xml(output)

    assert fallback in slide_xml
    assert raw_formula not in slide_xml


class _BBox:
    def __init__(self, x0, y0, x1, y1):
        self.x0 = x0
        self.y0 = y0
        self.x1 = x1
        self.y1 = y1

    @property
    def area(self):
        return (self.x1 - self.x0) * (self.y1 - self.y0)


class _EditableElement:
    element_id = "elem_0"
    element_type = "text"
    content = ""
    image_path = None
    children = []
    inpainted_background_path = None

    def __init__(self, element_type, content):
        self.element_type = element_type
        self.content = content
        self.bbox = _BBox(40, 30, 260, 90)
        self.bbox_global = self.bbox


class _EditableImage:
    width = 300
    height = 120
    clean_background = None

    def __init__(self, image_path, elements):
        self.image_path = image_path
        self.elements = elements


def test_editable_export_renders_latex_text_content_as_native_omml(tmp_path):
    background = tmp_path / "slide.png"
    Image.new("RGB", (300, 120), "white").save(background)
    output = tmp_path / "editable-text-formula.pptx"

    _, warnings = ExportService.create_editable_pptx_with_recursive_analysis(
        editable_images=[
            _EditableImage(
                str(background),
                [_EditableElement("text", r"\frac{E}{mc^2}")]
            )
        ],
        output_file=str(output),
        slide_width_pixels=300,
        slide_height_pixels=120,
        fail_fast=True,
    )

    slide_xml = _slide_xml(output)
    assert not warnings.text_render_failed
    assert "<a14:m" in slide_xml
    assert "<m:oMath" in slide_xml
    assert "<m:oMathPara" in slide_xml
    assert "<m:f>" in slide_xml
    assert r"\frac" not in slide_xml


def test_editable_export_prefers_latex_text_segments_for_formula_source(tmp_path):
    output = tmp_path / "editable-styled-formula-source.pptx"
    builder = PPTXBuilder()
    builder.create_presentation()
    slide = builder.add_blank_slide()
    element = _EditableElement("text", "Vi,Ui(s*) ge Ui(si,s*i)")
    style = TextStyleResult(
        font_color_rgb=(210, 250, 100),
        colored_segments=[
            ColoredSegment(text=r"\forall i, U_i(s^*) \geq U_i(s_i, s_{-i}^*)")
        ],
    )

    ExportService._add_editable_elements_to_slide(
        builder=builder,
        slide=slide,
        elements=[element],
        text_styles_cache={element.element_id: style},
        fail_fast=True,
    )
    builder.save(str(output))

    slide_xml = _slide_xml(output)
    assert "<a14:m" in slide_xml
    assert "<mc:AlternateContent" not in slide_xml
    assert "<mc:Fallback>" not in slide_xml
    assert "<m:t>∀i,</m:t>" in slide_xml
    assert "<a:t>" not in slide_xml
    assert "Vi,Ui" not in slide_xml
    assert " ge " not in slide_xml
    assert r"\forall" not in slide_xml
    assert r"\geq" not in slide_xml


def test_equation_metadata_without_latex_content_stays_plain_text(tmp_path):
    background = tmp_path / "slide.png"
    Image.new("RGB", (300, 120), "white").save(background)
    output = tmp_path / "metadata-only-equation.pptx"

    ExportService.create_editable_pptx_with_recursive_analysis(
        editable_images=[
            _EditableImage(
                str(background),
                [_EditableElement("equation", "Revenue formula")]
            )
        ],
        output_file=str(output),
        slide_width_pixels=300,
        slide_height_pixels=120,
        fail_fast=True,
    )

    slide_xml = _slide_xml(output)
    assert "<m:oMath" not in slide_xml
    assert "Revenue formula" in slide_xml

