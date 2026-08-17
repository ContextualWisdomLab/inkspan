from __future__ import annotations

from collections.abc import Iterator, Mapping

import pytest

from inkspan_office import OfficeDocumentError, render_office_document

_PRIVATE_SENTINEL = "private_page_layout_iterator_sentinel"


class _ThrowingLayoutMapping(Mapping[str, object]):
    """Raise a private failure if page-layout validation asks for iterator data."""

    def __getitem__(self, key: str) -> object:
        raise KeyError(key)

    def __iter__(self) -> Iterator[str]:
        raise RuntimeError(_PRIVATE_SENTINEL)
        yield  # pragma: no cover - keeps this method an iterator for typing.

    def __len__(self) -> int:
        return 3


def test_page_layout_contains_host_mapping_iteration_failures() -> None:
    """Map hostile container failures to one stable payload-redacted public error."""

    payload = {
        "format": "docx",
        "page_layout": _ThrowingLayoutMapping(),
        "blocks": [],
    }

    with pytest.raises(OfficeDocumentError) as captured:
        render_office_document(payload)

    assert str(captured.value) == "page_layout is invalid"
    assert _PRIVATE_SENTINEL not in str(captured.value)
