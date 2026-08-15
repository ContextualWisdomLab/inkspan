"""Command-line interface for the Inkspan Office renderer."""

from __future__ import annotations

import argparse
import json
from collections.abc import Sequence
from pathlib import Path

from .safe_renderer import OfficeDocumentError, load_schema, write_office_document

_MAX_CLI_REQUEST_BYTES = 64 * 1024 * 1024
_MAX_CLI_JSON_NESTING_DEPTH = 128


class _DuplicateJsonObjectNameError(ValueError):
    """Signal an ambiguous repeated object member without retaining its name."""


def _parser() -> argparse.ArgumentParser:
    """Build the argument parser shared by the console script and tests."""

    parser = argparse.ArgumentParser(
        prog="inkspan-office",
        description="Render strict AI-authored JSON to DOCX, XLSX, or PPTX.",
    )
    parser.add_argument(
        "input",
        nargs="?",
        help="JSON request path (maximum 64 MiB UTF-8 request)",
    )
    parser.add_argument("output", nargs="?", help="output .docx/.xlsx/.pptx path")
    parser.add_argument("--force", action="store_true", help="overwrite an existing output")
    parser.add_argument(
        "--print-schema",
        action="store_true",
        help="print the machine-readable JSON Schema and exit",
    )
    return parser


def _read_request_text(source: Path) -> str:
    """Read one bounded strict UTF-8 CLI request without unbounded allocation."""

    if source.exists() and not source.is_file():
        raise OfficeDocumentError("input could not be read")
    with source.open("rb") as stream:
        raw = stream.read(_MAX_CLI_REQUEST_BYTES + 1)
    if len(raw) > _MAX_CLI_REQUEST_BYTES:
        raise OfficeDocumentError("input exceeds the supported CLI request size")
    try:
        return raw.decode("utf-8")
    except UnicodeDecodeError as exc:
        raise OfficeDocumentError("input must contain valid UTF-8") from exc


def _preflight_json_nesting(source: str) -> None:
    """Reject excessive JSON container nesting before native materialization."""

    depth = 0
    in_string = False
    escaped = False
    for character in source:
        if in_string:
            if escaped:
                escaped = False
            elif character == "\\":
                escaped = True
            elif character == '"':
                in_string = False
            continue
        if character == '"':
            in_string = True
        elif character in "[{":
            depth += 1
            if depth > _MAX_CLI_JSON_NESTING_DEPTH:
                raise OfficeDocumentError("input exceeds the supported JSON nesting depth")
        elif character in "]}":
            depth = max(0, depth - 1)


def _reject_nonstandard_json_constant(_value: str) -> None:
    """Reject numeric constants accepted by Python but forbidden by strict JSON."""

    raise ValueError("non-standard JSON numeric constant")


def _reject_duplicate_json_object_names(
    pairs: list[tuple[str, object]],
) -> dict[str, object]:
    """Build one JSON object while rejecting repeated decoded member names."""

    result: dict[str, object] = {}
    for name, value in pairs:
        if name in result:
            raise _DuplicateJsonObjectNameError("duplicate JSON object name")
        result[name] = value
    return result


def main(argv: Sequence[str] | None = None) -> int:
    """Run the CLI and return a process-style status code."""

    parser = _parser()
    args = parser.parse_args(argv)
    if args.print_schema:
        print(json.dumps(load_schema(), ensure_ascii=False, indent=2))
        return 0
    if not args.input or not args.output:
        parser.error("input and output paths are required unless --print-schema is used")

    try:
        source = Path(args.input)
        try:
            request_text = _read_request_text(source)
        except OfficeDocumentError:
            raise
        except (OSError, ValueError) as exc:
            raise OfficeDocumentError("input could not be read") from exc
        _preflight_json_nesting(request_text)
        try:
            payload = json.loads(
                request_text,
                parse_constant=_reject_nonstandard_json_constant,
                object_pairs_hook=_reject_duplicate_json_object_names,
            )
        except json.JSONDecodeError as exc:
            raise OfficeDocumentError(f"input must contain valid JSON: {exc.msg}") from exc
        except _DuplicateJsonObjectNameError as exc:
            raise OfficeDocumentError("input must not contain duplicate object names") from exc
        except ValueError as exc:
            raise OfficeDocumentError(
                "input contains a value unsupported by strict JSON parsing"
            ) from exc

        try:
            write_office_document(payload, Path(args.output), overwrite=args.force)
        except FileExistsError as exc:
            raise OfficeDocumentError("output already exists") from exc
        except OSError as exc:
            if getattr(exc, "output_committed", False):
                raise OfficeDocumentError(
                    "output was written but temporary cleanup failed"
                ) from exc
            raise OfficeDocumentError("output could not be written") from exc
    except OfficeDocumentError as exc:
        parser.error(str(exc))
    return 0


if __name__ == "__main__":  # pragma: no cover - exercised through the console script
    raise SystemExit(main())
