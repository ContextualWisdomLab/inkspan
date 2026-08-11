from __future__ import annotations

import pytest

from inkspan_office import OfficeDocumentError, render_office_document


def test_invalid_xlsx_sheet_name_error_does_not_reflect_document_content() -> None:
    """Reject an invalid worksheet name without copying it into diagnostics."""

    confidential_name = "ACME_SECRET_7391/forecast"

    with pytest.raises(OfficeDocumentError) as exc_info:
        render_office_document(
            {
                "format": "xlsx",
                "sheets": [{"name": confidential_name, "rows": []}],
            }
        )

    message = str(exc_info.value)
    assert message == "sheets[0].name is invalid for Excel"
    assert confidential_name not in message
