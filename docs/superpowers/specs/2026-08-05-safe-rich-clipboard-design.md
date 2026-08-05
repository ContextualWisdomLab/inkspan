# Safe rich clipboard ingestion design

**Date:** 2026-08-05  
**Status:** Approved by the standing autonomous-commercialization mandate  
**Target:** Inkspan after 0.5.29

## Buyer-visible problem

Users routinely paste content from Microsoft Word, Google Docs, email clients,
and other web applications. Inkspan currently lets ProseMirror parse the
browser-provided `text/html` representation directly. The existing schema,
SafeLink transaction filter, and inline-image policy provide important downstream
boundaries, but they do not define a complete clipboard contract for hidden
content, active or embedded elements, proprietary metadata, remote-resource
references, event handlers, oversized markup, or style-only semantic formatting.

The product must preserve useful document structure while making clipboard HTML
safe, bounded, deterministic, explainable to integrators, and identical across
standalone and provider-neutral collaborative editors.

## Standards and framework evidence

The W3C Clipboard API and Events Working Draft dated 24 June 2026 identifies
`text/plain`, `text/html`, and `image/png` as mandatory clipboard
representations. A paste event occurs before insertion and can be intercepted;
the specification explicitly warns about hidden data, malicious JavaScript,
referenced online resources, and excessive clipboard content. It also notes that
user agents may expose unsanitized HTML, so an editor cannot assume the browser
has already established the product's trust boundary.

TipTap exposes ProseMirror `editorProps` and extension-level
`transformPastedHTML` hooks that run before pasted HTML is parsed and inserted.
This is the narrowest integration point that preserves ordinary browser paste
semantics without introducing asynchronous clipboard permissions.

OWASP's Cross Site Scripting Prevention guidance recommends HTML sanitization
for untrusted HTML rather than context-insensitive encoding when rich markup
must be retained. Inkspan applies that principle through a strict positive
allowlist and reconstructs a new fragment instead of mutating or serializing the
untrusted tree.

## Considered approaches

### A. Trust ProseMirror schema parsing

This is the smallest implementation, but it leaves hidden content, proprietary
metadata, remote-resource references, resource exhaustion, and style-derived
semantics without an explicit product contract. Rejected.

### B. Add a general-purpose sanitization dependency

A mature sanitizer reduces parser-security maintenance, but it adds another
runtime dependency and broad HTML/SVG/MathML behavior that Inkspan would still
need to narrow. It also complicates framework-free packaging and supply-chain
review. Deferred as a future interchangeable backend, not selected for the
bounded first slice.

### C. Reconstruct an allowlisted fragment in a detached template

Selected. Parse at most a bounded input into an inert template, iteratively
traverse it, and create a new output tree containing only Inkspan-supported
semantic elements and attributes. Unsupported ordinary containers are unwrapped;
dangerous or hidden subtrees are discarded. No source node or attribute is
reused.

## Public contract

### Configuration

```ts
export interface ClipboardConfig {
  maxHtmlBytes?: number;
  maxNodes?: number;
  maxDepth?: number;
}
```

Defaults:

- `maxHtmlBytes`: 1,048,576 bytes;
- `maxNodes`: 10,000 nodes;
- `maxDepth`: 64 levels.

All values must be finite safe integers in documented ranges. Invalid
configuration fails closed at paste time through a redacted error.

### Errors and host callback

```ts
export type ClipboardSanitizationErrorCode =
  | 'dom_unavailable'
  | 'input_too_large'
  | 'node_limit_exceeded'
  | 'depth_limit_exceeded'
  | 'invalid_configuration';

export class ClipboardSanitizationError extends Error {
  readonly code: ClipboardSanitizationErrorCode;
}
```

`CwlEditorProps` adds `clipboard?: ClipboardConfig` and
`onClipboardError?: (error: ClipboardSanitizationError) => void`. The callback
never receives source HTML, text, URLs, document content, or private parser
exceptions.

### Sanitizer

```ts
sanitizeRichClipboardHtml(
  sourceHtml: string,
  config?: ClipboardConfig,
  documentOverride?: Document,
): string
```

The third parameter is for deterministic testing and controlled browser-like
hosts. Ordinary consumers omit it. Calling the function without a DOM-capable
document fails closed.

## Allowed content

The reconstructed fragment may contain:

- paragraphs and generic divisions;
- headings 1–6;
- blockquotes, preformatted text, code, line breaks, and horizontal rules;
- strong/bold, emphasis/italic, underline, strike, superscript, and subscript;
- ordered and unordered lists with list items;
- tables, sections, rows, header cells, and data cells;
- safe hyperlinks accepted by the existing `isSafeLinkHref()` policy.

