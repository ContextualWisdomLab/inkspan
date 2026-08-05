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

The nested clipboard configuration is preserved by identity when the editor is
created and validated only when rich HTML is pasted. Inkspan copies no nested
configuration values and performs no nested spread, so the editor can be created
without evaluating accessors or proxy traps during editor construction. At the
paste boundary, Inkspan accepts only exact enumerable own data properties with
supported names and bounded positive safe-integer values. Accessors, symbols,
unknown keys, reflection failures, and malformed values fail closed with the
redacted `invalid_configuration` error.

Error observers are live: replacing `onClipboardError` does not recreate the
editor or the Yjs binding. A host callback failure is contained and cannot make
rejected HTML enter the document.

## Preserved structure

Inkspan reconstructs a new fragment containing only:

- paragraphs, divisions, headings, blockquotes, preformatted text, code, line
  breaks, and horizontal rules;
- bold/strong, italic/emphasis, underline, strike, superscript, and subscript;
- ordered and unordered lists;
- tables, table sections, rows, header cells, and data cells; and
- hyperlinks that pass Inkspan's existing SafeLink URI policy.

Word and Google Docs often represent visible semantics only through inline
styles. Inkspan converts four narrowly defined styles before discarding all
style attributes:

- bold font weight → `<strong>`;
- italic or oblique font style → `<em>`;
- underline → `<u>`; and
- line-through → `<s>`.

No colors, fonts, sizes, backgrounds, positioning, hidden content, direction
overrides, or layout styles survive.

## Hidden Office content

Browser CSS object models do not expose every proprietary Office declaration
consistently. Inkspan therefore detects `mso-hide: all` from the bounded raw
`style` declaration rather than relying on `CSSStyleDeclaration` support for the
proprietary property. It removes CSS comments, compares the property name and
value case-insensitively, tolerates ordinary whitespace and a terminal
`!important`, and requires the exact property name `mso-hide` and exact value
`all`. Values such as `none` or `alligator`, and properties such as
`not-mso-hide`, remain visible and do not create false hidden-subtree matches.
The complete hidden subtree is dropped, and the source style attribute is never
copied to output.

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

## Paste-transform ordering

TipTap registers extension hooks by extension priority and chains
`transformPastedHTML` results. Inkspan assigns SafeClipboard the
lowest-practical TipTap extension priority so it is the final ordinary
`transformPastedHTML` transform in the shared extension set. A deterministic
integration regression installs a competing host transform that reintroduces an
image and script, then proves SafeClipboard receives that output last and removes
both before ProseMirror parsing.

A deliberately hostile host can still install a lower-priority transform or
mutate the parsed transaction after the sanitizer. That lower-priority transform
is outside Inkspan's supported composition contract and voids the pre-parse
safety guarantee. Hosts must keep SafeClipboard as the final ordinary
`transformPastedHTML` transform and must subject any later transaction mutation
to an independently reviewed equivalent validation boundary.

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
a browser, a jsdom-like controlled environment, or pass an explicit `Document`
as the third argument.

## Browser evidence boundary

The current deterministic corpus runs in jsdom and proves the repository's
allowlist, bounds, error redaction, integration wiring, transform ordering, and
known Office/Google fixtures. It does not by itself prove parser, CSS, or
serialization parity across Chromium, Firefox, and WebKit. The doctoring record
therefore treats cross-engine differential execution as a release-acceptance
gate for the future 0.6.0 publication rather than claiming browser conformance
from jsdom evidence.

## Ownership boundary

Inkspan owns clipboard HTML validation, semantic reconstruction, shared editor
integration, bounded errors, and deterministic tests. The host still owns:

- clipboard permissions or custom clipboard APIs;
- user notification and recovery UX;
- authentication, authorization, and tenant isolation;
- persistence, retention, audit storage, and data residency;
- downstream HTML rendering and Content Security Policy;
- extension ordering outside the supported shared kit;
- model or AI use of pasted content; and
- legal, privacy, and information-governance policy.

The feature introduces no network request, storage adapter, credential,
database object, model call, or provider dependency.
