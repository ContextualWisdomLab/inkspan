"""Resource-boundary tests for DOCX rich-run safety preflight."""

from __future__ import annotations

from collections.abc import Sequence

import pytest

from inkspan_office import OfficeDocumentError, render_office_document


class _OversizedRuns(Sequence[object]):
    """Advertise an impossible run count and fail if traversal begins."""

    def __len__(self) -> int:
        return 4_097

    def __getitem__(self, index: int) -> object:
        raise AssertionError(f"oversized runs must not be traversed: index {index}")


def test_docx_rich_run_count_is_rejected_before_sequence_traversal() -> None:
    """The safety facade must enforce the existing 4,096-run ceiling first."""

    payload = {
        "format": "docx",
        "blocks": [{"type": "rich_paragraph", "runs": _OversizedRuns()}],
    }

    with pytest.raises(
        OfficeDocumentError,
        match=r"^blocks\[0\]\.runs must contain at most 4096 runs$",
    ):
        render_office_document(payload)
