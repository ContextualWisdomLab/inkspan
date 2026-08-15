from __future__ import annotations

from collections.abc import Iterator, Mapping
from copy import deepcopy

import pytest

from inkspan_office import OfficeDocumentError, render_office_document

_PRIVATE_MARKER = "confidential_customer_layout_marker"


class _TripwireUnknownMapping(Mapping[str, object]):
    """Expose two unknown keys, then fail if validation keeps scanning."""

    def __init__(self, known: dict[str, object]) -> None:
        self._known = known

    def __getitem__(self, key: str) -> object:
        return self._known[key]

    def __iter__(self) -> Iterator[str]:
        yield from self._known
        yield f"{_PRIVATE_MARKER}_one"
        yield f"{_PRIVATE_MARKER}_two"
        raise AssertionError("page-layout validation scanned beyond two unknown fields")

    def __len__(self) -> int:
        return len(self._known) + 2


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


@pytest.mark.parametrize("nested", [False, True])
def test_page_layout_stops_scanning_after_two_unknown_fields(nested: bool) -> None:
    """Reject plural unknown fields before requesting arbitrary additional keys."""

    payload = deepcopy(_valid_layout_payload())
    layout = payload["page_layout"]
    assert isinstance(layout, dict)
    if nested:
        margins = layout["margins_mm"]
        assert isinstance(margins, dict)
        layout["margins_mm"] = _TripwireUnknownMapping(margins)
        expected = "page_layout.margins_mm has unexpected fields"
    else:
        payload["page_layout"] = _TripwireUnknownMapping(layout)
        expected = "page_layout has unexpected fields"

    with pytest.raises(OfficeDocumentError) as captured:
        render_office_document(payload)

    assert str(captured.value) == expected
    assert _PRIVATE_MARKER not in str(captured.value)
