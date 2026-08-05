# Safe rich clipboard ingestion

Inkspan sanitizes `text/html` clipboard content before TipTap/ProseMirror parses
or inserts it. The same policy is active in `CwlEditor` and
`CollaborativeCwlEditor`, so a host does not have to maintain separate paste
rules for local and Yjs-backed documents.

## Default behavior

The default limits are:

| Limit | Default |
| --- | ---: |
| UTF-8 HTML bytes | 1,048,576 |
| Source nodes | 10,000 |
| Source depth | 64 |

```tsx
<CwlEditor
  clipboard={{
    maxHtmlBytes: 1_048_576,
    maxNodes: 10_000,
    maxDepth: 64,
  }}
  onClipboardError={(error) => {
    // Safe for bounded telemetry or an accessible host notification.
    console.warn(error.code);
  }}
/>
```

Configuration is read when the editor instance is created. Error observers are
live: replacing `onClipboardError` does not recreate the editor or Yjs binding.
Invalid configuration fails closed when rich HTML is pasted.

## Preserved structure

Inkspan reconstructs a new fragment containing only:

- paragraphs, divisions, headings, blockquotes, preformatted text, code, line
  breaks, and horizontal rules;
- bold/strong, italic/emphasis, underline, strike, superscript, and subscript;
- ordered and unordered lists;
- tables, table sections, rows, header cells, and data cells;
- hyperlinks that pass Inkspan's existing SafeLink URI policy.

Word and Google Docs often represent visible semantics only through inline
styles. Inkspan converts four narrowly defined styles before discarding all
style attributes:

- bold font weight → `<strong>`;
- italic or oblique font style → `<em>`;
- underline → `<u>`;
- line-through → `<s>`.

No colors, fonts, sizes, backgrounds, positioning, hidden content, direction
overrides, or layout styles survive.

## Removed content

The sanitizer discards complete active, embedded, form, metadata,
resource-fetching, media, SVG, MathML, canvas, template, and hidden subtrees.
It also removes comments, Office conditional metadata, event handlers, IDs,
classes, arbitrary ARIA, proprietary Office/Google attributes, `data-*`,
`contenteditable`, and unapproved link attributes.

Rich HTML `<img>` elements are always removed. This prevents remote tracking
pixels, local-file references, and unvalidated data URIs. A binary image copied
through the clipboard remains supported by the existing Base64Image pipeline,
which applies file type, byte, decode, dimension, and inline-source policies.

Unsafe links are unwrapped while their visible text is retained. Safe links keep
only the exact `href` and receive
`rel="noopener noreferrer nofollow"`. Inkspan never trims or repairs an
untrusted link into a different browser interpretation.

## Errors

`ClipboardSanitizationError.code` is one of:

```text
dom_unavailable
input_too_large
node_limit_exceeded
depth_limit_exceeded
invalid_configuration
invalid_html
```

Messages are static and do not contain the source HTML, URLs, clipboard text,
attribute values, private parser exceptions, tenant identifiers, or document
content. On rejection, the rich fragment becomes empty; Inkspan never falls back
to unsanitized HTML.

## Direct sanitizer API

Hosts can apply the exact same policy outside the React component:

```ts
import { sanitizeRichClipboardHtml } from '@contextualwisdomlab/cwl-editor';

const safeHtml = sanitizeRichClipboardHtml(untrustedHtml);
```

The function needs a DOM-capable document at call time but does not touch DOM
globals at module import time. SSR can import Inkspan safely; invoke this API in
a browser, jsdom-like controlled environment, or pass an explicit `Document` as
the third argument.

## Ownership boundary

Inkspan owns clipboard HTML validation, semantic reconstruction, shared editor
integration, bounded errors, and deterministic tests. The host still owns:

- clipboard permissions or custom clipboard APIs;
- user notification and recovery UX;
- authentication, authorization, and tenant isolation;
- persistence, retention, audit storage, and data residency;
- downstream HTML rendering and Content Security Policy;
- model or AI use of pasted content;
- legal, privacy, and information-governance policy.

The feature introduces no network request, storage adapter, credential,
database object, model call, or provider dependency.
