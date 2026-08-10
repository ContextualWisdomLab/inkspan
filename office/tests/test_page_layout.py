from __future__ import annotations

from io import BytesIO

import pytest
from docx import Document
from docx.enum.section import WD_ORIENT

from inkspan_office import OfficeDocumentError, load_schema, render_office_document


def _layout_payload() -> dict[str, object]:
    """Return one valid bounded landscape A4 request used by fidelity tests."""

    return {
        "format": "docx",
        "page_layout": {
            "paper_size": "a4",
            "orientation": "landscape",
            "margins_mm": {"top": 10, "right": 20, "bottom": 30, "left": 40},
        },
        "blocks": [{"type": "paragraph", "text": "Layout contract"}],
    }


def test_page_layout_is_part_of_the_machine_readable_docx_contract() -> None:
    schema = load_schema()
    docx_schema = schema["oneOf"][0]

    assert docx_schema["properties"]["page_layout"] == {
        "$ref": "#/$defs/pageLayout"
    }
    layout = schema["$defs"]["pageLayout"]
    assert layout["required"] == ["paper_size", "orientation", "margins_mm"]
    assert layout["additionalProperties"] is False
    assert layout["properties"]["paper_size"]["enum"] == ["a4", "letter"]
    assert layout["properties"]["orientation"]["enum"] == [
        "portrait",
        "landscape",
    ]
    margins = schema["$defs"]["pageMargins"]
    assert margins["required"] == ["top", "right", "bottom", "left"]
    assert margins["additionalProperties"] is False
    for name in margins["required"]:
        assert margins["properties"][name] == {
            "type": "integer",
            "minimum": 0,
            "maximum": 100,
        }


def test_render_docx_applies_bounded_page_layout() -> None:
    rendered = render_office_document(_layout_payload())

    document = Document(BytesIO(rendered.data))
    assert len(document.sections) == 1
    section = document.sections[0]
    assert section.orientation == WD_ORIENT.LANDSCAPE
    assert section.page_width is not None
    assert section.page_height is not None
    assert section.top_margin is not None
    assert section.right_margin is not None
    assert section.bottom_margin is not None
    assert section.left_margin is not None
    assert section.page_width.mm == pytest.approx(297, abs=0.02)
    assert section.page_height.mm == pytest.approx(210, abs=0.02)
    assert section.top_margin.mm == pytest.approx(10, abs=0.02)
    assert section.right_margin.mm == pytest.approx(20, abs=0.02)
    assert section.bottom_margin.mm == pytest.approx(30, abs=0.02)
    assert section.left_margin.mm == pytest.approx(40, abs=0.02)


def test_render_docx_page_layout_is_deterministic() -> None:
    first = render_office_document(_layout_payload())
    second = render_office_document(_layout_payload())

    assert first.data == second.data


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
        {
            "paper_size": "letter",
            "orientation": "portrait",
            "margins_mm": {
                "top": 10,
                "right": 10,
                "bottom": 10,
                "left": 10,
                "gutter": 1,
            },
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
