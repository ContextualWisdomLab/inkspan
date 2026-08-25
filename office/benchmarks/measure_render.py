"""Produce privacy-safe timing and peak-RSS evidence for canonical Office fixtures."""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
import platform
import re
import stat
import subprocess
import sys
import tempfile
import time
from pathlib import Path
from typing import Any

OFFICE_ROOT = Path(__file__).resolve().parents[1]
REPOSITORY_ROOT = OFFICE_ROOT.parent
LOCK_PATH = REPOSITORY_ROOT / "benchmarks" / "office-fixtures.lock.json"
SOURCE_ROOT = OFFICE_ROOT / "src"
if str(SOURCE_ROOT) not in sys.path:
    sys.path.insert(0, str(SOURCE_ROOT))

from inkspan_office.safe_renderer import write_office_document  # noqa: E402

MAX_ITERATIONS = 100
MAX_TOKEN_CODE_UNITS = 128
SAMPLE_TIMEOUT_SECONDS = 120
TOKEN_PATTERN = re.compile(r"[A-Za-z0-9][A-Za-z0-9._:-]*\Z")
SHA256_PATTERN = re.compile(r"[0-9a-f]{64}\Z")
GIT_SHA_PATTERN = re.compile(r"[0-9a-f]{40}\Z")
SUPPORTED_FORMATS = {"docx", "xlsx", "pptx"}


class BenchmarkContractError(Exception):
    """Raised when benchmark evidence cannot be produced safely and truthfully."""


def _metadata_token(value: str, label: str) -> str:
    if (
        not isinstance(value, str)
        or len(value) > MAX_TOKEN_CODE_UNITS
        or not TOKEN_PATTERN.fullmatch(value)
    ):
        raise BenchmarkContractError(f"{label} must be a bounded metadata token")
    return value


def _positive_iterations(value: int) -> int:
    if not isinstance(value, int) or isinstance(value, bool) or not 1 <= value <= MAX_ITERATIONS:
        raise BenchmarkContractError("iterations must be between 1 and 100")
    return value


def _load_fixture_contract(format_name: str, profile: str) -> tuple[int, str]:
    try:
        lock = json.loads(LOCK_PATH.read_text(encoding="utf-8"))
        if lock.get("contractVersion") != 1 or lock.get("synthetic") is not True:
            raise BenchmarkContractError("canonical Office fixture lock is invalid")
        record = lock["formats"][format_name][profile]
        expected_bytes = record["bytes"]
        expected_sha256 = record["sha256"]
    except (OSError, KeyError, TypeError, json.JSONDecodeError) as exc:
        raise BenchmarkContractError("canonical Office fixture lock is invalid") from exc
    if (
        not isinstance(expected_bytes, int)
        or isinstance(expected_bytes, bool)
        or expected_bytes <= 0
        or not isinstance(expected_sha256, str)
        or not SHA256_PATTERN.fullmatch(expected_sha256)
    ):
        raise BenchmarkContractError("canonical Office fixture lock is invalid")
    return expected_bytes, expected_sha256


def _read_exact_regular_fixture(path: Path, expected_bytes: int, expected_sha256: str) -> bytes:
    flags = os.O_RDONLY | getattr(os, "O_CLOEXEC", 0) | getattr(os, "O_NOFOLLOW", 0)
    try:
        descriptor = os.open(path, flags)
    except OSError as exc:
        raise BenchmarkContractError("Office benchmark input could not be opened safely") from exc
    try:
        metadata = os.fstat(descriptor)
        if not stat.S_ISREG(metadata.st_mode) or metadata.st_size != expected_bytes:
            raise BenchmarkContractError(
                "input does not match the canonical synthetic Office fixture"
            )
        chunks: list[bytes] = []
        remaining = expected_bytes
        while remaining:
            chunk = os.read(descriptor, min(remaining, 1024 * 1024))
            if not chunk:
                raise BenchmarkContractError(
                    "input does not match the canonical synthetic Office fixture"
                )
            chunks.append(chunk)
            remaining -= len(chunk)
        if os.read(descriptor, 1):
            raise BenchmarkContractError(
                "input does not match the canonical synthetic Office fixture"
            )
        payload = b"".join(chunks)
    except OSError as exc:
        raise BenchmarkContractError("Office benchmark input could not be read safely") from exc
    finally:
        os.close(descriptor)
    if hashlib.sha256(payload).hexdigest() != expected_sha256:
        raise BenchmarkContractError("input does not match the canonical synthetic Office fixture")
    return payload


