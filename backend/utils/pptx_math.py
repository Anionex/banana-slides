"""
PowerPoint native math helpers.

The editable PPTX exporter uses python-pptx for shape placement, but
python-pptx does not expose an equation API.  These helpers generate the
Office Math (OMML) XML PowerPoint stores for native equations.
"""
import logging
import re
from functools import lru_cache
from typing import Iterable, List, Optional, Set

from pptx.oxml.xmlchemy import OxmlElement
from pptx.oxml.ns import qn

from utils.latex_utils import LATEX_ESCAPES, LATEX_SYMBOLS, latex_to_text

logger = logging.getLogger(__name__)


_WRAPPER_PATTERNS = (
    (re.compile(r"^\s*\$\$(.*)\$\$\s*$", re.DOTALL), 1),
    (re.compile(r"^\s*\$(.*)\$\s*$", re.DOTALL), 1),
    (re.compile(r"^\s*\\\[(.*)\\\]\s*$", re.DOTALL), 1),
    (re.compile(r"^\s*\\\((.*)\\\)\s*$", re.DOTALL), 1),
)

_PATH_OR_URL_PATTERN = re.compile(
    r"^(?:[A-Za-z][A-Za-z0-9+.-]*://|[A-Za-z]:[\\/]|/|~[\\/]|\.{1,2}[\\/]|\\\\)"
)
_WINDOWS_RELATIVE_PATH_PATTERN = re.compile(
    r"^[^\\/:*?\"<>|\s{}^+=]+(?:\\[^\\/:*?\"<>|\s{}^+=]+)+$"
)
_UNICODE_MATH_PATTERN = re.compile(r"[∀∃∈∉≤≥≠≈∑∏∫∞∂∇πΠΣ√]")
_UNICODE_SCRIPT_PATTERN = re.compile(r"[⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻⁼⁽⁾ⁿⁱ₀₁₂₃₄₅₆₇₈₉₊₋₌₍₎ₐₑₒₓᵢⱼₙₘ]")
_OCR_OPERATOR_WORD_PATTERN = re.compile(r"\b(?:geq?|leq?|neq|forall|exists)\b", re.IGNORECASE)


@lru_cache(maxsize=1)
def _supported_latex_commands():
    return frozenset(
        set(LATEX_SYMBOLS)
        | {r"\frac", r"\sqrt", r"\left", r"\right"}
        | set(_LatexOmmlParser._LIMIT_COMMANDS)
        | set(_LatexOmmlParser._FUNCTION_COMMANDS)
        | _LatexOmmlParser._TEXT_COMMANDS
    )


def normalize_latex_math(source: str) -> str:
    """Remove common math delimiters from a LaTeX source string."""
    text = (source or "").strip()
    for pattern, group in _WRAPPER_PATTERNS:
        match = pattern.match(text)
        if match:
            return match.group(group).strip()
    return text


def normalize_ocr_math_tokens(source: str) -> str:
    """Restore common LaTeX operators whose backslash was dropped by OCR."""
    text = source or ""
    replacements = (
        (r"(?<!\\)\bgeq\b", r"\\geq"),
        (r"(?<!\\)\bge\b", r"\\geq"),
        (r"(?<!\\)\bleq\b", r"\\leq"),
        (r"(?<!\\)\ble\b", r"\\leq"),
        (r"(?<!\\)\bneq\b", r"\\neq"),
        (r"(?<!\\)\bforall\b", r"\\forall"),
        (r"(?<!\\)\bexists\b", r"\\exists"),
    )
    for pattern, replacement in replacements:
        text = re.sub(pattern, replacement, text, flags=re.IGNORECASE)
    return text