Only the following attributes survive:

- safe `href` on links, with fixed `rel="noopener noreferrer nofollow"`;
- bounded integer `start` on ordered lists;
- bounded integer `colspan` and `rowspan` on table cells.

All IDs, classes, inline styles, event handlers, `data-*`, arbitrary ARIA,
`target`, `contenteditable`, and proprietary Office/Google attributes are
removed from the output.

## Semantic style conversion

Many office applications express formatting only through inline style. Before
styles are discarded, four narrowly defined declarations are converted to
semantic wrappers:

- bold `font-weight` to `<strong>`;
- italic or oblique `font-style` to `<em>`;
- underline `text-decoration` to `<u>`;
- line-through `text-decoration` to `<s>`.

No color, font family, font size, background, positioning, visibility, generated
content, direction override, or layout style is preserved.

## Dropped content

The entire subtree is discarded for active, embedded, executable, form,
metadata, resource-fetching, or non-editor namespaces, including script, style,
iframe, object, embed, applet, form controls, template, SVG, MathML, canvas,
media, source, picture, metadata, and stylesheet/base elements.

Elements are also discarded with their descendants when they carry `hidden`,
a case-insensitive `aria-hidden="true"`, or inline declarations equivalent to
`display:none`, `visibility:hidden`, or Office `mso-hide:all`. HTML comments,
including Office conditional comments, are omitted.

All `<img>` elements in `text/html` are dropped. Binary clipboard image items
remain governed by the existing Base64Image size, decoding, and dimension
pipeline. This prevents HTML paste from causing remote image fetches, local-file
references, tracking pixels, or unvalidated inline image ingestion.

## Integration

A `SafeClipboard` TipTap extension implements `transformPastedHTML`. It is part
of `buildExtensions()` by default and receives validated config and the latest
error callback. Both `CwlEditor` and `CollaborativeCwlEditor` pass the same
options, so local and Yjs-backed editing have the same clipboard policy.

On sanitization error, the extension reports one redacted error and returns an
empty fragment. It never falls back to unsanitized HTML. Plain-text clipboard
handling and binary image handling remain the browser/ProseMirror and
Base64Image paths respectively.

## Security, privacy, and performance invariants

1. No active or embedded element survives.
2. No remote or local resource reference survives except a SafeLink hyperlink.
3. No source attribute other than the explicitly validated allowlist survives.
4. Source nodes are never inserted into the output tree.
5. Input bytes, node count, and depth are bounded before or during traversal.
6. Traversal is iterative to avoid hostile recursion depth.
7. Errors expose only stable codes and bounded static messages.
8. The sanitizer never performs network, filesystem, clipboard permission,
   model, provider, storage, credential, or database operations.
9. The feature introduces no database objects.
10. Standalone and collaborative surfaces use the same extension and policy.

## Realistic verification

Tests use Word-like and Google-Docs-like HTML fixtures, hidden tracking data,
remote images, JavaScript and credential-bearing links, Office conditional
comments, tables, lists, semantic styles, malformed nesting, control text,
oversized input, excessive breadth, excessive depth, hostile configuration,
and DOM-unavailable execution.

Integration tests instantiate the shared TipTap kit and prove that the
extension transforms pasted HTML before parsing. React and collaborative tests
prove the latest host error callback is used without recreating the editor.
Repository acceptance remains 100% production statement, branch, function, and
line coverage, complete public docstrings, package consumers, deterministic
builds, security scans, exact-head review, and branch protection.

## Release policy

This changes default rich-HTML paste behavior and therefore targets the next
minor release, 0.6.0. The feature remains under `Unreleased` until the integrated
exact head passes every release gate. Tagging and registry publication are
separate post-merge operations and must not be claimed early.

## References — APA 7th edition

Open Worldwide Application Security Project. (n.d.). *Cross site scripting
prevention cheat sheet*. OWASP Cheat Sheet Series.
https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html

Tiptap GmbH. (2026). *Editor API and custom extension paste transforms*.
https://tiptap.dev/docs/editor/api/editor

World Wide Web Consortium. (2026, June 24). *Clipboard API and events* (W3C
Working Draft). https://www.w3.org/TR/2026/WD-clipboard-apis-20260624/

WHATWG. (2026). *HTML living standard: The template element and parsing HTML
fragments*. https://html.spec.whatwg.org/