def _read_exact_stdin_fixture(expected_bytes: int, expected_sha256: str) -> bytes:
    payload = sys.stdin.buffer.read(expected_bytes + 1)
    if len(payload) != expected_bytes or hashlib.sha256(payload).hexdigest() != expected_sha256:
        raise BenchmarkContractError("input does not match the canonical synthetic Office fixture")
    return payload


def _source_sha() -> str:
    status = subprocess.run(
        ["git", "-C", str(REPOSITORY_ROOT), "status", "--porcelain", "--untracked-files=all"],
        check=False,
        capture_output=True,
        text=True,
    )
    if status.returncode != 0 or status.stdout:
        raise BenchmarkContractError("benchmark checkout must be clean")
    revision = subprocess.run(
        ["git", "-C", str(REPOSITORY_ROOT), "rev-parse", "HEAD"],
        check=False,
        capture_output=True,
        text=True,
    )
    sha = revision.stdout.strip()
    if revision.returncode != 0 or not GIT_SHA_PATTERN.fullmatch(sha):
        raise BenchmarkContractError("benchmark source revision could not be verified")
    return sha


def _peak_rss_bytes() -> int:
    try:
        import resource
    except ImportError as exc:  # pragma: no cover - benchmark CI is POSIX
        raise BenchmarkContractError("peak RSS measurement is unavailable on this runtime") from exc
    peak = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
    if peak <= 0:
        raise BenchmarkContractError("peak RSS measurement is unavailable on this runtime")
    if sys.platform == "darwin":
        return int(peak)
    return int(peak) * 1024


def _child_measure(format_name: str, profile: str) -> int:
    try:
        profile = _metadata_token(profile, "fixture profile")
        expected_bytes, expected_sha256 = _load_fixture_contract(format_name, profile)
        payload_bytes = _read_exact_stdin_fixture(expected_bytes, expected_sha256)
        payload = json.loads(payload_bytes.decode("utf-8"))
        if not isinstance(payload, dict):
            raise BenchmarkContractError("canonical Office fixture must contain an object")
        if payload.get("format") != format_name:
            raise BenchmarkContractError("canonical Office fixture format is inconsistent")
        with tempfile.TemporaryDirectory(prefix="inkspan-office-benchmark-") as directory:
            output_path = Path(directory) / f"render.{format_name}"
            started = time.perf_counter_ns()
            write_office_document(payload, output_path)
            duration_ms = (time.perf_counter_ns() - started) / 1_000_000
            peak_rss_bytes = _peak_rss_bytes()
        print(
            json.dumps(
                {
                    "format": format_name,
                    "durationMs": round(duration_ms, 6),
                    "peakRssBytes": peak_rss_bytes,
                },
                separators=(",", ":"),
                sort_keys=True,
            )
        )
        return 0
    except BenchmarkContractError as exc:
        print(str(exc), file=sys.stderr)
        return 2
    except Exception:
        print("Office benchmark render sample failed.", file=sys.stderr)
        return 2


