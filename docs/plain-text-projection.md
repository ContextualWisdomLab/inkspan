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
- unordered markers, ordered-list start numbers, and two-space nesting depth;
- table cells separated by tabs and rows separated by line breaks;
- link labels without hyperlink destinations;
- image alternative text by default.

Code-token indentation, consecutive spaces, and blank lines remain verbatim.
List structure remains distinguishable from ordinary adjacent lines, including
ordered lists whose configured start is not `1` and nested mixed list types.

It does not emit other Markdown delimiters, HTML element names or attributes,
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

## Next-release parser resource bounds

Status: `implemented_on_active_pr` in #174. Protected `main` does not yet expose
these plain-text-specific options, so this section is not a shipped-release
claim.

The active contract accepts `maxMarkdownBytes` on `markdownToPlainText()` and
checks the exact UTF-8 byte size before the Marked lexer materializes tokens.
The inherited Markdown parser policy defaults to 16 MiB and rejects configured
limits above the 64 MiB hard maximum. Invalid configuration and oversized input
fail closed through the same stable, payload-redacted Markdown resource errors
used by the shared Markdown package boundary.

`htmlToPlainText()` additionally accepts `maxHtmlBytes`. That ceiling is checked
before HTML normalization, and `maxMarkdownBytes` is checked again on the
normalized Markdown before it enters the plain-text lexer. The two bounds are
intentionally independent because HTML normalization can change representation
size. Accepted-input reading-order, list/table/code, image-alt, link-label and
raw-HTML omission semantics remain unchanged.

These local parser bounds are defense in depth, not transport or persistence
authority. Hosts still own request/ingress limits, authorization, tenancy,
durable storage, retention and operational admission control.

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
