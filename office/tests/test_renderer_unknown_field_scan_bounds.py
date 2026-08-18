"""Resource-bound regressions for renderer mapping-key validation."""

from __future__ import annotations

from collections.abc import Iterator, Mapping
from typing import Any

import pytest

from inkspan_office import OfficeDocumentError, render_office_document


class _TwoUnknownTripwireMapping(Mapping[str, Any]):
    """Expose two private fields, then fail if validation keeps scanning keys."""

    _values = {
        "format": "docx",
        "blocks": [],
        "private_one": True,
        "private_two": True,
    }

    def __getitem__(self, key: str) -> Any:
        """Return one stored mapping value."""

        return self._values[key]

    def __iter__(self) -> Iterator[str]:
        """Yield enough keys to prove rejection, then expose over-scanning."""

        yield "format"
        yield "blocks"
        yield "private_one"
        yield "private_two"
        raise AssertionError("renderer scanned after two distinct unknown fields")

    def __len__(self) -> int:
        """Report the finite logical size without driving key iteration."""

        return len(self._values)


class _RepeatedAllowedKeyTripwireMapping(Mapping[str, Any]):
    """Repeat one allowed key so validation must fail instead of making no progress."""

    _values = {"format": "docx", "blocks": []}

    def __getitem__(self, key: str) -> Any:
        """Return one stored mapping value."""

        return self._values[key]

    def __iter__(self) -> Iterator[str]:
        """Repeat an allowed key, then fail if validation asks for another key."""

        yield "format"
        yield "format"
        raise AssertionError("renderer kept scanning a repeated mapping key")

    def __len__(self) -> int:
        """Report the finite logical size without driving key iteration."""

        return len(self._values)


def test_renderer_stops_key_scan_after_two_distinct_unknown_fields() -> None:
    """Reject plural unknown fields before requesting more caller-controlled keys."""

    with pytest.raises(OfficeDocumentError, match="payload has unexpected fields"):
        render_office_document(_TwoUnknownTripwireMapping())


def test_renderer_rejects_repeated_mapping_key_without_continuing_scan() -> None:
    """Reject a non-progressing mapping iterator before it can run indefinitely."""

    with pytest.raises(OfficeDocumentError, match="payload has unexpected fields"):
        render_office_document(_RepeatedAllowedKeyTripwireMapping())
