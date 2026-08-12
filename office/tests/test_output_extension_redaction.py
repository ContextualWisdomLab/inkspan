from __future__ import annotations

from pathlib import Path

import pytest

from inkspan_office import OfficeDocumentError, write_office_document


def test_write_office_document_redacts_rejected_output_extension(
    tmp_path: Path,
) -> None:
    payload = {
        "format": "docx",
        "blocks": [{"type": "paragraph", "text": "hello"}],
    }
    private_marker = "PRIVATE-TENANT-287"
    output = tmp_path / f"document.{private_marker}"

    with pytest.raises(OfficeDocumentError) as caught:
        write_office_document(payload, output)

    assert str(caught.value) == "output extension must be .docx"
    assert private_marker not in str(caught.value)
    assert not output.exists()
