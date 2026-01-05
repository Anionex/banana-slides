"""
LaTeX 工具模块 - 处理 LaTeX 公式转换

提供以下功能：
1. 简单 LaTeX 转文本（转义字符、简单符号）
2. LaTeX 转 MathML
3. MathML 转 OMML（用于 PPTX）
"""
import re
import logging
from typing import Optional, Tuple

logger = logging.getLogger(__name__)

# LaTeX 转义字符映射
LATEX_ESCAPES = {
    r'\%': '%',
    r'\$': '$',
    r'\&': '&',
    r'\#': '#',
    r'\_': '_',
    r'\{': '{',
    r'\}': '}',
    r'\ ': ' ',
    r'\,': ' ',  # thin space
    r'\;': ' ',  # thick space
    r'\!': '',   # negative thin space
    r'\quad': '  ',
    r'\qquad': '    ',
}

# 常用 LaTeX 符号到 Unicode 映射
LATEX_SYMBOLS = {
    # 希腊字母
    r'\alpha': 'α', r'\beta': 'β', r'\gamma': 'γ', r'\delta': 'δ',
    r'\epsilon': 'ε', r'\zeta': 'ζ', r'\eta': 'η', r'\theta': 'θ',
    r'\iota': 'ι', r'\kappa': 'κ', r'\lambda': 'λ', r'\mu': 'μ',
    r'\nu': 'ν', r'\xi': 'ξ', r'\pi': 'π', r'\rho': 'ρ',
    r'\sigma': 'σ', r'\tau': 'τ', r'\upsilon': 'υ', r'\phi': 'φ',
    r'\chi': 'χ', r'\psi': 'ψ', r'\omega': 'ω',
    r'\Gamma': 'Γ', r'\Delta': 'Δ', r'\Theta': 'Θ', r'\Lambda': 'Λ',
    r'\Xi': 'Ξ', r'\Pi': 'Π', r'\Sigma': 'Σ', r'\Phi': 'Φ',
    r'\Psi': 'Ψ', r'\Omega': 'Ω',
    # 数学运算符
    r'\times': '×', r'\div': '÷', r'\pm': '±', r'\mp': '∓',
    r'\cdot': '·', r'\ast': '∗', r'\star': '☆',
    r'\leq': '≤', r'\geq': '≥', r'\neq': '≠', r'\approx': '≈',
    r'\equiv': '≡', r'\sim': '∼', r'\propto': '∝',
    r'\infty': '∞', r'\partial': '∂', r'\nabla': '∇',
    r'\sum': '∑', r'\prod': '∏', r'\int': '∫',
    r'\sqrt': '√', r'\angle': '∠', r'\degree': '°',
    # 箭头
    r'\leftarrow': '←', r'\rightarrow': '→', r'\leftrightarrow': '↔',
    r'\Leftarrow': '⇐', r'\Rightarrow': '⇒', r'\Leftrightarrow': '⇔',
    # 其他
    r'\ldots': '…', r'\cdots': '⋯', r'\vdots': '⋮',
    r'\forall': '∀', r'\exists': '∃', r'\in': '∈', r'\notin': '∉',
    r'\subset': '⊂', r'\supset': '⊃', r'\cup': '∪', r'\cap': '∩',
}

# 上标数字映射
SUPERSCRIPT_MAP = {
    '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
    '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
    '+': '⁺', '-': '⁻', '=': '⁼', '(': '⁽', ')': '⁾',
    'n': 'ⁿ', 'i': 'ⁱ',
}

# 下标数字映射
SUBSCRIPT_MAP = {
    '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄',
    '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉',
    '+': '₊', '-': '₋', '=': '₌', '(': '₍', ')': '₎',
    'a': 'ₐ', 'e': 'ₑ', 'o': 'ₒ', 'x': 'ₓ',
    'i': 'ᵢ', 'j': 'ⱼ', 'n': 'ₙ', 'm': 'ₘ',
}


def is_simple_latex(latex: str) -> bool:
    """
    判断是否是简单的 LaTeX（可以直接转换为文本）
    
    简单 LaTeX 包括：
    - 纯转义字符（如 10\%）
    - 简单符号（如 \alpha）
    - 简单上下标（如 x^2, x_1）
    """
    # 移除所有已知的简单模式
    test = latex
    
    # 移除转义字符
    for escape in LATEX_ESCAPES:
        test = test.replace(escape, '')
    
    # 移除符号
    for symbol in LATEX_SYMBOLS:
        test = test.replace(symbol, '')
    
    # 移除简单上下标 ^{...} 或 ^x
    test = re.sub(r'\^{[^{}]*}', '', test)
    test = re.sub(r'\^[0-9a-zA-Z]', '', test)
    
    # 移除简单下标 _{...} 或 _x
    test = re.sub(r'_{[^{}]*}', '', test)
    test = re.sub(r'_[0-9a-zA-Z]', '', test)
    
    # 如果剩余的都是普通字符，则是简单 LaTeX
    remaining = test.strip()
    # 检查是否还有未处理的 LaTeX 命令
    if '\\' in remaining and not remaining.replace('\\', '').isalnum():
        return False
    
    return True


