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

## Resource preflight

If a paste is rejected with `input_too_large` or `node_limit_exceeded`, raise
the matching ceiling only after measuring a trusted source. Do not disable the
limits to “make paste work.”

Inkspan rejects an obviously oversized string when its UTF-16 code-unit length
already exceeds `maxHtmlBytes`, before allocating a UTF-8 copy. Every UTF-16
code unit encodes to at least one UTF-8 byte, so that length check is a safe
lower bound. Strings whose code-unit length is within the ceiling still receive
the exact UTF-8 byte-length check, because non-ASCII text can expand.

Inkspan also rejects a broad source tree when already visited nodes, already
queued frames, and newly enqueueable children would exceed `maxNodes`, before
materializing those children. Dropped or hidden subtrees are never traversed
and therefore do not consume descendant budget. The closed-`details` summary
path uses the same queue invariant.

The machine-readable error codes remain stable, while customer-facing rejection
messages give a bounded next action. The preflight checks do not authorize the
remaining HTML. See `docs/doctoring/clipboard-resource-preflight.md` for the
standards basis, test-first evidence, residual risk, and rollback.

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
proprietary property. It removes closed CSS comments and a final comment that
runs to end of input, decodes bounded CSS escape sequences in the property name
and keyword value, compares both case-insensitively, tolerates ordinary
whitespace and a terminal `!important`, and requires the decoded property name
`mso-hide` and decoded value `all`. Escaped equivalents such as
`mso-\68 ide: \61ll` and EOF-commented `mso-hide: all/*` are hidden. Invalid
null, surrogate, out-of-range, trailing, or newline escapes fail to match instead
of being repaired. Values such as `none` or `alligator`, including escaped forms,
and properties such as `not-mso-hide`, remain visible and do not create false
hidden-subtree matches. The complete hidden subtree is dropped, and the source
style attribute is never copied to output.

## Content containment hidden content

Inkspan treats `content-visibility: hidden` as a complete hidden-subtree boundary
because the source document intentionally skips those descendants rather than
rendering them as ordinary content. Detection uses the same bounded raw `style`
declaration parser rather than CSSOM exposure, so supported case, whitespace,
terminal `!important`, CSS-comment, and CSS-escaped property or keyword forms
are handled consistently across controlled DOM environments.

Only the exact decoded property `content-visibility` and exact decoded value
`hidden` match. Values such as `visible`, `auto`, and `hiddenly`, and prefixed
properties such as `not-content-visibility`, remain visible. The source style
attribute is discarded in every case. This policy prevents source-only text from
being unwrapped into ordinary editor prose while avoiding false positives for
content that the source leaves available or renders normally. The complete
decision, standards basis, compatibility boundary, and rollback are recorded in
`docs/doctoring/content-visibility-hidden-content.md`.

## Closed interactive content

HTML disclosure and dialog elements can contain text that is present in source
markup but not rendered to the user. Inkspan therefore treats their boolean
`open` state as part of the hidden-content boundary:

- a closed `<details>` element preserves only the sanitized contents of its
  first `<summary>` element child, when one exists, and drops the additional
  information;
- a closed `<details>` element without a `<summary>` contributes no source text;
- an open `<details>` element unwraps and sanitizes its rendered summary and
  additional information;
- a closed `<dialog>` subtree is dropped completely; and
- an open `<dialog>` unwraps and sanitizes its rendered contents.

The interactive wrapper elements and every source attribute are removed in all
cases. This prevents pasted source-only disclosure or dialog text from becoming
ordinary visible editor content while retaining content that the source document
actually exposed.

## Popover hidden content

The HTML Living Standard defines `popover` as a global attribute whose element is
not rendered until a separate runtime visibility state becomes showing. Static
clipboard HTML retains the attribute but does not preserve whether the source
popover was showing when the content was copied. Removing the attribute and
unwrapping its descendants would therefore promote content hidden by default
into ordinary visible editor prose without evidence that the user saw it.

Inkspan drops the complete subtree of every element that carries a `popover`
attribute. This includes the empty-value Auto state, the defined `auto`, `manual`,
and `hint` keywords, and unrecognized values because the standard maps an invalid
value to the Manual state. Inkspan does not execute invokers or script, call
`showPopover()`, or reconstruct top-layer state. A trusted host with stronger
source provenance may convert a verified visible popover before the content
reaches this untrusted boundary. The standards rationale, test-first evidence,
compatibility limitation, and rollback policy are recorded in
`docs/doctoring/popover-hidden-content.md`.

## Native-widget, suggestion-source, and obsolete fallback content

Current user agents render `<progress>` and `<meter>` as native progress and
gauge widgets from their attributes, while descendant text is intended as a
representation for user agents that do not support those elements. Inkspan does
not preserve the attributes required to reconstruct an equivalent accessible
widget. Unwrapping only the source element would therefore promote fallback text
to ordinary visible editor prose and change the source document's rendering
semantics.

