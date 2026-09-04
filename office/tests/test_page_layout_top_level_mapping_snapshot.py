from __future__ import annotations

from collections.abc import Iterator, Mapping

from inkspan_office import render_office_document

_PRIVATE_SENTINEL = "private_page_layout_second_read_sentinel"


class _SingleReadPageLayoutPayload(Mapping[str, object]):
    """Expose page_layout exactly once, then fail on redundant value reads."""

    def __init__(self) -> None:
        self.page_layout_reads = 0

    def __getitem__(self, key: str) -> object:
        if key == "format":
            return "docx"
        if key == "blocks":
            return []
        if key == "page_layout":
            self.page_layout_reads += 1
            if self.page_layout_reads > 1:
                raise RuntimeError(_PRIVATE_SENTINEL)
            return {
                "paper_size": "a4",
                "orientation": "portrait",
                "margins_mm": {"top": 10, "right": 10, "bottom": 10, "left": 10},
            }
        raise KeyError(key)

    def __iter__(self) -> Iterator[str]:
        yield "format"
        yield "page_layout"
        yield "blocks"

    def __len__(self) -> int:
        return 3


def test_page_layout_snapshots_top_level_mapping_value_once() -> None:
    """Do not re-read a validated page-layout value from a host mapping."""

    payload = _SingleReadPageLayoutPayload()

    rendered = render_office_document(payload)

    assert rendered.format == "docx"
    assert payload.page_layout_reads == 1
