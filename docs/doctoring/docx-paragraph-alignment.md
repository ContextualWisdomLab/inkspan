# DOCX paragraph alignment doctoring

Implementation maturity: `implemented_on_protected_main`

## Scope

Inkspan Office exposes one bounded horizontal-alignment contract for DOCX `paragraph` and `rich_paragraph` blocks. The only accepted values are `left`, `center`, `right`, and `justify`. The field is optional; omission leaves the paragraph without a directly applied justification value so Word may inherit alignment from its style hierarchy.

The contract deliberately does not expose arbitrary style names, indentation, spacing, tabs, page/section layout, raw WordprocessingML, HTML/Markdown interpretation, bidi reordering, models, network access, credentials, persistence, or tenant authority.

## Standards and implementation trace

Microsoft's WordprocessingML paragraph guidance identifies paragraph properties (`w:pPr`) as the location for paragraph-level formatting such as justification. Inkspan does not construct those elements directly. It uses the public `python-docx` paragraph alignment API, whose `WD_PARAGRAPH_ALIGNMENT` values include left, center, right, and justify. `python-docx` also documents `None` as the absence of direct alignment, allowing inheritance from the style hierarchy.

Accordingly, the product boundary is:

- exact JSON strings become explicit public `python-docx` alignment enum values;
- omitted `alignment` stays omitted rather than being coerced to left alignment;
- unsupported/case-variant/padded/non-string/null values fail closed rather than being repaired;
- explicit alignment is verified both through a `python-docx` round-trip and generated WordprocessingML `w:jc` evidence;
- the existing deterministic output and atomic publication boundaries remain authoritative.

## Evidence and limitations

Protected PR #130 established a fail-first contract on the absence of the schema/runtime feature, then added the four-value schema and renderer mapping. The exact implementation head passed CI, Security Scan, and SAST, including Office Python 3.11–3.14, 100% shipped production statement/branch coverage, shipped-symbol docstring coverage, wheel/package verification, root TypeScript coverage/package verification, and the cross-engine clipboard release lane.

The evidence supports only the four explicit horizontal alignment values. It does not establish support for Word's complete set of paragraph justification modes or for general paragraph styling. Any expansion requires its own compatibility and deterministic-rendering evidence.

## Security, privacy, and ownership

Alignment is presentation metadata inside an already-authorized Office render request. It creates no network/file read, macro, external relationship, model, credential, persistence, or tenant capability. Hosts remain responsible for deciding whether alignment from an editor/source document should be mapped into the request, and for authorization, tenant isolation, durable storage, distribution, and document-template policy.

## Rollback

The feature can be rolled back by removing the optional schema property and runtime mapping together. Unknown-field validation then rejects alignment-bearing requests, while older requests that omit the property retain their previous behavior. Silent lossy fallback is not part of the contract.

## References — APA 7th

Microsoft. (n.d.). *Working with paragraphs*. Microsoft Learn. Retrieved August 10, 2026, from https://learn.microsoft.com/en-us/office/open-xml/word/working-with-paragraphs

python-docx. (n.d.). *WD_PARAGRAPH_ALIGNMENT — python-docx 1.2.0 documentation*. Retrieved August 10, 2026, from https://python-docx.readthedocs.io/en/latest/api/enum/WdAlignParagraph.html

python-docx. (n.d.). *Text-related objects — python-docx 1.2.0 documentation*. Retrieved August 10, 2026, from https://python-docx.readthedocs.io/en/latest/api/text.html