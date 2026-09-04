"""Resource-bound regressions for public Office mapping traversal."""

from __future__ import annotations

from collections.abc import Iterator, Mapping
from typing import Any

import pytest

from inkspan_office import OfficeDocumentError, render_office_document


class _OverlongMappingTripwire(Mapping[str, Any]):
    """Yield 65 finite fields, then fail if the safety facade keeps scanning."""

    def __getitem__(self, key: str) -> Any:
        """Return bounded harmless values for the advertised keys."""

        if key == "format":
            return "docx"
        if key.startswith("private_"):
            return "safe"
        raise KeyError(key)

    def __iter__(self) -> Iterator[str]:
        """Expose one field beyond the local mapping budget, then a tripwire."""

        yield "format"
        for index in range(64):
            yield f"private_{index}"
        raise AssertionError("Office safety facade scanned beyond its mapping budget")

    def __len__(self) -> int:
        """Report the finite logical key count without driving traversal."""

        return 65


def test_public_renderer_bounds_mapping_traversal_before_additional_key_reads() -> None:
    """Reject an oversized mapping after one bounded over-limit observation."""

    with pytest.raises(
        OfficeDocumentError,
        match=r"^payload must contain at most 64 fields$",
    ):
        render_office_document(_OverlongMappingTripwire())
