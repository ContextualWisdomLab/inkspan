"""Contract tests for privacy-safe Office render performance evidence."""

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


def _measure_command(script: Path, request_path: Path, iterations: str) -> list[str]:
    return [
        sys.executable,
        str(script),
        "--input",
        str(request_path),
        "--format",
        "docx",
        "--fixture-profile",
        "small",
        "--iterations",
        iterations,
        "--reference-hardware",
        "pytest-reference",
    ]


def test_measure_office_render_records_duration_peak_rss_and_provenance(tmp_path: Path) -> None:
    """Measure a lock-verified synthetic fixture without copying its document body into evidence."""

    request_path = tmp_path / "synthetic-docx-small.json"
    request_bytes = _canonical_docx_small_fixture_bytes()
    request_path.write_bytes(request_bytes)
    script = Path(__file__).resolve().parents[1] / "benchmarks" / "measure_render.py"
    completed = subprocess.run(
        _measure_command(script, request_path, "2"),
        check=False,
        cwd=Path(__file__).resolve().parents[2],
        capture_output=True,
        text=True,
    )

    assert completed.returncode == 0, completed.stderr
    evidence = json.loads(completed.stdout)
    assert evidence["contractVersion"] == 1
    assert evidence["synthetic"] is True
    assert evidence["operation"] == "office_render"
    assert evidence["fixtureId"] == "docx.small"
    assert evidence["profile"] == "small"
    assert evidence["format"] == "docx"
    assert evidence["iterations"] == 2
    assert evidence["referenceHardware"] == "pytest-reference"
    assert evidence["fixtureBytes"] == len(request_bytes)
    assert len(evidence["fixtureSha256"]) == 64
    assert len(evidence["sourceSha"]) == 40
    assert evidence["runtime"]["implementation"]
    assert evidence["runtime"]["python"]
    assert evidence["runtime"]["platform"]
    assert len(evidence["samples"]) == 2
    for sample in evidence["samples"]:
        assert isinstance(sample["durationMs"], (int, float))
        assert sample["durationMs"] >= 0
        assert isinstance(sample["peakRssBytes"], int)
        assert sample["peakRssBytes"] > 0
    for percentile in ("p50", "p75", "p95", "max"):
        assert evidence["summary"]["durationMs"][percentile] >= 0
        assert evidence["summary"]["peakRssBytes"][percentile] > 0

    combined_output = completed.stdout + completed.stderr
    assert MULTILINGUAL_PARAGRAPH not in combined_output
    assert str(request_path) not in combined_output


def test_measure_office_render_rejects_noncanonical_content_without_leaking_it(
    tmp_path: Path,
) -> None:
    """Do not label arbitrary document content as canonical synthetic benchmark evidence."""

    sentinel = "PRIVATE-NONCANONICAL-DOCUMENT-SENTINEL"
    request_path = tmp_path / "private-customer-name.json"
    request_path.write_text(
        json.dumps(
            {
                "format": "docx",
                "title": "private customer document",
                "blocks": [{"type": "paragraph", "text": sentinel}],
            }
        ),
        encoding="utf-8",
    )
    script = Path(__file__).resolve().parents[1] / "benchmarks" / "measure_render.py"
    completed = subprocess.run(
        _measure_command(script, request_path, "1"),
        check=False,
        cwd=Path(__file__).resolve().parents[2],
        capture_output=True,
        text=True,
    )

    assert completed.returncode != 0
    assert "input does not match the canonical synthetic Office fixture" in completed.stderr
    assert sentinel not in completed.stderr
    assert str(request_path) not in completed.stderr


def test_measure_office_render_rejects_unbounded_iteration_counts_without_reading_input(
    tmp_path: Path,
) -> None:
    """Reject impossible benchmark work before inspecting the caller-selected request path."""

    request_path = tmp_path / "must-not-be-read.json"
    request_path.write_text("PRIVATE-ITERATION-SENTINEL", encoding="utf-8")
    script = Path(__file__).resolve().parents[1] / "benchmarks" / "measure_render.py"
    completed = subprocess.run(
        _measure_command(script, request_path, "1001"),
        check=False,
        cwd=Path(__file__).resolve().parents[2],
        capture_output=True,
        text=True,
    )

    assert completed.returncode != 0
    assert "iterations must be between 1 and 100" in completed.stderr
    assert str(request_path) not in completed.stderr
    assert "PRIVATE-ITERATION-SENTINEL" not in completed.stderr


def test_office_render_sample_times_out_without_leaking_payload(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Bound a hung renderer child and normalize timeout failure without exposing document data."""

    script = Path(__file__).resolve().parents[1] / "benchmarks" / "measure_render.py"
    namespace = runpy.run_path(str(script), run_name="inkspan_measure_render_test")
    benchmark_error = namespace["BenchmarkContractError"]
    run_sample = namespace["_run_sample"]
    observed_timeout: list[float | None] = []
    sentinel = b'PRIVATE-HUNG-RENDER-SENTINEL'

    def _timeout(*args: object, **kwargs: object) -> subprocess.CompletedProcess[bytes]:
        timeout = kwargs.get("timeout")
        observed_timeout.append(timeout if isinstance(timeout, (int, float)) else None)
        raise subprocess.TimeoutExpired(args[0] if args else "renderer", timeout or 0)

    monkeypatch.setattr(subprocess, "run", _timeout)

    with pytest.raises(benchmark_error, match="Office benchmark render sample timed out") as exc_info:
        run_sample(sentinel)

    assert observed_timeout == [120]
    assert sentinel.decode() not in str(exc_info.value)


def test_office_render_child_rejects_unverified_private_payload() -> None:
    """Require the isolated child to re-verify canonical fixture identity before rendering."""

    sentinel = "PRIVATE-DIRECT-CHILD-DOCUMENT-SENTINEL"
    payload = json.dumps(
        {
            "format": "docx",
            "title": "private direct child document",
            "blocks": [{"type": "paragraph", "text": sentinel}],
        }
    ).encode()
    script = Path(__file__).resolve().parents[1] / "benchmarks" / "measure_render.py"
    completed = subprocess.run(
        [
            sys.executable,
            str(script),
            "--child",
            "--format",
            "docx",
            "--fixture-profile",
            "small",
        ],
        input=payload,
        check=False,
        cwd=Path(__file__).resolve().parents[2],
        capture_output=True,
    )

    assert completed.returncode != 0
    assert b"input does not match the canonical synthetic Office fixture" in completed.stderr
    assert sentinel.encode() not in completed.stderr
