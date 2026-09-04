"""Privacy regression coverage for rejected XLSX worksheet names."""

from __future__ import annotations

import pytest

from inkspan_office import OfficeDocumentError, render_office_document


def test_invalid_xlsx_sheet_name_error_does_not_reflect_private_name() -> None:
    """Reject an invalid worksheet name without echoing caller-controlled content."""

    private_name = "ACME-private-case/forecast"
    request = {
        "format": "xlsx",
        "sheets": [{"name": private_name, "rows": [["safe"]]}],
    }

    with pytest.raises(OfficeDocumentError) as exc:
        render_office_document(request)

    message = str(exc.value)
    assert "sheets[0].name" in message
    assert "invalid for Excel" in message
    assert private_name not in message
    assert "ACME-private-case" not in message
