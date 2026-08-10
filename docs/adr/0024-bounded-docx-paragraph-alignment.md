# ADR 0024: Bounded DOCX paragraph alignment

Status: Accepted

## Context and problem boundary

Inkspan Office is a deterministic, network-free Office Open XML renderer. Protected `main` now accepts an optional `alignment` field on `paragraph` and `rich_paragraph` DOCX blocks and preserves that intent in WordprocessingML. Before the protected implementation, caller-requested alignment was flattened to the document style/default, which reduced fidelity for ordinary prose and rich-text paragraphs.

The renderer must preserve useful document semantics without becoming a general Word style engine or accepting arbitrary OOXML.

## Alternatives considered

1. **Ignore paragraph alignment.** This keeps the contract smallest but knowingly loses common authored layout intent.
2. **Accept arbitrary Word paragraph/style properties.** This maximizes flexibility but creates a large validation, compatibility, security, and maintenance surface.
3. **Expose numeric `python-docx` enum values.** This couples the public JSON contract to library implementation details and is difficult for non-Python callers to author safely.
4. **Adopt one bounded string enum and map it through the public `python-docx` paragraph API.** This preserves common intent while keeping the public contract deterministic and provider-neutral.

## Decision

Inkspan adopts alternative 4.

`paragraph` and `rich_paragraph` may optionally contain an exact JSON string `alignment` with one of four values:

- `left`
- `center`
- `right`
- `justify`

The same four-value contract is expressed in the bundled JSON Schema and runtime validation. The renderer maps accepted values through `WD_ALIGN_PARAGRAPH` and the public paragraph alignment property. Omitting the field leaves the Word paragraph alignment inherited/default and does not materialize a `w:jc` element.

No case folding, whitespace repair, aliasing, numeric enum coercion, or locale-dependent interpretation is performed.

## Consequences and ownership trade-offs

The decision preserves a common paragraph-level fidelity signal with a very small contract. Plain and bounded rich-text paragraphs share one alignment authority rather than maintaining duplicate mappings.

Inkspan still does not own arbitrary paragraph styles, fonts, colors, spacing, indentation, tabs, page layout, source-format interpretation, export authorization, tenant isolation, durable storage, or distribution. Hosts own those concerns.

## Failure and recovery semantics

An unsupported, non-string, case-variant, whitespace-padded, or null alignment fails closed during request validation. `write_office_document()` must not publish a partial artifact when validation fails.

Because the field is optional and additive, rollback consists of removing the field from producer requests or reverting the feature before a release. Existing requests that omit alignment retain their prior inherited/default behavior.

## Security and privacy impact

The alignment field carries no credential, network, identity, tenant, or content-fetch authority. It cannot introduce external relationships, macros, scripts, or filesystem access. Existing XML 1.0, bounded request/string resources, deterministic rendering, and atomic publication controls remain authoritative.

No new personal data is required or inferred.

## Compatibility and migration

The change is backward-compatible for existing JSON producers because `alignment` is optional. New producers must use the exact four-value string enum. Consumers that rely on default/template alignment can continue omitting the field.

This ADR does not extend alignment to headings, lists, tables, title paragraphs, or other blocks; those require separate reviewed product decisions.

## Verification and acceptance evidence

Protected product tests require:

- the same schema enum for `paragraph` and `rich_paragraph`;
- round-trip verification of `left`, `center`, `right`, and `justify` by reopening generated DOCX with `python-docx`;
- WordprocessingML `w:jc` only when alignment is explicit;
- inherited/default alignment when omitted;
- fail-closed invalid values;
- deterministic bytes; and
- no partial publication after validation failure.

The feature remains subject to the repository's Python 3.11–3.14 matrix, 100% shipped production statement/branch coverage, shipped-symbol docstrings, package verification, CI, Security Scan, and SAST gates.

## Rollback or supersession

A future ADR may supersede this decision if Inkspan adopts a versioned richer paragraph-format model. Supersession must preserve backward compatibility or provide an explicit migration path. Arbitrary OOXML or raw style injection must not be introduced by silently expanding this contract.

## References

Microsoft. (n.d.). *Working with paragraphs*. Microsoft Learn. Retrieved August 10, 2026, from https://learn.microsoft.com/en-us/office/open-xml/word/working-with-paragraphs

python-docx. (n.d.). *Working with text*. Retrieved August 10, 2026, from https://python-docx.readthedocs.io/en/latest/user/text.html
