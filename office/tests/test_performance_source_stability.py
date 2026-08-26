"""Source-stability contracts for Office benchmark provenance."""

from __future__ import annotations

import json
import runpy
import subprocess
import sys
from pathlib import Path

import pytest


MULTILINGUAL_PARAGRAPH = (
    "English: deterministic Office rendering fixture. 한국어: 합성 성능 문서입니다. "
    "日本語: 合成性能文書です。 中文: 这是合成性能文档。 "
    "Tiếng Việt: Đây là tài liệu hiệu năng tổng hợp."
)


def _docx_page(page_number: int) -> list[dict[str, object]]:
    page = str(page_number).zfill(3)
    return [
        {"type": "heading", "level": 1, "text": f"Synthetic page {page}"},
        {
            "type": "paragraph",
            "text": f"{MULTILINGUAL_PARAGRAPH} Page {page}.",
            "alignment": "justify",
        },
        {
            "type": "rich_paragraph",
            "runs": [
                {"text": f"Page {page} summary: ", "bold": True},
                {"text": "deterministic ", "italic": True},
                {"text": "Office rendering fixture.", "underline": True},
            ],
        },
        {
            "type": "bullet_list",
            "ordered": False,
            "items": [
                f"page {page} item A",
                f"page {page} item B",
                f"page {page} item C",
            ],
        },
        {
            "type": "table",
            "headers": ["Page", "Metric", "Value"],
            "rows": [
                [page, "latency-sample", page_number],
                [page, "memory-sample", page_number * 2],
                [page, "revision-sample", page_number * 3],
                [page, "render-sample", page_number * 4],
            ],
        },
    ]


def _canonical_docx_small_fixture_bytes() -> bytes:
    blocks: list[dict[str, object]] = []
    for page_number in range(1, 3):
        blocks.extend(_docx_page(page_number))
        if page_number < 2:
            blocks.append({"type": "page_break"})
    request = {
        "format": "docx",
        "title": "Inkspan synthetic DOCX benchmark: small",
        "author": "Inkspan synthetic benchmark",
        "subject": "Deterministic synthetic performance fixture",
        "blocks": blocks,
    }
    return (json.dumps(request, ensure_ascii=False, indent=2) + "\n").encode()


def _git(repository: Path, *args: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["git", *args],
        cwd=repository,
        check=True,
        capture_output=True,
        text=True,
    )


def _initialize_clean_repository(repository: Path) -> Path:
    repository.mkdir()
    _git(repository, "init", "-q")
    tracked = repository / "tracked.txt"
    tracked.write_text("before\n", encoding="utf-8")
    _git(repository, "add", "tracked.txt")
    subprocess.run(
        [
            "git",
            "-c",
            "user.name=Inkspan benchmark test",
            "-c",
            "user.email=benchmark-test@example.invalid",
            "commit",
            "-qm",
            "initial",
        ],
        cwd=repository,
        check=True,
        capture_output=True,
        text=True,
    )
    return tracked


def test_office_measurement_rejects_clean_source_revision_move_during_sampling(
    tmp_path: Path,
    capsys: pytest.CaptureFixture[str],
) -> None:
    """Never emit benchmark evidence if a clean checkout advances while samples are acquired."""

    script = Path(__file__).resolve().parents[1] / "benchmarks" / "measure_render.py"
    namespace = runpy.run_path(str(script), run_name="inkspan_measure_render_source_stability")
    main = namespace["_main"]
    globals_ = main.__globals__

    repository = tmp_path / "isolated-repository"
    tracked = _initialize_clean_repository(repository)
    globals_["REPOSITORY_ROOT"] = repository

    request_path = tmp_path / "synthetic-docx-small.json"
    request_path.write_bytes(_canonical_docx_small_fixture_bytes())

    def _move_revision(
        _payload_bytes: bytes,
        format_name: str,
        _profile: str,
    ) -> dict[str, object]:
        tracked.write_text("after\n", encoding="utf-8")
        _git(repository, "add", "tracked.txt")
        subprocess.run(
            [
                "git",
                "-c",
                "user.name=Inkspan benchmark test",
                "-c",
                "user.email=benchmark-test@example.invalid",
                "commit",
                "-qm",
                "advance",
            ],
            cwd=repository,
            check=True,
            capture_output=True,
            text=True,
        )
        return {"format": format_name, "durationMs": 1.0, "peakRssBytes": 1024}

    globals_["_run_sample"] = _move_revision

    result = main(
        [
            "--input",
            str(request_path),
            "--format",
            "docx",
            "--fixture-profile",
            "small",
            "--iterations",
            "1",
            "--reference-hardware",
            "pytest-reference",
        ]
    )
    output = capsys.readouterr()

    assert result == 2
    assert output.out == ""
    assert "benchmark source revision changed during measurement" in output.err
    assert str(repository) not in output.err
    assert str(request_path) not in output.err