def latex_to_display_text(source: str) -> str:
    """Return a non-TeX fallback for unsupported equation rendering."""
    text = normalize_ocr_math_tokens(normalize_latex_math(source))
    previous = None
    while previous != text:
        previous = text
        text = re.sub(r"\\frac\s*\{([^{}]+)\}\s*\{([^{}]+)\}", r"(\1)/(\2)", text)
    text = re.sub(r"\\sqrt\s*\{([^{}]+)\}", r"√(\1)", text)
    text = re.sub(r"\\arg\s*\\max", r"arg max", text)
    text = latex_to_text(text)
    text = re.sub(r"\\(?:left|right)\s*\.?", "", text)
    text = re.sub(r"\\([A-Za-z]+)", r"\1", text)
    text = text.replace("\\", "").replace("{", "").replace("}", "")
    return re.sub(r"\s+", " ", text).strip()


def looks_like_latex_math(source: str) -> bool:
    """Return True when the text content itself looks like a LaTeX formula."""
    raw_text = (source or "").strip()
    if not raw_text:
        return False
    if _PATH_OR_URL_PATTERN.match(raw_text) or _WINDOWS_RELATIVE_PATH_PATTERN.match(raw_text):
        return False

    for pattern, _ in _WRAPPER_PATTERNS:
        if pattern.match(raw_text):
            return True

    text = normalize_latex_math(raw_text)
    if not text:
        return False

    if any(command in text for command in _supported_latex_commands()):
        return True

    if "\\" in text:
        return bool(
            re.search(r"\\[A-Za-z]+", text)
            and (
                text.startswith("\\")
                or any(token in text for token in ("{", "}", "_", "^", "&", "=", "+", "-", "*", "/"))
            )
        )

    if _UNICODE_MATH_PATTERN.search(text) and (
        re.search(r"[A-Za-z0-9]\s*[(=,+\-*/]", text)
        or _UNICODE_SCRIPT_PATTERN.search(text)
        or re.search(r"[_^]", text)
    ):
        return True

    if (
        _OCR_OPERATOR_WORD_PATTERN.search(text)
        and re.search(r"[_^=()+\-*/(),]", text)
        and not re.search(r"\b[A-Za-z]{4,}\b", text)
    ):
        return True

    if not re.search(r"[_^=+\-*/]", text):
        return False

    if re.search(r"\b[A-Za-z]{3,}\b", text):
        return False

    return bool(
        re.fullmatch(r"[A-Za-z0-9\s+\-*/=().,{}_^]+", text)
        and (
            re.search(r"[_^]\s*(?:\{[^{}]+\}|[A-Za-z0-9+\-=()])", text)
            or re.search(r"[A-Za-z0-9)]\s*[+\-*/=]\s*[A-Za-z0-9(]", text)
        )
    )


def latex_to_omml(source: str):
    """
    Convert a useful subset of LaTeX math into an ``m:oMath`` element.

    Supported structures include ordinary runs, common math symbols, grouped
    expressions, superscripts/subscripts, fractions, square roots, text/mathrm,
    and common large operators with limits. Unsupported commands return None so
    callers can use a readable fallback instead of exposing raw TeX.
    """
    parser = _LatexOmmlParser(normalize_ocr_math_tokens(normalize_latex_math(source)))
    try:
        nodes = parser.parse()
    except _UnsupportedLatex as exc:
        logger.info("Unsupported LaTeX for native PPTX equation: %s", exc)
        return None
    except Exception as exc:
        logger.warning("Failed to convert LaTeX to OMML: %s", exc)
        return None

    if not nodes:
        return None

    math = OxmlElement("m:oMath")
    _append_children(math, nodes)
    return math


class _UnsupportedLatex(ValueError):
    pass


