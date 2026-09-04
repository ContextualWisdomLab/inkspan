from __future__ import annotations

from io import BytesIO
from xml.etree import ElementTree
from zipfile import ZipFile

from docx import Document

from inkspan_office import render_office_document

_WORD_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"


def test_page_layout_preserves_explicit_docx_page_breaks() -> None:
    """Prove the page-layout round trip keeps existing explicit page-break semantics."""

    rendered = render_office_document(
        {
            "format": "docx",
            "page_layout": {
                "paper_size": "letter",
                "orientation": "landscape",
                "margins_mm": {"top": 12, "right": 12, "bottom": 12, "left": 12},
            },
            "blocks": [
                {"type": "paragraph", "text": "Before page break"},
                {"type": "page_break"},
                {"type": "paragraph", "text": "After page break"},
            ],
        }
    )

    document = Document(BytesIO(rendered.data))
    paragraph_text = [paragraph.text for paragraph in document.paragraphs]
    assert "Before page break" in paragraph_text
    assert "After page break" in paragraph_text

    with ZipFile(BytesIO(rendered.data)) as package:
        document_root = ElementTree.fromstring(package.read("word/document.xml"))

    page_breaks = [
        element
        for element in document_root.findall(f".//{{{_WORD_NS}}}br")
        if element.attrib.get(f"{{{_WORD_NS}}}type") == "page"
    ]
    assert len(page_breaks) == 1
