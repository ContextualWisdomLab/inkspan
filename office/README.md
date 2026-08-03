# Inkspan Office

Inkspan Office is a deterministic, network-free renderer for AI-authored
Office Open XML documents:

- Word (`.docx`) via `python-docx`
- Excel (`.xlsx`) via `openpyxl`
- PowerPoint (`.pptx`) via `python-pptx`

The model or host application produces a strict JSON request. Inkspan Office
validates that request and renders the corresponding binary file; it never
calls an LLM, fetches remote content, or executes document macros. The same
validated request produces byte-identical output: generated core-property and
ZIP-entry timestamps are normalized to a fixed OOXML epoch before the artifact
is returned or published.

## Install and run

```bash
cd office
python -m pip install -e '.[test]'
inkspan-office --print-schema
inkspan-office request.json output.docx
```

Use `--force` to replace an existing output. The output extension must match the
request format.

## Python API

```python
from inkspan_office import render_office_document, write_office_document

request = {
    "format": "docx",
    "title": "Quarterly brief",
    "blocks": [
        {"type": "heading", "level": 1, "text": "Executive summary"},
        {"type": "paragraph", "text": "Revenue grew while churn fell."},
        {
            "type": "table",
            "headers": ["Metric", "Value"],
            "rows": [["Revenue", 120], ["Churn", 0.03]],
        },
    ],
}

artifact = render_office_document(request)
assert artifact.extension == ".docx"
write_office_document(request, "quarterly-brief.docx")
```

`render_office_document` returns canonical bytes plus the format, extension, and
MIME type. `write_office_document` writes through a securely-created
same-directory temporary file. A non-overwrite write is atomically published
without a check-then-replace race; an explicit overwrite uses atomic
replacement. A consumer therefore never observes a partially-written Office
file.

## Machine-readable contract

The bundled JSON Schema is available as `inkspan_office/schema.json` and through
`load_schema()` or `inkspan-office --print-schema`. Unknown fields, missing
required fields, non-finite numbers, mismatched table widths, invalid worksheet
names, unsupported block/slide shapes, XML-incompatible text, storage-limit
violations, and output-extension mismatches are rejected before publication.
Cyclic Python containers are also rejected because the API accepts JSON-like
mappings and arrays, not object graphs. JSON-like containers may be nested to a
maximum depth of 128, preventing pathological object graphs from exhausting the
Python call stack before contract validation.

Supported shapes are deliberately small and predictable:

- DOCX: headings, paragraphs, ordered/unordered lists, tables, page breaks.
- XLSX: multiple worksheets, scalar cells, header styling, freeze panes,
  filters, and bounded automatic column sizing.
- PPTX: title/subtitle slides and title/bullet slides with nesting levels.

## Spreadsheet safety

Spreadsheet strings are written as literal text by default, including values
whose first non-whitespace character is `=`, `+`, `-`, or `@`. AI-authored
cells therefore cannot silently become formulas. Formula generation is not part
of the 0.1 contract.

Inkspan Office also rejects values that a spreadsheet library or Excel would
silently alter:

- worksheet grids are limited to 1,048,576 rows and 16,384 columns;
- cell strings are limited to 32,767 characters rather than being truncated;
- integers must have at most 15 significant decimal digits and be exactly
  representable by Excel's binary64 numeric model, otherwise they must be
  supplied as strings;
- freeze panes must be a simple A1 coordinate within `A1:XFD1048576`.

Use strings for account numbers, document identifiers, or other digit sequences
whose exact textual representation matters.

## Verification

```bash
pytest
python -m pip check
python -m pip wheel . --no-deps --wheel-dir dist
```

The suite re-opens every rendered format with its native library and verifies
byte-for-byte deterministic output. CI installs runtime and test dependencies
from `requirements-ci.txt` with wheel hashes on minimum Python 3.11 and current
stable Python 3.14, enforces 100% statement/branch and shipped-symbol docstring
coverage, then builds and inspects the distributable wheel. Code and all three
direct runtime dependencies are MIT-licensed.