class _LatexOmmlParser:
    _LIMIT_COMMANDS = {
        r"\sum": "∑",
        r"\prod": "∏",
        r"\int": "∫",
    }

    _TEXT_COMMANDS = {r"\text", r"\mathrm", r"\mathbf", r"\mathit", r"\mathbb", r"\mathcal"}
    _FUNCTION_COMMANDS = {
        r"\arg": "arg",
        r"\sin": "sin",
        r"\cos": "cos",
        r"\tan": "tan",
        r"\log": "log",
        r"\ln": "ln",
        r"\lim": "lim",
        r"\min": "min",
        r"\max": "max",
    }

    def __init__(self, source: str):
        self.source = source
        self.pos = 0

    def parse(self):
        nodes = self._parse_expression(stop_chars=set())
        self._skip_spaces()
        if self.pos != len(self.source):
            raise _UnsupportedLatex(f"unexpected token at {self.pos}")
        return nodes

    def _parse_expression(self, stop_chars: Set[str]) -> List:
        nodes = []
        text_buffer = []

        def flush_text():
            if text_buffer:
                nodes.append(_math_run("".join(text_buffer)))
                text_buffer.clear()

        while self.pos < len(self.source):
            char = self.source[self.pos]
            if char in stop_chars:
                break
            if char.isspace():
                text_buffer.append(" ")
                self.pos += 1
                continue
            if char == "{":
                flush_text()
                group_nodes = self._parse_group()
                lookahead = self.pos
                while lookahead < len(self.source) and self.source[lookahead].isspace():
                    lookahead += 1
                if lookahead < len(self.source) and self.source[lookahead] in "_^":
                    nodes.append(self._parse_scripts(_wrap_as_group(group_nodes)))
                else:
                    nodes.extend(group_nodes)
                continue
            if char in "}&":
                break
            flush_text()
            atom = self._parse_atom()
            nodes.append(self._parse_scripts(atom))

        flush_text()
        return _coalesce_runs(nodes)

    def _parse_group(self) -> List:
        self._expect("{")
        nodes = self._parse_expression(stop_chars={"}"})
        self._expect("}")
        return nodes

    def _parse_atom(self):
        if self.pos >= len(self.source):
            raise _UnsupportedLatex("unexpected end of input")
        char = self.source[self.pos]
        if char == "\\":
            return self._parse_command()
        if char == "{":
            return _wrap_as_group(self._parse_group())
        self.pos += 1
        return _math_run(char)

    def _parse_command(self):
        command = self._read_command()

        if command == r"\frac":
            numerator = self._parse_required_group("fraction numerator")
            denominator = self._parse_required_group("fraction denominator")
            return _fraction(numerator, denominator)

        if command == r"\sqrt":
            degree = None
            self._skip_spaces()
            if self._peek("["):
                self.pos += 1
                degree = self._parse_expression(stop_chars={"]"})
                self._expect("]")
            radicand = self._parse_required_group("square root radicand")
            return _radical(radicand, degree)

        if command in self._TEXT_COMMANDS:
            content = self._parse_required_group("text command")
            return _wrap_as_group(content)

        if command in {r"\left", r"\right"}:
            self._skip_spaces()
            if self._peek("."):
                self.pos += 1
                return _math_run("")
            return self._parse_atom()

        if command in self._FUNCTION_COMMANDS:
            return _math_run(self._FUNCTION_COMMANDS[command])

        if command in self._LIMIT_COMMANDS:
            return _math_run(self._LIMIT_COMMANDS[command])

        if command in LATEX_SYMBOLS:
            return _math_run(LATEX_SYMBOLS[command])

        if command in LATEX_ESCAPES:
            return _math_run(LATEX_ESCAPES[command])

        raise _UnsupportedLatex(f"unsupported command {command}")

    def _parse_scripts(self, base):
        subscript = None
        superscript = None

        while True:
            self._skip_spaces()
            if self._peek("_"):
                if subscript is not None:
                    raise _UnsupportedLatex("duplicate subscript")
                self.pos += 1
                subscript = self._parse_script_argument()
            elif self._peek("^"):
                if superscript is not None:
                    raise _UnsupportedLatex("duplicate superscript")
                self.pos += 1
                superscript = self._parse_script_argument()
            else:
                break

        if subscript is not None and superscript is not None:
            return _sub_sup(base, subscript, superscript)
        if subscript is not None:
            return _subscript(base, subscript)
        if superscript is not None:
            return _superscript(base, superscript)
        return base

    def _parse_script_argument(self) -> List:
        self._skip_spaces()
        if self._peek("{"):
            return self._parse_group()
        atom = self._parse_atom()
        return [atom]

    def _parse_required_group(self, label: str) -> List:
        self._skip_spaces()
        if not self._peek("{"):
            raise _UnsupportedLatex(f"missing {label}")
        return self._parse_group()

    def _read_command(self) -> str:
        self._expect("\\")
        start = self.pos
        while self.pos < len(self.source) and self.source[self.pos].isalpha():
            self.pos += 1
        if self.pos == start:
            if self.pos >= len(self.source):
                raise _UnsupportedLatex("dangling backslash")
            self.pos += 1
        return "\\" + self.source[start:self.pos]

    def _skip_spaces(self):
        while self.pos < len(self.source) and self.source[self.pos].isspace():
            self.pos += 1

    def _peek(self, token: str) -> bool:
        return self.source.startswith(token, self.pos)

    def _expect(self, token: str):
        if not self._peek(token):
            raise _UnsupportedLatex(f"expected {token!r} at {self.pos}")
        self.pos += len(token)


