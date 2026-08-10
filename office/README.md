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
            "type": "rich_paragraph",
            "runs": [
                {"text": "Retention ", "bold": True},
                {"text": "improved", "italic": True},
                {"text": " year over year.", "underline": True},
            ],
        },
        {
            "type": "table",
            "headers": ["Metric", "Value"],
            "rows": [["Revenue", 120], ["Churn", 0.03]],
        },
        {
            "type": "image",
            "source": "data:image/png;base64,iVBORw0KGgo...",
            "alt_text": "Quarterly retention chart",
            "width_px": 960,
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

- DOCX: headings, plain and **bounded rich-text paragraphs**, ordered/unordered
  lists, tables, **informative inline PNG figures**, and page breaks.
- XLSX: multiple worksheets, scalar cells, header styling, freeze panes,
  filters, and bounded automatic column sizing.
- PPTX: title/subtitle slides and title/bullet slides with nesting levels.

### DOCX bounded rich-text paragraphs

A DOCX `rich_paragraph` preserves ordinary run-level emphasis without creating
an arbitrary WordprocessingML or source-format parsing surface. `runs` must be a
non-empty array containing no more than 4,096 entries. Each run requires a
non-empty string `text` value and may contain only strict JSON boolean `bold`,
`italic`, and `underline` fields. Whitespace-only text remains valid document
content.

Omitting a formatting field leaves that Word run property inherited/default;
an explicit `true` or `false` maps directly to the corresponding `python-docx`
run property. Inkspan does not expose tri-state JSON input, enumerated underline
styles, arbitrary style names, fonts, colors, sizes, hyperlinks, field codes,
raw OOXML, tracked changes, macros, embedded objects, or model-authored markup
through this block.

The renderer preserves caller-supplied logical run order, including
Unicode/CJK/combining/bidirectional text, and applies the same XML 1.0,
request/string resource, nesting, deterministic-output, and atomic-publication
controls as the rest of Inkspan Office. Invalid run shapes fail closed and
cannot publish a partial artifact through `write_office_document`.

Hosts continue to own source authoring policy, export authorization, tenant
isolation, durable storage, distribution, and any mapping from editor marks or
another source format into the Office request. The standards and library basis
is recorded in
[`docs/doctoring/docx-rich-text-runs.md`](../docs/doctoring/docx-rich-text-runs.md),
and ADR 0023 records the protected boundary.

### DOCX informative PNG figures

A DOCX `image` block is intentionally narrower than Inkspan's interactive image
surface. It accepts only the exact `data:image/png;base64,...` form and therefore
never downloads a remote image or reads a caller-controlled filesystem path.
JPEG, SVG/vector content, data-URL parameters, percent-encoded payloads, and
external Office relationships are outside this initial contract.

Every figure must provide:

- strict base64 PNG bytes with a valid PNG signature and IHDR;
- positive bounded intrinsic dimensions;
- at most 10 MiB decoded bytes, 10,000 pixels on either axis, and 40 million
  pixels in total;
- a `width_px` from 1 through 2,400, interpreted as CSS pixels at exactly 9,525
  English Metric Units per pixel while preserving the intrinsic aspect ratio;
- non-empty `alt_text` up to 1,000 characters.

The alternative text is written to the Word drawing `docPr/@descr` metadata and
is verified in the generated OOXML package. P0 supports **informative** figures
only. Decorative images are rejected rather than represented by an accidental
empty description, because modern Office decorative-object semantics use a
separate accessibility extension and require a dedicated compatibility
contract.

Image failures are fail-closed and redacted. The source data URI and decoded
bytes are not reflected into ordinary error messages, and a failed image
request cannot publish a partial output through `write_office_document`.
Inkspan Office still does not decide whether a user is authorized to export a
document or where the resulting file may be stored; those remain host
responsibilities.

The standards and primary-library basis for this boundary is recorded in
[`docs/doctoring/docx-inline-png-figures.md`](../docs/doctoring/docx-inline-png-figures.md).

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
byte-for-byte deterministic output. DOCX rich-paragraph acceptance additionally
inspects ordered run text and explicit Word run properties while enforcing the
shared 4,096-run and non-empty-text contract. DOCX image acceptance additionally
inspects the generated ZIP/OOXML package for the exact embedded PNG bytes,
dimensions, and accessible description. CI installs runtime and test dependencies
from `requirements-ci.txt` with wheel hashes and executes the complete Office
matrix on Python 3.11, Python 3.12, Python 3.13, and Python 3.14. The package
metadata rejects unverified Python 3.15+ installs until that runtime is added to
the tested support matrix. CI enforces 100% statement/branch and shipped-symbol
docstring coverage, then builds and inspects the distributable wheel. Code and
all three direct runtime dependencies are MIT-licensed.