def _run_sample(payload_bytes: bytes, format_name: str, profile: str) -> dict[str, Any]:
    try:
        completed = subprocess.run(
            [
                sys.executable,
                str(Path(__file__).resolve()),
                "--child",
                "--format",
                format_name,
                "--fixture-profile",
                profile,
            ],
            input=payload_bytes,
            check=False,
            cwd=REPOSITORY_ROOT,
            capture_output=True,
            timeout=SAMPLE_TIMEOUT_SECONDS,
        )
    except subprocess.TimeoutExpired:
        raise BenchmarkContractError("Office benchmark render sample timed out") from None
    if completed.returncode != 0:
        raise BenchmarkContractError("Office benchmark render sample failed")
    try:
        sample = json.loads(completed.stdout.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise BenchmarkContractError("Office benchmark render sample was invalid") from exc
    if not isinstance(sample, dict):
        raise BenchmarkContractError("Office benchmark render sample was invalid")
    duration = sample.get("durationMs")
    peak_rss = sample.get("peakRssBytes")
    observed_format = sample.get("format")
    if (
        observed_format != format_name
        or not isinstance(duration, (int, float))
        or isinstance(duration, bool)
        or not math.isfinite(duration)
        or duration < 0
        or not isinstance(peak_rss, int)
        or isinstance(peak_rss, bool)
        or peak_rss <= 0
    ):
        raise BenchmarkContractError("Office benchmark render sample was invalid")
    return {"format": observed_format, "durationMs": duration, "peakRssBytes": peak_rss}


def _percentile(values: list[float], quantile: float) -> float:
    ordered = sorted(values)
    if len(ordered) == 1:
        return ordered[0]
    position = (len(ordered) - 1) * quantile
    lower = math.floor(position)
    upper = math.ceil(position)
    if lower == upper:
        return ordered[lower]
    weight = position - lower
    return ordered[lower] * (1 - weight) + ordered[upper] * weight


def _summary(values: list[float], *, integral: bool) -> dict[str, int | float]:
    result: dict[str, int | float] = {}
    for name, quantile in (("p50", 0.50), ("p75", 0.75), ("p95", 0.95)):
        value = _percentile(values, quantile)
        result[name] = int(round(value)) if integral else round(value, 6)
    maximum = max(values)
    result["max"] = int(maximum) if integral else round(maximum, 6)
    return result


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Measure a canonical synthetic Inkspan Office fixture")
    parser.add_argument("--input", required=True, help="canonical generated Office fixture path")
    parser.add_argument("--format", required=True, choices=sorted(SUPPORTED_FORMATS))
    parser.add_argument("--fixture-profile", required=True)
    parser.add_argument("--iterations", type=int, default=5)
    parser.add_argument("--reference-hardware", required=True)
    return parser


def _child_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Render one verified synthetic Inkspan Office fixture")
    parser.add_argument("--format", required=True, choices=sorted(SUPPORTED_FORMATS))
    parser.add_argument("--fixture-profile", required=True)
    return parser


def _main(argv: list[str] | None = None) -> int:
    args = _parser().parse_args(argv)
    try:
        iterations = _positive_iterations(args.iterations)
        profile = _metadata_token(args.fixture_profile, "fixture profile")
        reference_hardware = _metadata_token(args.reference_hardware, "reference hardware")
        expected_bytes, expected_sha256 = _load_fixture_contract(args.format, profile)
        source_sha = _source_sha()
        payload_bytes = _read_exact_regular_fixture(
            Path(args.input), expected_bytes, expected_sha256
        )
        samples = [_run_sample(payload_bytes, args.format, profile) for _ in range(iterations)]
        duration_values = [float(sample["durationMs"]) for sample in samples]
        rss_values = [float(sample["peakRssBytes"]) for sample in samples]
        evidence = {
            "contractVersion": 1,
            "synthetic": True,
            "operation": "office_render",
            "fixtureId": f"{args.format}.{profile}",
            "format": args.format,
            "profile": profile,
            "iterations": iterations,
            "referenceHardware": reference_hardware,
            "fixtureBytes": expected_bytes,
            "fixtureSha256": expected_sha256,
            "sourceSha": source_sha,
            "runtime": {
                "implementation": platform.python_implementation(),
                "python": platform.python_version(),
                "platform": sys.platform,
            },
            "samples": samples,
            "summary": {
                "durationMs": _summary(duration_values, integral=False),
                "peakRssBytes": _summary(rss_values, integral=True),
            },
        }
        print(json.dumps(evidence, ensure_ascii=False, indent=2, sort_keys=True))
        return 0
    except BenchmarkContractError as exc:
        print(str(exc), file=sys.stderr)
        return 2
    except Exception:
        print("Office benchmark measurement failed.", file=sys.stderr)
        return 2


def main() -> int:
    """Run the benchmark command or its isolated one-render child process."""

    if sys.argv[1:2] == ["--child"]:
        args = _child_parser().parse_args(sys.argv[2:])
        return _child_measure(args.format, args.fixture_profile)
    return _main()


if __name__ == "__main__":
    raise SystemExit(main())
