from __future__ import annotations

from copy import deepcopy

import pytest

from inkspan_office import OfficeDocumentError, render_office_document

_PAGE_LAYOUT = {
    "paper_size": "a4",
    "orientation": "portrait",
    "margins_mm": {"top": 10, "right": 10, "bottom": 10, "left": 10},
}


@pytest.mark.parametrize(
    "payload",
    [
        {"format": "xlsx", "sheets": [{"name": "Sheet", "rows": []}]},
        {"format": "pptx", "slides": [{"title": "Title", "bullets": []}]},
    ],
)
def test_page_layout_is_rejected_outside_docx(payload: dict[str, object]) -> None:
    """Keep page-layout authority scoped to DOCX rather than widening other formats."""

    baseline = render_office_document(payload)
    assert baseline.format == payload["format"]

    invalid = deepcopy(payload)
    invalid["page_layout"] = _PAGE_LAYOUT
    with pytest.raises(OfficeDocumentError):
        render_office_document(invalid)
