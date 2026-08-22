from __future__ import annotations

from io import BytesIO

import pytest
from docx import Document
from docx.enum.section import WD_ORIENT

from inkspan_office import render_office_document


@pytest.mark.parametrize(
    ("paper_size", "orientation", "expected_orientation", "width_mm", "height_mm"),
    [
        ("a4", "portrait", WD_ORIENT.PORTRAIT, 210.0, 297.0),
        ("a4", "landscape", WD_ORIENT.LANDSCAPE, 297.0, 210.0),
        ("letter", "portrait", WD_ORIENT.PORTRAIT, 215.9, 279.4),
        ("letter", "landscape", WD_ORIENT.LANDSCAPE, 279.4, 215.9),
    ],
)
def test_page_layout_round_trips_every_supported_paper_orientation_pair(
    paper_size: str,
    orientation: str,
    expected_orientation: WD_ORIENT,
    width_mm: float,
    height_mm: float,
) -> None:
    """Prove every declared paper/orientation pair survives the real DOCX round trip."""

    rendered = render_office_document(
        {
            "format": "docx",
            "page_layout": {
                "paper_size": paper_size,
                "orientation": orientation,
                "margins_mm": {"top": 7, "right": 11, "bottom": 13, "left": 17},
            },
            "blocks": [{"type": "paragraph", "text": "Layout matrix"}],
        }
    )

    section = Document(BytesIO(rendered.data)).sections[0]
    assert section.orientation == expected_orientation
    assert section.page_width is not None
    assert section.page_height is not None
    assert section.page_width.mm == pytest.approx(width_mm, abs=0.02)
    assert section.page_height.mm == pytest.approx(height_mm, abs=0.02)
