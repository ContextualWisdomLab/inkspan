# DOCX bounded rich-text runs — standards and implementation doctoring

Status: Implemented on protected main

Inkspan Office exposes a deterministic `rich_paragraph` DOCX block whose ordered `runs` preserve caller-supplied text and only three explicit character-formatting decisions: `bold`, `italic`, and `underline`. The renderer does not infer formatting from Markdown or HTML and does not add hyperlinks, arbitrary styles, fonts, colors, field codes, macros, tracked changes, embedded objects, model inference, network access, credentials, or host persistence.

## Authority and rationale

WordprocessingML represents a paragraph as block-level content containing one or more runs. A run (`w:r`) groups inline text with a common set of optional run properties (`w:rPr`); Microsoft documents bold, italic, and underline among those run properties. The protected implementation therefore maps each validated input run to one WordprocessingML run and applies only the requested formatting properties.

`python-docx` 1.2.0 likewise models inline text through `Run` objects and exposes character formatting through run/font properties. Its documentation describes bold and italic as tri-state properties and underline as a tri-state/enumerated hybrid. Inkspan deliberately narrows that richer library API: a missing JSON formatting key leaves the Word run property inherited, while an explicit JSON boolean maps to the corresponding `python-docx` run property. The public JSON contract does not expose `None`, enumerated underline styles, fonts, colors, or arbitrary Word style names.

## Product and security boundary

- `runs` is non-empty and bounded to 4,096 entries in both schema and runtime validation.
- Every run requires non-empty string `text`; whitespace-only text remains valid content.
- Unknown run keys and non-boolean formatting flags fail closed.
- Existing request-size, total-string, XML 1.0, nesting, alias/cycle, deterministic-output, and atomic-publication controls remain authoritative.
- Failed validation cannot publish a partial Office artifact through `write_office_document()`.
- Logical run order, including Unicode/CJK/combining/bidirectional text, is caller-owned content and is not reordered by Inkspan.
- Hosts remain responsible for source authoring policy, export authorization, tenant isolation, durable storage, distribution, and any mapping from rich editor marks into the Office request.

## Verification

Protected-main regression evidence re-opens generated DOCX files with `python-docx`, inspects WordprocessingML run/run-property markup, verifies ordered text and explicit true/false emphasis, exercises deterministic byte output, and rejects empty/oversized/malformed run collections without partial publication. The Office CI matrix remains Python 3.11–3.14 with shipped production statement/branch coverage and shipped-symbol docstring gates at 100%.

## Rollback and extension discipline

The feature is additive. A host can roll back by emitting ordinary `paragraph` blocks instead of `rich_paragraph`. Future hyperlinks, arbitrary styles, typography, tracked changes, comments, or other inline constructs require a separate reviewed contract and must not be smuggled through the current run object.

## References — APA 7th

Microsoft. (2024, January 12). *Working with runs*. Microsoft Learn. https://learn.microsoft.com/en-us/office/open-xml/word/working-with-runs

python-docx. (n.d.). *Text-related objects: Run*. In *python-docx 1.2.0 documentation*. Retrieved August 10, 2026, from https://python-docx.readthedocs.io/en/stable/api/text.html

python-docx. (n.d.). *Working with text*. In *python-docx 1.2.0 documentation*. Retrieved August 10, 2026, from https://python-docx.readthedocs.io/en/latest/user/text.html
