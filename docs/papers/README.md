# References & specifications

This module implements a rich-text editing surface whose Markdown mode targets
**CommonMark + GitHub Flavored Markdown (GFM)**. The primary specification the
serializer aims to conform to is bundled here for offline reference and
provenance.

## Bundled specification

- [`commonmark-spec-0.31.2.txt`](./commonmark-spec-0.31.2.txt) — the full
  CommonMark specification, version 0.31.2 (retrieved from
  <https://spec.commonmark.org/0.31.2/spec.txt>).

### Citation

> MacFarlane, John, ed. *CommonMark Spec*, Version 0.31.2. CommonMark, 28 Jan.
> 2024. <https://spec.commonmark.org/0.31.2/>. Licensed under
> CC-BY-SA 4.0. The CommonMark reference implementations are released under a
> BSD-2-Clause / MIT dual license.

The specification defines the canonical rules for how Markdown source maps to a
document tree — the same mapping our `markdownToHtml` / `htmlToMarkdown`
serializers (via `marked` and `turndown`, both MIT) round-trip through, plus the
GFM table and strikethrough extensions.

## Related standards & prior art

- **GitHub Flavored Markdown (GFM)** — a strict superset of CommonMark adding
  tables, task lists, strikethrough, and autolinks.
  <https://github.github.com/gfm/>
- **WHATWG HTML — `contenteditable`** — the browser primitive underneath every
  WYSIWYG editor, including ProseMirror.
  <https://html.spec.whatwg.org/multipage/interaction.html#contenteditable>
- **RFC 2397 — The "data" URL scheme** — the format used to embed images inline
  as base64, which this module relies on so figures travel with the document and
  remain readable by a downstream LLM. <https://datatracker.ietf.org/doc/html/rfc2397>
- **ProseMirror** (Marijn Haverbeke) — the MIT-licensed document model and
  editing toolkit that TipTap v2 is built on. <https://prosemirror.net/>
