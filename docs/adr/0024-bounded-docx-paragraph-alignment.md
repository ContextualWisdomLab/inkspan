# ADR 0024: Bounded paragraph alignment in deterministic DOCX output

Status: Accepted

## Context

Protected Inkspan Office preserves deterministic DOCX paragraphs and bounded rich-text runs, but before PR #130 callers could not request ordinary horizontal paragraph alignment. Centered callouts, right-aligned reference lines, and justified prose therefore required a host-specific Word path or were flattened to inherited/default alignment.

The requirement is intentionally smaller than a general Word style system. Inkspan needs a reviewable contract that preserves four common paragraph alignment values without exposing arbitrary paragraph styles, raw WordprocessingML, layout scripting, source-format parsing, or new transport/persistence/model authority.

## Alternatives considered

### 1. Keep inherited/default alignment only

This retained the smallest renderer surface but left a buyer-visible fidelity gap for routine reports and document exports.

### 2. Accept arbitrary Word style names or paragraph properties

Rejected. Style names, indentation, spacing, tabs, section/page layout, and raw paragraph-property fragments would create a broad compatibility and security surface whose semantics depend on document templates and WordprocessingML details outside the bounded deterministic request contract.

### 3. Accept raw OOXML paragraph properties

Rejected. Raw XML would bypass Inkspan's structured validation boundary and make compatibility, resource bounding, error redaction, and long-term migration substantially harder.

### 4. Add one exact four-value alignment enum

Accepted. The public `paragraph` and `rich_paragraph` blocks may optionally carry `alignment` with exactly `left`, `center`, `right`, or `justify`. The renderer maps those values through the public `python-docx` paragraph alignment API.

## Decision

Inkspan Office exposes optional paragraph alignment only on plain and rich paragraphs:

```json
{
  "type": "paragraph",
  "text": "Quarterly summary",
  "alignment": "center"
}
```

```json
{
  "type": "rich_paragraph",
  "alignment": "justify",
  "runs": [
    {"text": "Evidence ", "bold": true},
    {"text": "remains reviewable."}
  ]
}
```

The contract is:

- accepted values are exactly `left`, `center`, `right`, and `justify`;
- JSON Schema and runtime validation expose the same enum;
- case variants, padded values, aliases, numeric values, booleans, `null`, empty strings, and unsupported Word alignment modes fail closed;
- an omitted `alignment` does not materialize a direct Word justification property, preserving inherited/default style behavior;
- explicit values are applied through `WD_ALIGN_PARAGRAPH`, not by constructing raw `w:jc` XML;
- plain and rich paragraphs share the same alignment semantics;
- run order, text fidelity, XML 1.0 validation, request/resource ceilings, deterministic output, and atomic publication remain unchanged.

## Consequences and ownership

The bounded enum improves normal document fidelity while preserving a small provider-neutral request surface. Inkspan owns exact validation and deterministic rendering of the four values. Hosts continue to own source-format interpretation, authoring/layout policy, export authorization, tenant isolation, durable storage, distribution, templates, and any decision to map editor/source alignment into the Office request.

Inkspan does not gain authority over paragraph indentation, line/paragraph spacing, tabs, heading/list/table layout, page sections, styles, fonts/colors, bidirectional reordering, HTML/Markdown interpretation, network access, models, credentials, or persistence.

## Failure and recovery

Invalid alignment is rejected with a path-qualified `OfficeDocumentError` before output publication. `write_office_document()` retains the existing no-partial-artifact and atomic publication contract.

A caller can recover by omitting alignment to use inherited/default Word behavior or by supplying one of the four supported exact strings. Inkspan does not trim or repair an invalid value because silent repair would make generated-document intent ambiguous.

## Security and privacy impact

The decision adds no network, filesystem-read, macro, model, credential, tenant, persistence, or external-relationship capability. It does not expand the set of document content exposed to Inkspan beyond the already validated request. Errors report the field path and supported values rather than document contents.

## Compatibility and migration

Existing `paragraph` and `rich_paragraph` requests without `alignment` remain valid and preserve their previous inherited/default behavior. A host targeting an older renderer that does not support this field must omit or deliberately transform the alignment request before dispatch; older renderers are not expected to silently accept unknown fields. A current renderer continues to accept all previously valid paragraph requests.

A future expansion to additional Word alignment modes, arbitrary styles, or paragraph layout properties requires a separate reviewed contract and ADR rather than widening this enum implicitly.

## Verification and acceptance evidence

PR #130 established RED on protected main, then implemented and verified the bounded contract. The accepted evidence includes:

- exact JSON Schema equality for the four-value enum on both paragraph shapes;
- real DOCX round-trip through `python-docx` for `left`, `center`, `right`, and `justify`;
- WordprocessingML inspection proving `w:jc` appears for explicit alignment and is absent when alignment is omitted;
- rejection of case variants, whitespace-padded values, unsupported strings, numbers, booleans, `null`, and empty strings;
- byte-identical deterministic rendering;
- no partial file publication after invalid input;
- protected exact-head CI, Security Scan, and SAST success;
- Office Python 3.11, 3.12, 3.13, and 3.14 verification with 100% shipped production statement/branch coverage and shipped-symbol docstring coverage.

Primary technical authority is Microsoft WordprocessingML paragraph documentation and the `python-docx` 1.2.0 paragraph alignment API; the APA 7 trace is maintained in `docs/doctoring/docx-paragraph-alignment.md`.

## Rollback and supersession

Rollback removes the optional schema property, mapping, tests, and documentation together; requests using alignment would again fail closed rather than degrade silently. The decision is superseded only by a later ADR that defines a larger paragraph-layout contract with equivalent validation, compatibility, deterministic-output, and recovery evidence.