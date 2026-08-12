from __future__ import annotations

from copy import deepcopy

import pytest

from inkspan_office import OfficeDocumentError, render_office_document

_PRIVATE_MARKER = "confidential_customer_layout_marker"


def _valid_layout_payload() -> dict[str, object]:
    """Return one valid DOCX request for page-layout diagnostic tests."""

    return {
        "format": "docx",
        "page_layout": {
            "paper_size": "a4",
            "orientation": "portrait",
            "margins_mm": {"top": 10, "right": 10, "bottom": 10, "left": 10},
        },
        "blocks": [],
    }


@pytest.mark.parametrize("nested", [False, True])
def test_page_layout_unknown_fields_are_not_reflected_in_errors(nested: bool) -> None:
    """Keep caller-controlled layout member names out of public diagnostics."""

    payload = deepcopy(_valid_layout_payload())
    layout = payload["page_layout"]
    assert isinstance(layout, dict)
    target = layout["margins_mm"] if nested else layout
    assert isinstance(target, dict)
    target[_PRIVATE_MARKER] = 1

    with pytest.raises(OfficeDocumentError) as captured:
        render_office_document(payload)

    message = str(captured.value)
    assert "unexpected field" in message
    assert _PRIVATE_MARKER not in message
