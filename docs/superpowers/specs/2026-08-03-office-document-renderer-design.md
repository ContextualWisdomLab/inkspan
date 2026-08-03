# Inkspan Office document renderer design

**Date:** 2026-08-03  
**Issue:** #2 — AI-authored Word/Excel/PowerPoint

## Objective

Add a deterministic Office Open XML rendering boundary to Inkspan. An LLM or
host application supplies machine-readable JSON; Inkspan validates the payload
and produces a DOCX, XLSX, or PPTX artifact without network access, macros, or
model execution inside the renderer.

## Selected approach

The implementation is an isolated Python package under `office/` using the
permissively licensed libraries named by the roadmap:

- `python-docx` for DOCX,
- `openpyxl` for XLSX,
- `python-pptx` for PPTX.

This is preferable to driving desktop Office software because it works on CI,
Linux, and air-gapped systems. It is also preferable to a broad template engine
for the first release because a small schema is easier for structured LLM
output to satisfy, audit, and test exhaustively.

## Public contract

`schema.json` is the source contract for three discriminated request shapes.
The Python API exposes:

- `load_schema()`,
- `render_office_document(payload)`, returning bytes and transport metadata,
- `write_office_document(payload, path, overwrite=False)`,
- `OfficeDocumentError` for validation failures.

The `inkspan-office` CLI renders JSON files and can print the bundled schema.
Validation rejects unknown fields as well as missing or malformed values so a
model cannot smuggle ignored instructions through an apparently valid payload.

## Format scope

DOCX supports document metadata, headings, paragraphs, ordered and unordered
lists, tables, and page breaks. XLSX supports multiple sheets, JSON-scalar
cells, optional header styling, freeze panes, auto-filtering, and bounded
column sizing. PPTX supports title/subtitle slides and title/bullet slides with
levels 0–8.

The first release intentionally excludes arbitrary XML, macros, formulas,
remote images, charts, theme/template upload, and embedded executables. Those
features would require separate capability and trust decisions rather than
being silently accepted by this renderer.

## Safety and failure behavior

All rendering is in memory. Output writes require a matching extension and use
a securely-created temporary file in the destination directory followed by an
atomic replacement. Existing output is protected unless overwrite is explicit.

XLSX strings beginning, after leading whitespace, with `=`, `+`, `-`, or `@`
are forced to the string cell type. This prevents AI-authored content from
becoming an executable spreadsheet formula. Non-finite numbers are rejected as
outside the JSON data model.

## Verification

Tests author and re-open all three formats with their native libraries, exercise
metadata and every supported content shape, and cover malformed/ambiguous
requests, formula neutralization, output rules, and CLI behavior. The package
requires 100% statement and branch coverage. CI runs the suite on the minimum
supported Python version and a current Python version, performs `pip check`,
and builds a wheel containing the JSON Schema.

## Integration boundary

The package does not depend on React or the existing editor bundle. A naruon or
Inkspan host can ask its LLM for JSON conforming to the schema, invoke the Python
API/CLI in a worker, and attach the returned bytes using the reported MIME type.
This keeps probabilistic authoring separate from deterministic document
construction and permits later host-specific orchestration without changing the
rendering contract.
