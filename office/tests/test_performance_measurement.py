"""Contract tests for privacy-safe Office render performance evidence."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path


def test_measure_office_render_records_duration_peak_rss_and_provenance(tmp_path: Path) -> None:
    """Measure repeated synthetic renders without copying document content into evidence."""

    sentinel = "PRIVATE-BENCHMARK-PAYLOAD-SENTINEL"
    request_path = tmp_path / "buyer-private-name.json"
    request_path.write_text(
        json.dumps(
            {
                "format": "docx",
                "title": "Synthetic benchmark fixture",
                "blocks": [
                    {"type": "heading", "level": 1, "text": "Synthetic heading"},
                    {"type": "paragraph", "text": sentinel},
                ],
            }
        ),
        encoding="utf-8",
    )

    script = Path(__file__).resolve().parents[1] / "benchmarks" / "measure_render.py"
    completed = subprocess.run(
        [
            sys.executable,
            str(script),
            "--input",
            str(request_path),
            "--profile",
            "docx-small",
            "--iterations",
            "2",
            "--reference-hardware",
            "pytest-reference",
        ],
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
    assert evidence["profile"] == "docx-small"
    assert evidence["format"] == "docx"
    assert evidence["iterations"] == 2
    assert evidence["referenceHardware"] == "pytest-reference"
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
    assert evidence["summary"]["durationMs"]["p50"] >= 0
    assert evidence["summary"]["durationMs"]["p75"] >= 0
    assert evidence["summary"]["durationMs"]["p95"] >= 0
    assert evidence["summary"]["durationMs"]["max"] >= 0
    assert evidence["summary"]["peakRssBytes"]["max"] > 0

    combined_output = completed.stdout + completed.stderr
    assert sentinel not in combined_output
    assert str(request_path) not in combined_output


def test_measure_office_render_rejects_unbounded_iteration_counts_without_reading_input(
    tmp_path: Path,
) -> None:
    """Reject impossible benchmark work before inspecting the caller-selected request path."""

    request_path = tmp_path / "must-not-be-read.json"
    request_path.write_text("PRIVATE-ITERATION-SENTINEL", encoding="utf-8")
    script = Path(__file__).resolve().parents[1] / "benchmarks" / "measure_render.py"
    completed = subprocess.run(
        [
            sys.executable,
            str(script),
            "--input",
            str(request_path),
            "--profile",
            "docx-small",
            "--iterations",
            "1001",
            "--reference-hardware",
            "pytest-reference",
        ],
        check=False,
        cwd=Path(__file__).resolve().parents[2],
        capture_output=True,
        text=True,
    )

    assert completed.returncode != 0
    assert "iterations must be between 1 and 100" in completed.stderr
    assert str(request_path) not in completed.stderr
    assert "PRIVATE-ITERATION-SENTINEL" not in completed.stderr
