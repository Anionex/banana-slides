"""Embed the bundled, editable Noto font (EOT packaging used by PPT Restore)."""
import struct
from functools import lru_cache

from fontTools.ttLib import TTFont
from pptx.opc.package import Part
from pptx.opc.packuri import PackURI
from pptx.oxml.xmlchemy import OxmlElement

from utils.text_only_layout import FONT_PATH, font_family


@lru_cache(maxsize=1)
def _font_data():
    data = FONT_PATH.read_bytes()
    with TTFont(FONT_PATH) as font:
        os2 = font['OS/2']
        if os2.fsType & (0x0002 | 0x0200) or (os2.fsType and not os2.fsType & 0x0008):
            raise ValueError('The configured text font does not allow editable embedding')
        panose = bytes(getattr(os2.panose, name) for name in (
            'bFamilyType', 'bSerifStyle', 'bWeight', 'bProportion', 'bContrast',
            'bStrokeVariation', 'bArmStyle', 'bLetterForm', 'bMidline', 'bXHeight'))
        header = struct.pack('<LLLL10sBBLHHLLLLLLL4L', 0, len(data), 0x00020002, 0,
                             panose, 1, os2.fsSelection & 1, os2.usWeightClass,
                             os2.fsType, 0x504C,
                             *[getattr(os2, f'ulUnicodeRange{i}', 0) for i in range(1, 5)],
                             os2.ulCodePageRange1, os2.ulCodePageRange2,
                             font['head'].checkSumAdjustment, 0, 0, 0, 0)
        names = b''
        for name_id in (1, 2, 5, 4):
            value = ((font['name'].getDebugName(name_id) or '') + '\0').encode('utf-16-le')
            names += struct.pack('<HH', 0, len(value)) + value
    result = bytearray(header + names + struct.pack('<HHLLHHLL', 0, 0, 0, 0, 0, 0, 0, 0) + data)
    struct.pack_into('<L', result, 0, len(result))
    return bytes(result)


def embed_text_font(prs):
    prs._element.set('embedTrueTypeFonts', '1')
    prs._element.set('saveSubsetFonts', '0')
    font = Part(PackURI('/ppt/fonts/banana-text.fntdata'), 'application/x-fontdata',
                prs.part.package, _font_data())
    rid = prs.part.relate_to(font, 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/font')
    listing = OxmlElement('p:embeddedFontLst')
    entry = OxmlElement('p:embeddedFont')
    face = OxmlElement('p:font')
    face.set('typeface', font_family())
    regular = OxmlElement('p:regular')
    regular.set('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id', rid)
    entry.extend([face, regular])
    listing.append(entry)
    # CT_Presentation requires embeddedFontLst before defaultTextStyle.
    default = prs._element.find('{http://schemas.openxmlformats.org/presentationml/2006/main}defaultTextStyle')
    if default is None:
        prs._element.append(listing)
    else:
        default.addprevious(listing)
