from __future__ import annotations

from io import BytesIO

import pytest
from docx import Document
from docx.enum.section import WD_ORIENT
from docx.shared import Mm

from inkspan_office import OfficeDocumentError, render_office_document


def test_render_docx_applies_bounded_page_layout() -> None:
    rendered = render_office_document(
        {
            "format": "docx",
            "page_layout": {
                "paper_size": "a4",
                "orientation": "landscape",
                "margins_mm": {"top": 10, "right": 20, "bottom": 30, "left": 40},
            },
            "blocks": [{"type": "paragraph", "text": "Layout contract"}],
        }
    )

    document = Document(BytesIO(rendered.data))
    assert len(document.sections) == 1
    section = document.sections[0]
    assert section.orientation == WD_ORIENT.LANDSCAPE
    assert section.page_width == Mm(297)
    assert section.page_height == Mm(210)
    assert section.top_margin == Mm(10)
    assert section.right_margin == Mm(20)
    assert section.bottom_margin == Mm(30)
    assert section.left_margin == Mm(40)


@pytest.mark.parametrize(
    "page_layout",
    [
        {"paper_size": "a4", "orientation": "portrait"},
        {
            "paper_size": "A4",
            "orientation": "portrait",
            "margins_mm": {"top": 10, "right": 10, "bottom": 10, "left": 10},
        },
        {
            "paper_size": "letter",
            "orientation": "portrait",
            "margins_mm": {"top": True, "right": 10, "bottom": 10, "left": 10},
        },
        {
            "paper_size": "letter",
            "orientation": "portrait",
            "margins_mm": {"top": 101, "right": 10, "bottom": 10, "left": 10},
        },
    ],
)
def test_render_docx_rejects_invalid_page_layout(page_layout: dict[str, object]) -> None:
    with pytest.raises(OfficeDocumentError):
        render_office_document(
            {
                "format": "docx",
                "page_layout": page_layout,
                "blocks": [],
            }
        )
