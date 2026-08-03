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

The package public API and CLI enter through `safe_renderer.py`. This facade
applies cross-format OOXML and storage-safety validation before delegating to
the format-specific renderer, keeping validation policy separate from document
construction. Validation rejects unknown fields as well as missing or malformed
values so a model cannot smuggle ignored instructions through an apparently
valid payload.

## Format scope

DOCX supports document metadata, headings, paragraphs, ordered and unordered
lists, tables, and page breaks. XLSX supports multiple sheets, JSON-scalar
cells, optional header styling, freeze panes, auto-filtering, and bounded
column sizing. PPTX supports title/subtitle slides and title/bullet slides with
levels 0–8.

The first release intentionally excludes arbitrary XML, macros, formulas,
remote images, charts, theme/template upload, and embedded executables. Those
features require separate capability and trust decisions rather than being
silently accepted by this renderer.

## Safety and failure behavior

All rendering is in memory. Output writes require a matching extension and use
a securely-created temporary file in the destination directory. Explicit
overwrite uses atomic replacement. Non-overwrite publication uses an atomic
hard-link operation, so a file created concurrently cannot be overwritten by a
check-then-replace race. The temporary link is removed after publication.

The safety facade rejects XML 1.0-incompatible control characters before any
OOXML library receives them and detects cyclic Python containers that cannot be
represented by the JSON contract.

XLSX strings beginning, after leading whitespace, with `=`, `+`, `-`, or `@`
are forced to the string cell type. This prevents AI-authored content from
becoming an executable spreadsheet formula. Non-finite numbers are rejected as
outside the JSON data model.

Excel-specific losslessness limits are validated before rendering:

- at most 1,048,576 rows and 16,384 columns per worksheet,
- at most 32,767 characters per cell string,
- no integer with more than 15 significant decimal digits,
- freeze panes limited to a simple coordinate within `A1:XFD1048576`.

Callers can preserve account numbers and identifiers with more significant
digits by supplying them as strings.

## Verification

Tests author and re-open all three formats with their native libraries, exercise
metadata and every supported content shape, and cover malformed or ambiguous
requests, formula neutralization, XML controls, Excel storage limits, atomic
publication races, output rules, and CLI behavior. CI runs the suite on Python
3.11 and 3.13 after installing hash-locked binary dependencies, requires 100%
statement/branch and shipped-symbol docstring coverage, performs `pip check`,
and builds a wheel containing the JSON Schema and license.

## Integration boundary

The package does not depend on React or the existing editor bundle. A naruon or
Inkspan host can ask its LLM for JSON conforming to the schema, invoke the Python
API/CLI in a worker, and attach the returned bytes using the reported MIME type.
This keeps probabilistic authoring separate from deterministic document
construction and permits later host-specific orchestration without changing the
rendering contract.
