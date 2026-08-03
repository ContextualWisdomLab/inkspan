"""Command-line interface for the Inkspan Office renderer."""

from __future__ import annotations

import argparse
import json
from collections.abc import Sequence
from pathlib import Path

from .renderer import OfficeDocumentError, load_schema, write_office_document


def _parser() -> argparse.ArgumentParser:
    """Build the argument parser shared by the console script and tests."""

    parser = argparse.ArgumentParser(
        prog="inkspan-office",
        description="Render strict AI-authored JSON to DOCX, XLSX, or PPTX.",
    )
    parser.add_argument("input", nargs="?", help="JSON request path")
    parser.add_argument("output", nargs="?", help="output .docx/.xlsx/.pptx path")
    parser.add_argument("--force", action="store_true", help="overwrite an existing output")
    parser.add_argument(
        "--print-schema",
        action="store_true",
        help="print the machine-readable JSON Schema and exit",
    )
    return parser


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
            payload = json.loads(source.read_text(encoding="utf-8"))
        except json.JSONDecodeError as exc:
            raise OfficeDocumentError(f"input must contain valid JSON: {exc.msg}") from exc
        write_office_document(payload, Path(args.output), overwrite=args.force)
    except (OfficeDocumentError, OSError) as exc:
        parser.error(str(exc))
    return 0


if __name__ == "__main__":  # pragma: no cover - exercised through the console script
    raise SystemExit(main())
