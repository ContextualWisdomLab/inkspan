# Inkspan Office

Inkspan Office is a deterministic, network-free renderer for AI-authored
Office Open XML documents:

- Word (`.docx`) via `python-docx`
- Excel (`.xlsx`) via `openpyxl`
- PowerPoint (`.pptx`) via `python-pptx`

The model or host application produces a strict JSON request. Inkspan Office
validates that request and renders the corresponding binary file; it never
calls an LLM, fetches remote content, or executes document macros.

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

`render_office_document` returns bytes plus the format, extension, and MIME
type. `write_office_document` uses a securely-created same-directory temporary
file and an atomic replacement, so consumers never observe a partially-written
Office file.

## Machine-readable contract

The bundled JSON Schema is available as `inkspan_office/schema.json` and through
`load_schema()` or `inkspan-office --print-schema`. Unknown fields, missing
required fields, non-finite numbers, mismatched table widths, invalid worksheet
names, unsupported block/slide shapes, and output-extension mismatches are
rejected before rendering.

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

## Verification

```bash
pytest
python -m pip check
python -m pip wheel . --no-deps --wheel-dir dist
```

The suite re-opens every rendered format with its native library. CI installs
runtime and test dependencies from `requirements-ci.txt` with wheel hashes on
Python 3.11 and 3.13, then builds and inspects the distributable wheel. Code and
all three direct runtime dependencies are MIT-licensed.
