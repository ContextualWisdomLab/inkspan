"""Regression coverage for Excel-compatibility worksheet-name diagnostics."""

from __future__ import annotations

import pytest

from inkspan_office import OfficeDocumentError, render_office_document


@pytest.mark.parametrize("name", ["'customer-project-secret", "History"])
def test_redacts_excel_compatibility_worksheet_name(name: str) -> None:
    """Compatibility-name rejection must not reflect caller-controlled text."""

    with pytest.raises(OfficeDocumentError) as caught:
        render_office_document(
            {"format": "xlsx", "sheets": [{"name": name, "rows": [["x"]]}]}
        )

    message = str(caught.value)
    assert "name is invalid for Excel" in message
    assert name not in message
    assert "customer-project-secret" not in message
