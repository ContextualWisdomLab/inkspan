# ADR 0025: Bounded DOCX heading alignment

Status: Accepted

## Context

Inkspan Office already owns one bounded four-value DOCX paragraph-alignment mapping for `paragraph` and `rich_paragraph`. Protected `main` at `da3e910618ed5cfc6ba566783ff23d99f76e0850` extends that same schema/runtime/rendering authority to `heading` blocks. Without the extension, centered or right-aligned authored headings were flattened to the Word heading style/default even though the renderer already understood the exact alignment semantics.

The extension must preserve the deterministic, network-free, macro-free Office boundary and must not become a general Word style or page-layout engine.

## Alternatives considered

1. **Leave headings style-controlled only.** Rejected because common explicit heading alignment would continue to be lost during export.
2. **Add a separate heading-only alignment mapping.** Rejected because duplicated mappings could drift from the existing paragraph contract.
3. **Expose arbitrary Word heading styles or raw paragraph properties.** Rejected because that broadens validation, interoperability, security, and maintenance authority far beyond the buyer-visible gap.
4. **Reuse the existing exact four-value paragraph-alignment authority after `document.add_heading()`.** Accepted because a DOCX heading is a paragraph with a heading style and the existing mapping already captures the intended bounded semantics.

## Decision

A `heading` block may optionally contain the exact JSON string field `alignment` with one of:

- `left`
- `center`
- `right`
- `justify`

The JSON Schema uses the same four-value enum as plain and rich paragraphs. Rendering reuses `_apply_docx_paragraph_alignment()` after creating the heading; no second mapping exists. Omitted alignment preserves inherited/default heading-style alignment and does not force a `w:jc` element. Invalid strings, aliases, case variants, surrounding whitespace, booleans, numbers, and null fail closed.

This decision does not add arbitrary styles, fonts, colors, spacing, indentation, outline numbering, TOC generation, page layout, title-block alignment, list/table alignment, source-format interpretation, remote resources, network access, model calls, credentials, persistence, or authorization.

## Consequences

Inkspan preserves one more common authored DOCX fidelity signal while keeping paragraph alignment under a single deterministic implementation. Existing heading callers remain compatible because the field is optional.

Hosts own source-format interpretation, authoring/layout policy, export authorization, tenant isolation, durable storage, distribution, and any richer Word style policy.

## Failure and recovery

Invalid heading alignment fails during request validation before publication. `write_office_document()` must not leave a partial artifact. A host can recover by correcting the exact enum value or omitting the field to use the heading style/default.

## Security and privacy impact

The field is non-secret presentation metadata and introduces no network, file-read, credential, tenant, identity, model, macro, script, or external-relationship authority. Existing XML 1.0 validation, bounded input/resource limits, deterministic rendering, and atomic publication remain authoritative.

## Compatibility and migration

The change is additive. Previously valid heading requests remain valid unchanged. Producers that need explicit alignment may add the field when targeting a renderer that advertises the protected schema. Older renderers require producers to omit the field or otherwise handle compatibility before submission.

## Verification

Protected implementation evidence verifies all four values by reopening generated DOCX with `python-docx`, verifies `w:jc` only for explicit alignment, preserves inherited/default behavior when omitted, rejects malformed values, keeps byte-identical deterministic output, and preserves no-partial-publication behavior. The unchanged exact implementation head passed CI, Security Scan, SAST, and the Office Python 3.11–3.14 lanes with the repository's 100% shipped production statement/branch coverage and shipped-symbol docstring gates before protected merge.

## Rollback or supersession

Rollback requires no data migration: producers can stop emitting heading `alignment`, or the additive feature can be reverted before a later release. Supersede this ADR only through a reviewed versioned document-format decision that explicitly defines migration and preserves the deterministic security boundary.

## References

Microsoft. (n.d.). *Working with paragraphs*. Microsoft Learn. Retrieved August 10, 2026, from https://learn.microsoft.com/en-us/office/open-xml/word/working-with-paragraphs

python-docx. (n.d.). *Working with text*. Retrieved August 10, 2026, from https://python-docx.readthedocs.io/en/latest/user/text.html
