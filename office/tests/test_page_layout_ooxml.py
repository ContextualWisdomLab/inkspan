from __future__ import annotations

from io import BytesIO
from xml.etree import ElementTree
from zipfile import ZipFile

from docx.shared import Mm

from inkspan_office import render_office_document

_WORD_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"


def _word_attr(name: str) -> str:
    return f"{{{_WORD_NS}}}{name}"


def test_page_layout_emits_exact_wordprocessingml_section_properties() -> None:
    """Bind the public layout contract to its exact WordprocessingML representation."""

    rendered = render_office_document(
        {
            "format": "docx",
            "page_layout": {
                "paper_size": "a4",
                "orientation": "landscape",
                "margins_mm": {"top": 10, "right": 20, "bottom": 30, "left": 40},
            },
            "blocks": [{"type": "paragraph", "text": "OOXML layout"}],
        }
    )

    with ZipFile(BytesIO(rendered.data)) as package:
        root = ElementTree.fromstring(package.read("word/document.xml"))

    section = root.find(f".//{{{_WORD_NS}}}sectPr")
    assert section is not None
    page_size = section.find(f"{{{_WORD_NS}}}pgSz")
    page_margins = section.find(f"{{{_WORD_NS}}}pgMar")
    assert page_size is not None
    assert page_margins is not None

    assert page_size.attrib[_word_attr("w")] == str(Mm(297).twips)
    assert page_size.attrib[_word_attr("h")] == str(Mm(210).twips)
    assert page_size.attrib[_word_attr("orient")] == "landscape"
    assert page_margins.attrib[_word_attr("top")] == str(Mm(10).twips)
    assert page_margins.attrib[_word_attr("right")] == str(Mm(20).twips)
    assert page_margins.attrib[_word_attr("bottom")] == str(Mm(30).twips)
    assert page_margins.attrib[_word_attr("left")] == str(Mm(40).twips)
