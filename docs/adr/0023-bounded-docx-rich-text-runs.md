# ADR 0023: Bounded rich-text runs in deterministic DOCX output

Status: Accepted

## Context

Protected Inkspan Office previously represented DOCX paragraph content only as one plain string. This flattened ordinary bold, italic, and underline emphasis before export and forced hosts to maintain a separate Word-specific rendering path for common reports and evidence briefs. Protected main now implements a strict `rich_paragraph` block as an additive deterministic Office contract.

The design must preserve Inkspan's network-free and fail-closed Office boundary. It must not turn an ordinary emphasis feature into arbitrary WordprocessingML, HTML/Markdown interpretation, remote relationships, typography policy, or model authority.

## Alternatives considered

1. **Keep only plain paragraphs.** Rejected because ordinary emphasis fidelity would remain a buyer-visible export gap and host implementations would fragment.
2. **Accept Markdown or HTML inside Office paragraphs.** Rejected because parsing and sanitization would create a second content-language authority and broaden the trust boundary.
3. **Expose arbitrary OOXML or unrestricted Word styles.** Rejected because raw document markup, relationships, style names, fields, and other OOXML features greatly expand security, interoperability, and determinism risk.
4. **Expose a bounded ordered run array with explicit boolean emphasis.** Accepted because it maps directly to WordprocessingML run semantics and `python-docx` public APIs while retaining a narrow schema.

## Decision

Inkspan Office accepts a DOCX block of `type: rich_paragraph` with a non-empty `runs` array bounded to 4,096 entries. Every run requires non-empty string `text` and may contain only strict JSON booleans `bold`, `italic`, and `underline`.

A missing formatting key preserves inherited/default Word run state. An explicit boolean maps to the corresponding `python-docx` run property. Inkspan does not expose tri-state input, enumerated underline styles, arbitrary style names, fonts, colors, sizes, hyperlinks, field codes, raw OOXML, tracked changes, macros, embedded objects, or model-authored markup through this contract.

The public JSON Schema and runtime validator must express the same run-count and empty-text rules. Existing XML 1.0, request/string/resource, depth, cycle/alias, deterministic-output, and atomic-publication controls remain authoritative.

## Consequences and ownership

The additive block improves DOCX fidelity without changing existing paragraph callers. Inkspan owns deterministic validation and run-property rendering. Hosts own authoring policy, export authorization, tenant isolation, durable storage, distribution, and mapping from editor marks or other source formats into the Office request.

The contract intentionally does not claim visual identity across every Word-compatible viewer; it guarantees the bounded WordprocessingML structure and deterministic artifact produced by the tested renderer.

## Failure and recovery

Invalid run collections, unknown keys, invalid booleans, empty run text, unsupported XML text, or resource-limit violations fail closed with `OfficeDocumentError`. `write_office_document()` must not publish a partial artifact after validation/rendering failure. A host can recover by correcting the request or falling back to the existing plain `paragraph` block.

## Security and privacy impact

The feature does not introduce network access, credentials, macros, external Office relationships, model calls, persistence, or new personal-data collection. Error messages remain bounded and must not reflect uncontrolled document payloads beyond the repository's existing safe diagnostic contract.

## Compatibility and migration

The change is additive to the Office JSON contract. Existing requests remain valid. Consumers that do not understand `rich_paragraph` can continue emitting plain paragraphs. Future richer inline semantics require a separate versioned decision rather than widening this object silently.

## Verification and acceptance evidence

Protected-main implementation and regression tests verify:

- ordered normal/bold/italic/underline and combined emphasis runs;
- Unicode/CJK/combining/bidirectional logical text order;
- generated `w:r`, `w:rPr`, `w:b`, `w:i`, and `w:u` semantics;
- explicit boolean false behavior and omitted-property inheritance;
- byte-identical deterministic rendering;
- one shared 4,096-run ceiling across schema and runtime;
- exact empty-text rejection while preserving whitespace-only content;
- malformed-input rejection and no partial publication; and
- Python 3.11–3.14 Office CI with 100% shipped production statement/branch coverage and shipped-symbol docstring gates.

The standards/library traceability is maintained in `docs/doctoring/docx-rich-text-runs.md`.

## Rollback and supersession

Rollback requires no schema migration: stop emitting `rich_paragraph` and emit ordinary `paragraph` blocks. Supersede this ADR if Inkspan later adopts a versioned inline-document model that changes run semantics, permits additional inline constructs, or moves source-format interpretation into Inkspan Office.
