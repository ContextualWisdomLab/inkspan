# DOCX paragraph alignment doctoring

Status: Implemented on protected main

## Scope

Inkspan Office preserves one bounded horizontal-alignment signal for deterministic DOCX `paragraph` and `rich_paragraph` blocks. The public request accepts exactly `left`, `center`, `right`, or `justify`; omission preserves the Word style/default rather than materializing a justification property.

This is deliberately narrower than a Word style engine. Inkspan does not infer alignment from language, source markup, semantic role, model output, or document context and does not expose arbitrary OOXML paragraph properties.

## Standards and implementation basis

WordprocessingML represents paragraph justification/alignment in paragraph properties. Microsoft documents Word paragraphs as `<w:p>` elements whose paragraph properties can carry alignment/justification semantics. Inkspan uses the public `python-docx` paragraph alignment surface and `WD_ALIGN_PARAGRAPH` mapping rather than accepting raw OOXML from callers.

The bounded string enum is an Inkspan interoperability contract. It avoids exposing Python enum values in JSON and gives non-Python producers a stable provider-neutral vocabulary.

## Deterministic and fail-closed semantics

For `paragraph` and `rich_paragraph`:

- `left`, `center`, `right`, and `justify` are the only accepted explicit values;
- omitted `alignment` leaves paragraph alignment inherited/default;
- case variants, whitespace-padded values, aliases, numbers, booleans, null, and unsupported strings are rejected rather than repaired;
- explicit alignment is verified by reopening the generated DOCX and by inspecting WordprocessingML `w:jc` output;
- invalid requests fail before `write_office_document()` can publish a partial artifact; and
- alignment does not change Inkspan's deterministic timestamp normalization or byte-reproducibility contract.

## Ownership and claim limits

Inkspan owns validation and deterministic mapping of the bounded alignment field. Hosts remain responsible for source-format interpretation, authoring and layout policy, export authorization, tenant isolation, durable storage, document distribution, and any richer style system.

The protected capability does not imply fidelity for heading alignment, list/table alignment, paragraph spacing, indentation, tabs, section/page layout, fonts/colors, bidirectional layout policy, or arbitrary Word styles.

## Verification evidence

Protected tests exercise all four values on both plain and bounded rich-text paragraphs, omitted inherited/default behavior, invalid values, deterministic output, WordprocessingML emission, and no-partial-publication failure behavior. The capability remains inside the Office Python 3.11–3.14, 100% shipped production statement/branch coverage, shipped-symbol docstring, wheel, CI, Security Scan, and SAST acceptance envelope.

## References — APA 7th

Microsoft. (n.d.). *Working with paragraphs*. Microsoft Learn. Retrieved August 10, 2026, from https://learn.microsoft.com/en-us/office/open-xml/word/working-with-paragraphs

python-docx. (n.d.). *Working with text*. Retrieved August 10, 2026, from https://python-docx.readthedocs.io/en/latest/user/text.html