def _math_run(text: str):
    run = OxmlElement("m:r")
    t = OxmlElement("m:t")
    t.text = text
    run.append(t)
    return run


def _append_children(parent, nodes: Iterable) -> None:
    for node in nodes:
        parent.append(node)


def _coalesce_runs(nodes: List) -> List:
    result = []
    pending = []
    for node in nodes:
        if node.tag == qn("m:r"):
            text_node = node.find(qn("m:t"))
            text = text_node.text if text_node is not None and text_node.text else ""
            pending.append(text)
            continue
        if pending:
            result.append(_math_run("".join(pending)))
            pending.clear()
        result.append(node)
    if pending:
        result.append(_math_run("".join(pending)))
    return result


def _wrap_as_group(nodes: List):
    group = OxmlElement("m:e")
    _append_children(group, nodes or [_math_run("")])
    return group


def _child_container(tag: str, nodes: List):
    elem = OxmlElement(tag)
    _append_children(elem, nodes or [_math_run("")])
    return elem


def _node_as_expression(node):
    if node.tag == qn("m:e"):
        return node
    elem = OxmlElement("m:e")
    elem.append(node)
    return elem


def _fraction(numerator: List, denominator: List):
    elem = OxmlElement("m:f")
    props = OxmlElement("m:fPr")
    frac_type = OxmlElement("m:type")
    frac_type.set(qn("m:val"), "bar")
    props.append(frac_type)
    elem.append(props)
    elem.append(_child_container("m:num", numerator))
    elem.append(_child_container("m:den", denominator))
    return elem


def _radical(radicand: List, degree: Optional[List]):
    elem = OxmlElement("m:rad")
    props = OxmlElement("m:radPr")
    if degree is None:
        deg_hide = OxmlElement("m:degHide")
        deg_hide.set(qn("m:val"), "1")
        props.append(deg_hide)
    elem.append(props)
    elem.append(_child_container("m:deg", degree or []))
    elem.append(_child_container("m:e", radicand))
    return elem


def _subscript(base, subscript: List):
    elem = OxmlElement("m:sSub")
    elem.append(_node_as_expression(base))
    elem.append(_child_container("m:sub", subscript))
    return elem


def _superscript(base, superscript: List):
    elem = OxmlElement("m:sSup")
    elem.append(_node_as_expression(base))
    elem.append(_child_container("m:sup", superscript))
    return elem


def _sub_sup(base, subscript: List, superscript: List):
    elem = OxmlElement("m:sSubSup")
    elem.append(_node_as_expression(base))
    elem.append(_child_container("m:sub", subscript))
    elem.append(_child_container("m:sup", superscript))
    return elem
