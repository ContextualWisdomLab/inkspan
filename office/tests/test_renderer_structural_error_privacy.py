from __future__ import annotations

from typing import Any

import pytest

from inkspan_office import OfficeDocumentError, render_office_document

_PRIVATE_MARKER = "confidential_customer_workflow_marker"


@pytest.mark.parametrize(
    ("payload", "expected_category"),
    [
        ({"format": _PRIVATE_MARKER}, "unsupported format"),
        (
            {
                "format": "docx",
                "blocks": [{"type": _PRIVATE_MARKER}],
            },
            "blocks[0].type is unsupported",
        ),
        (
            {
                "format": "docx",
                "blocks": [],
                _PRIVATE_MARKER: True,
            },
            "payload has unexpected field",
        ),
        (
            {
                "format": "docx",
                "blocks": [
                    {
                        "type": "paragraph",
                        "text": "visible content",
                        _PRIVATE_MARKER: True,
                    }
                ],
            },
            "blocks[0] has unexpected field",
        ),
    ],
)
def test_structural_tokens_are_not_reflected_in_renderer_errors(
    payload: dict[str, Any], expected_category: str
) -> None:
    """Keep rejected format, block-type, and member tokens out of diagnostics."""

    with pytest.raises(OfficeDocumentError) as captured:
        render_office_document(payload)

    message = str(captured.value)
    assert expected_category in message
    assert _PRIVATE_MARKER not in message
