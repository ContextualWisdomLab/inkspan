# Plain-text projection

Inkspan exposes deterministic Markdown/HTML-to-text helpers for search indexing,
LLM context construction, email previews, audit logs, and host-owned document
analytics:

```ts
import {
  htmlToPlainText,
  markdownToPlainText,
} from '@contextualwisdomlab/cwl-editor';

const markdownText = markdownToPlainText(
  '# Update\n\n[Read more](https://example.com/private)\n\n![Chart](data:image/png;base64,...)',
);
// Update\n\nRead more\n\nChart

const htmlText = htmlToPlainText(
  '<p>Read <a href="https://example.com/private">the report</a>.</p>',
);
// Read the report.
```

## Contract

The projection preserves authored reading order and emits:

- heading, paragraph, blockquote, code, and explicit line-break text;
- list items separated by line breaks;
- table cells separated by tabs and rows separated by line breaks;
- link labels without hyperlink destinations;
- image alternative text by default.

It does not emit Markdown delimiters, HTML element names or attributes,
hyperlink targets, image sources, or inline base64 payloads. Raw Markdown HTML
blocks and link-definition records are omitted rather than interpreted. This is
a projection for text-bearing host workflows, not an HTML sanitizer or a
replacement for Inkspan's safe HTML serializer.

Set `includeImageAlt: false` when a downstream workflow must exclude all image
metadata:

```ts
markdownToPlainText(markdown, { includeImageAlt: false });
htmlToPlainText(html, { includeImageAlt: false });
```

Decorative images with an explicit empty alternative remain silent under the
default policy. Informative image alternatives remain in reading order, which
allows indexing and AI workflows to retain author-supplied non-visual meaning
without receiving image bytes.

## Runtime and interoperability boundary

`markdownToPlainText` uses Marked's lexer and does not execute raw HTML, open a
network connection, resolve a URL, or require React/TipTap editor state.
`htmlToPlainText` first uses Inkspan's existing HTML-to-Markdown normalization
and then applies the same deterministic projection. Both functions are exported
from the main package entrypoint for CWL infrastructure and naruon integration.

Hosts remain responsible for document authorization, retention, redaction, and
whether projected text may be sent to an embedding model or LLM. A safe
projection prevents markup and source-attribute leakage; it does not make the
authored prose non-sensitive.

## Design references

- Marked lexer and token-walking documentation: <https://marked.js.org/using_pro>
- CommonMark 0.31.2: <https://spec.commonmark.org/0.31.2/>
- GitHub Flavored Markdown specification: <https://github.github.com/gfm/>
- W3C plain-text structural techniques: <https://www.w3.org/TR/WCAG20-TECHS/text>
