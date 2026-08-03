from __future__ import annotations

from io import BytesIO
from zipfile import ZipFile

import pytest

from inkspan_office import OfficeDocumentError, render_office_document


@pytest.mark.parametrize(
    "payload",
    [
        {
            "format": "docx",
            "blocks": [{"type": "paragraph", "text": "Deterministic Word"}],
        },
        {
            "format": "xlsx",
            "sheets": [{"name": "Data", "rows": [["Deterministic Excel"]]}],
        },
        {
            "format": "pptx",
            "slides": [{"title": "Deterministic PowerPoint", "bullets": []}],
        },
    ],
    ids=["docx", "xlsx", "pptx"],
)
def test_rendered_ooxml_is_byte_deterministic(payload: dict[str, object]) -> None:
    first = render_office_document(payload)
    second = render_office_document(payload)

    assert first.data == second.data
    with ZipFile(BytesIO(first.data)) as archive:
        assert {entry.date_time for entry in archive.infolist()} == {
            (1980, 1, 1, 0, 0, 0)
        }
        core_properties = archive.read("docProps/core.xml")
    assert core_properties.count(b"1980-01-01T00:00:00Z") == 2


def test_rejects_codepoints_above_the_xml_1_0_character_range() -> None:
    payload = {
        "format": "docx",
        "blocks": [{"type": "paragraph", "text": "bad\U000F0000text"}],
    }

    with pytest.raises(OfficeDocumentError, match="U\+F0000"):
        render_office_document(payload)


@pytest.mark.parametrize("value", [10**100, 10**400])
def test_rejects_integers_excel_cannot_represent_exactly(value: int) -> None:
    payload = {
        "format": "xlsx",
        "sheets": [{"name": "Data", "rows": [[value]]}],
    }

    with pytest.raises(OfficeDocumentError, match="exactly representable"):
        render_office_document(payload)