def latex_to_text(latex: str) -> str:
    """
    将简单 LaTeX 转换为 Unicode 文本
    
    Args:
        latex: LaTeX 字符串
    
    Returns:
        转换后的文本
    """
    result = latex
    
    # 1. 处理转义字符
    for escape, char in LATEX_ESCAPES.items():
        result = result.replace(escape, char)
    
    # 2. 处理符号
    for symbol, char in LATEX_SYMBOLS.items():
        result = result.replace(symbol, char)
    
    # 3. 处理上标 ^{...} 或 ^x
    def convert_superscript(match):
        content = match.group(1) if match.group(1) else match.group(2)
        return ''.join(SUPERSCRIPT_MAP.get(c, c) for c in content)
    
    result = re.sub(r'\^{([^{}]*)}|\^([0-9a-zA-Z])', convert_superscript, result)
    
    # 4. 处理下标 _{...} 或 _x
    def convert_subscript(match):
        content = match.group(1) if match.group(1) else match.group(2)
        return ''.join(SUBSCRIPT_MAP.get(c, c) for c in content)
    
    result = re.sub(r'_{([^{}]*)}|_([0-9a-zA-Z])', convert_subscript, result)
    
    # 5. 移除剩余的 LaTeX 命令（如 \text{}, \mathrm{} 等）
    result = re.sub(r'\\(?:text|mathrm|mathbf|mathit|mathbb|mathcal){([^{}]*)}', r'\1', result)
    
    # 6. 清理多余的空格和花括号
    result = result.replace('{', '').replace('}', '')
    result = re.sub(r'\s+', ' ', result).strip()
    
    return result


def latex_to_mathml(latex: str) -> Optional[str]:
    """
    将 LaTeX 转换为 MathML
    
    Args:
        latex: LaTeX 字符串
    
    Returns:
        MathML 字符串，失败返回 None
    """
    try:
        import latex2mathml.converter
        mathml = latex2mathml.converter.convert(latex)
        return mathml
    except Exception as e:
        logger.warning(f"LaTeX to MathML conversion failed: {e}")
        return None


def mathml_to_omml(mathml: str) -> Optional[str]:
    """
    将 MathML 转换为 OMML (Office Math Markup Language)
    
    使用 Microsoft 的 MML2OMML.xsl 样式表进行转换
    
    Args:
        mathml: MathML 字符串
    
    Returns:
        OMML 字符串，失败返回 None
    """
    try:
        from lxml import etree
        import os
        
        # MML2OMML.xsl 样式表路径
        xsl_path = os.path.join(os.path.dirname(__file__), 'MML2OMML.xsl')
        
        if not os.path.exists(xsl_path):
            logger.warning(f"MML2OMML.xsl not found at {xsl_path}")
            return None
        
        # 解析 MathML
        mathml_tree = etree.fromstring(mathml.encode('utf-8'))
        
        # 加载 XSLT
        xslt_tree = etree.parse(xsl_path)
        transform = etree.XSLT(xslt_tree)
        
        # 转换
        omml_tree = transform(mathml_tree)
        return etree.tostring(omml_tree, encoding='unicode')
    
    except ImportError:
        logger.warning("lxml not installed, cannot convert to OMML")
        return None
    except Exception as e:
        logger.warning(f"MathML to OMML conversion failed: {e}")
        return None


def convert_latex_for_pptx(latex: str) -> Tuple[str, Optional[str]]:
    """
    为 PPTX 转换 LaTeX 公式
    
    Args:
        latex: LaTeX 字符串
    
    Returns:
        (text_fallback, omml) 元组
        - text_fallback: 文本回退方案（总是有值）
        - omml: OMML 字符串（如果转换成功）
    """
    # 总是生成文本回退
    text_fallback = latex_to_text(latex)
    
    # 对于简单 LaTeX，不需要 OMML
    if is_simple_latex(latex):
        return text_fallback, None
    
    # 尝试生成 OMML
    mathml = latex_to_mathml(latex)
    if mathml:
        omml = mathml_to_omml(mathml)
        if omml:
            return text_fallback, omml
    
    return text_fallback, None

