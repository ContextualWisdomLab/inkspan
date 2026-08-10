# Bounded DOCX page layout

Status: `implemented_on_active_pr` — proposed by issue #140 and Draft PR #141; this is **not protected-main behavior** until that PR integrates.

Inkspan Office's proposed DOCX `page_layout` contract makes basic paper geometry explicit without turning the renderer into a general Word layout engine. The contract is deterministic, network-free, complete when supplied, and limited to the document's existing single section.

## Request contract

`page_layout` is optional and valid only for DOCX requests. When omitted, Inkspan preserves the existing template/default page setup. When present, the object must contain exactly these fields:

```json
{
  "page_layout": {
    "paper_size": "a4",
    "orientation": "landscape",
    "margins_mm": {
      "top": 10,
      "right": 20,
      "bottom": 30,
      "left": 40
    }
  }
}
```

- `paper_size` is exactly `a4` or `letter`.
- `orientation` is exactly `portrait` or `landscape`.
- `margins_mm` requires integer `top`, `right`, `bottom`, and `left` values from 0 through 100 inclusive.
- Booleans, floats, strings, nulls, aliases, case variants, missing fields, and unknown fields fail closed.
- A4 is exactly 210 × 297 mm in portrait orientation. US Letter is exactly 8.5 × 11 in. Landscape swaps the physical page dimensions and sets the Word orientation property explicitly.

## Fidelity and safety boundary

The implementation applies layout only after the normal bounded DOCX content renderer has produced the document, then canonicalizes the resulting OOXML package. It therefore keeps the existing renderer payload contract intact while adding one section-level transformation.

The page-layout pass must preserve already-supported document semantics, including rich runs and relationship-backed external hyperlinks. Regression tests inspect the generated WordprocessingML relationship after page-layout application rather than treating successful file creation as fidelity proof. Repeated rendering of the same validated request remains byte-identical.

Inkspan rejects a package with more than one DOCX section for this contract instead of guessing which sections should inherit layout. Invalid page-layout input cannot publish a partial file through `write_office_document`.

## Deliberate non-goals

This slice does not add arbitrary page dimensions, multiple sections, mixed portrait/landscape pages, headers, footers, gutters, mirrored margins, columns, binding, page numbers, printer selection, a PDF service, raw OOXML input, CSS-to-Word layout translation, network access, credentials, persistence, tenancy, or host authorization.

Hosts remain responsible for source-format interpretation, document/export authorization, tenant isolation, destination/storage, retention, distribution, and any print/PDF service.

## Verification

Acceptance requires the exact active head to pass:

- JSON Schema contract tests for the complete bounded object;
- A4-landscape and Letter-portrait round trips through `python-docx`;
- fail-closed malformed/type/range/unknown-field tests;
- multi-section rejection;
- no-partial-publication failure evidence;
- relationship-preservation regression evidence for existing DOCX hyperlinks;
- byte-identical deterministic rendering;
- the full Office Python 3.11–3.14 matrix, 100% owned production statement/branch coverage, public-docstring coverage, wheel/package verification, repository CI, Security Scan, and SAST.

Exact-head active-PR evidence does not transfer to protected `main` and does not satisfy stable registry acceptance under issue #118.

## Decision and primary technical basis

- ADR 0027: [`docs/adr/0027-bounded-docx-page-layout.md`](adr/0027-bounded-docx-page-layout.md).
- Doctoring and APA 7 references: [`docs/doctoring/docx-page-layout.md`](doctoring/docx-page-layout.md).
- Machine-readable schema: [`office/src/inkspan_office/schema.json`](../office/src/inkspan_office/schema.json).
- Runtime implementation: [`office/src/inkspan_office/page_layout.py`](../office/src/inkspan_office/page_layout.py).

The implementation uses the public `python-docx` section API and the corresponding OOXML section properties rather than exposing arbitrary package XML.