The HTML Living Standard also defines `<datalist>` as a suggestion source for
another form control and states that the element and its children are hidden in
rendering. Its descendants can include fallback content for down-level clients.
Inkspan does not preserve the linked control or `list` relationship, so unwrapping
a `datalist` would promote hidden suggestions or legacy fallback text into
ordinary visible editor prose.

Inkspan drops complete `progress`, `meter`, and `datalist` subtrees rather than
inventing partial conversions. It also drops complete `noframes` and `noembed`
subtrees: both elements are obsolete, and their expected default rendering does
not expose their descendants as ordinary page content. Ordinary content before
and after these elements remains intact.

This is a fail-closed default, not a claim that fallback or suggestion text has
no value. A host that owns a trusted document format may perform an explicitly
reviewed, attribute-aware, accessible conversion before the content reaches the
untrusted clipboard boundary. See
`docs/doctoring/native-widget-fallback-content.md` and
`docs/doctoring/datalist-hidden-suggestion-content.md` for the decision records,
test-first evidence, references, residual risk, and rollback boundaries.

## Removed content

The sanitizer discards complete active, embedded, form, metadata,
resource-fetching, media, SVG, MathML, canvas, template, closed-dialog,
popover-hidden, native-widget fallback, hidden suggestion-source, obsolete
fallback, and hidden subtrees. Closed disclosure widgets retain only the first
rendered summary described above. It also removes comments, Office conditional
metadata, event handlers, IDs, classes, arbitrary ARIA, proprietary Office/Google
attributes, `data-*`, `contenteditable`, and unapproved link attributes.

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

## DOM capability failures

The optional explicit `Document` is a runtime capability, not a trusted type
assertion. Inkspan treats property access and inert-document establishment as
executable behavior: accessors, proxies, revoked proxies, reflection failures
while selecting the ambient document or reading `createElement` or
`implementation.createHTMLDocument`, and failures while invoking
`createHTMLDocument()` fail closed with `dom_unavailable`. The original exception
is not returned, logged, persisted, or forwarded to the host observer.

Inert-document creation failures remain `dom_unavailable` because parsing cannot
begin until that capability has succeeded. Once a usable inert document exists,
parsing, reconstruction, DOM mutation, or serialization failures remain
`invalid_html`. This preserves a stable operator distinction between unavailable
or hostile DOM capability and failure while processing clipboard HTML, without
exposing which property, adapter, proxy, factory, tenant, or private exception
caused rejection. See `docs/doctoring/dom-capability-reflection-redaction.md` for
test-first evidence, standards interpretation, residual risk, and rollback.

## Browser evidence boundary

SafeClipboard itself is implemented on protected `main`. Deterministic jsdom
coverage remains the fast structural/security regression layer, but real browser
fragment parsing and serialization are a separate release-assurance authority.
The active cross-engine assurance PR pins **Playwright 1.62.0** and executes one
versioned synthetic **corpus version** through the supported TipTap/ProseMirror
paste pipeline in Chromium, Firefox, and WebKit on one **exact source head**.

The browser gate records the exact source head, corpus version, browser-test lock
digest, Playwright version, actual engine versions, runner identity, and bounded
synthetic observations. It compares sanitized HTML, resulting ProseMirror JSON,
and rejection behavior and must fail closed when a required engine is missing,
skipped, cancelled, incomplete, or divergent. It uses no generic normalization;
a permitted difference requires a focused regression plus standards basis,
threat analysis, compatibility consequence, and rollback. The committed browser
fixtures are synthetic and the evidence contains no tenant document or
production clipboard payload. The detailed implementation and claim limits are
recorded in `docs/doctoring/cross-engine-rich-clipboard-assurance.md` and
`docs/TEST_STRATEGY.md`.

Until the active browser-assurance PR reaches protected integration, its results
are `implemented_on_active_pr` evidence rather than shipped release authority.
The 0.6.0 rich-clipboard line must not be published without equivalent or stronger
exact-protected-head Chromium, Firefox, and WebKit acceptance.

## Ownership boundary

Inkspan owns clipboard HTML validation, semantic reconstruction, shared editor
integration, bounded errors, deterministic tests, and its protected release
assurance contract. The host still owns:

- clipboard permissions or custom clipboard APIs;
- user notification and recovery UX;
- authentication, authorization, and tenant isolation;
- persistence, retention, audit storage, and data residency;
- downstream HTML rendering and Content Security Policy;
- extension ordering outside the supported shared kit;
- model or AI use of pasted content; and
- legal, privacy, and information-governance policy.

The feature introduces no application network request, storage adapter,
credential, database object, model call, or provider dependency. Browser binary
provisioning belongs to CI/build evidence and does not grant runtime egress to the
sanitizer.
