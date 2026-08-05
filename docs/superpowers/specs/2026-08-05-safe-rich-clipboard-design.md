# Safe rich clipboard ingestion design

**Date:** 2026-08-05  
**Status:** Accepted implementation design with reviewed assurance limits  
**Target:** Inkspan 0.6.0 after a separate exact-head release acceptance

## Buyer-visible problem

Users routinely paste content from Microsoft Word, Google Docs, email clients,
and other web applications. Before this slice, Inkspan let ProseMirror parse the
browser-provided `text/html` representation without a complete product contract
for hidden content, active or embedded elements, proprietary metadata, remote
resource references, event handlers, oversized markup, style-only semantic
formatting, or extension-transform ordering.

The product must preserve useful document structure while making clipboard HTML
safe, bounded, deterministic, explainable to integrators, and identical across
standalone and provider-neutral collaborative editors.

## Standards and framework evidence

The W3C *Clipboard API and Events* Working Draft dated 24 June 2026 identifies
clipboard security and privacy risks, including malicious HTML, hidden data,
referenced online resources, and excessive content. A browser-supplied HTML
representation is therefore untrusted input rather than evidence that the
product's insertion policy has already been satisfied. The dated publication is
a Working Draft and remains work in progress rather than a Recommendation.

TipTap exposes extension-level `transformPastedHTML` hooks before pasted HTML is
parsed and inserted. TipTap extension priority is material: higher-priority
extensions run first and each later transform receives the prior output. Inkspan
therefore assigns SafeClipboard the lowest-practical TipTap extension priority so
it is the final ordinary `transformPastedHTML` transform in the supported shared
kit.

OWASP's Cross Site Scripting Prevention guidance recommends maintained HTML
sanitization when untrusted rich HTML must remain HTML, specifically recommends
DOMPurify, warns that post-sanitization modification can void protection, and
requires regular patching as browser behavior and bypasses evolve. Inkspan uses
a deliberately narrow positive-allowlist reconstruction without adding a runtime
sanitizer dependency. This is not an OWASP endorsement of the bespoke code and
creates an explicit differential-testing, maintenance, and vulnerability-response
obligation.

WHATWG HTML fragment parsing supplies defined error recovery for malformed
markup. Inkspan treats the detached parsed fragment only as an input tree and
creates new output nodes; no source node or arbitrary source attribute is reused.

## Considered approaches

### A. Trust ProseMirror schema parsing

Rejected because it leaves hidden content, proprietary metadata, resource
references, resource exhaustion, and style-derived semantics without an explicit
pre-parse product contract.

### B. Add a general-purpose sanitization dependency

Deferred rather than dismissed. DOMPurify or another maintained sanitizer may
replace or precede the current reconstruction behind the same narrow public
contract. Any future backend still needs Inkspan's semantic allowlist, resource
ceilings, HTML-image rejection, SafeLink policy, final-transform guarantee,
package review, cross-engine fixtures, and exact-head release evidence.

### C. Reconstruct an allowlisted fragment in a detached template

Selected for the bounded first slice. Parse at most a bounded input into an inert
template, iteratively traverse it, and create a new output tree containing only
Inkspan-supported semantic elements and attributes. Unsupported ordinary
containers are unwrapped; dangerous or hidden subtrees are discarded.

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
- `maxNodes`: 10,000 nodes; and
- `maxDepth`: 64 levels.

The original `ClipboardConfig` object is preserved by identity when an editor is
constructed. The shared kit does not spread it or read nested values. Exact own
data-property validation occurs only at the rich-paste boundary. Accessors,
symbols, unknown fields, reflection failures, non-safe integers, zero, negative,
and over-ceiling values fail closed with one redacted
`invalid_configuration` error and an empty rich fragment.

### Errors and host callback

```ts
export type ClipboardSanitizationErrorCode =
  | 'dom_unavailable'
  | 'input_too_large'
  | 'node_limit_exceeded'
  | 'depth_limit_exceeded'
  | 'invalid_configuration'
  | 'invalid_html';

export class ClipboardSanitizationError extends Error {
  readonly code: ClipboardSanitizationErrorCode;
}
```

`CwlEditorProps` adds `clipboard?: ClipboardConfig` and
`onClipboardError?: (error: ClipboardSanitizationError) => void`. The callback
never receives source HTML, text, URLs, attributes, document content, tenant
identifiers, or private parser/reflection exceptions. A throwing host observer is
contained and cannot weaken the rejected-paste result.

### Sanitizer

```ts
sanitizeRichClipboardHtml(
  sourceHtml: string,
  config?: ClipboardConfig,
  documentOverride?: Document | null,
): string
```

The third parameter supports deterministic tests and controlled DOM-capable
hosts. Ordinary consumers omit it. Calling the function without a DOM-capable
document fails closed without touching DOM globals at module import time.

## Allowed content

The reconstructed fragment may contain:

- paragraphs and generic divisions;
- headings 1–6;
- blockquotes, preformatted text, code, line breaks, and horizontal rules;
- strong/bold, emphasis/italic, underline, strike, superscript, and subscript;
- ordered and unordered lists with list items;
- tables, sections, rows, header cells, and data cells; and
- safe hyperlinks accepted by the existing `isSafeLinkHref()` policy.

Only these attributes survive:

- exact SafeLink-approved `href` with fixed
  `rel="noopener noreferrer nofollow"`;
- bounded integer `start` on ordered lists; and
- bounded positive integer `colspan` and `rowspan` on table cells.

All IDs, classes, inline styles, event handlers, `data-*`, arbitrary ARIA,
`target`, `contenteditable`, and proprietary Office/Google attributes are
removed from output.

## Semantic style conversion

Many office applications express visible formatting only through inline style.
Before styles are discarded, four narrowly defined declarations are converted
to semantic wrappers:

- bold font weight to `<strong>`;
- italic or oblique font style to `<em>`;
- underline to `<u>`; and
- line-through to `<s>`.

No color, font family, font size, background, positioning, visibility, generated
content, direction override, or layout style is preserved.

## Dropped content and Office hidden-style handling

The entire subtree is discarded for active, embedded, executable, form,
metadata, resource-fetching, or non-editor namespaces, including script, style,
iframe, object, embed, applet, form controls, template, SVG, MathML, canvas,
media, source, picture, metadata, and stylesheet/base elements.

Elements are also discarded with descendants when they carry `hidden`, a
case-insensitive `aria-hidden="true"`, `display:none`, `visibility:hidden`, or
Office `mso-hide:all`. HTML comments, including Office conditional comments, are
omitted.

Because browser CSS object models do not expose proprietary Office declarations
consistently, `mso-hide` is recognized from the bounded raw `style` declaration.
The parser removes CSS comments, performs exact case-insensitive property and
value comparison, tolerates ordinary whitespace and a terminal `!important`,
and requires property `mso-hide` with value exactly `all`. Values such as `none`
or `alligator`, and names such as `not-mso-hide`, do not create false hidden
matches. The source style attribute is never copied to output.

Every `<img>` in `text/html` is dropped. Binary clipboard image items remain
governed by Base64Image's file type, byte, decode, dimension, and inline-source
policy. This prevents rich HTML from introducing tracking requests, local-file
references, or image data that bypasses the binary-image boundary.

## Integration and transform ordering

`SafeClipboard` is enabled by default through `buildExtensions()`. The original
`ClipboardConfig` object and latest live error observer are supplied to the
extension without evaluating nested configuration during editor construction.
Both `CwlEditor` and `CollaborativeCwlEditor` use the same shared extension.

SafeClipboard has the lowest-practical TipTap extension priority and is the final
ordinary `transformPastedHTML` transform in the supported extension graph. A
real TipTap integration test installs a competing host transform that adds a
script and tracking image, then proves SafeClipboard receives that output last
and removes both before ProseMirror parsing.

A deliberately hostile host can still install a lower-priority transform or
mutate the parsed transaction afterward. Such a lower-priority transform is
outside Inkspan's supported composition contract and voids the claimed pre-parse
boundary unless the host supplies an independently reviewed equivalent later
validation step.

On sanitizer failure, the extension reports one redacted error and returns an
empty rich fragment. It never falls back to unsanitized HTML. Plain-text paste
and binary image paste remain separate browser/ProseMirror and Base64Image paths.

## Security, privacy, and performance invariants

1. No active, embedded, resource-bearing, or hidden subtree survives.
2. No remote or local resource reference survives except a SafeLink hyperlink.
3. No source attribute outside the exact validated allowlist survives.
4. Source nodes are never inserted into the output tree.
5. Input bytes, node count, and depth are bounded before or during traversal.
6. Traversal is iterative to avoid hostile recursion depth.
7. Errors expose only stable codes and bounded static messages.
8. Nested host configuration is not evaluated during editor construction.
9. SafeClipboard is the final ordinary paste transform in the supported kit.
10. The sanitizer performs no network, filesystem, clipboard permission, model,
    provider, storage, credential, or database operation.
11. The feature introduces no database objects.
12. Standalone and collaborative surfaces use the same extension and policy.

## Realistic verification and evidence boundary

Deterministic jsdom tests cover Word-like and Google-Docs-like markup, Office
conditional comments, raw `mso-hide` variants and false positives, semantic
styles, tables and lists, malformed nesting, scripts, forms, foreign content,
resource-bearing elements, remote images, unsafe and credential-bearing links,
UTF-8 byte limits, breadth/depth limits, hostile configuration, DOM-unavailable
execution, callback containment, and error redaction.

Integration tests instantiate the actual TipTap extension manager and verify
priority order and final output. React and Yjs-backed tests prove the original
configuration is not evaluated during construction, paste-time failures are
redacted, the latest callback is used, and the editor/collaboration binding is
not recreated.

No cross-engine browser conformance claim is made by this feature head. jsdom
cannot establish Chromium, Firefox, and WebKit parity for HTML fragment parsing,
CSS declaration handling, inertness, or serialization. Before 0.6.0 publication,
a dependency-locked Playwright differential corpus must pass on supported
Chromium, Firefox, and WebKit engines with identical fixtures, semantic output
assertions, resource-request denial, and failure-output parity. An unpinned
one-off browser download is not release evidence.

Repository acceptance remains 100% production statement, branch, function, and
line coverage; complete public documentation; TypeScript checking;
deterministic builds; isolated packed consumers; Office package gates; security
scans; exact-head review; current non-author approval; and branch protection.

## Maintenance and vulnerability response

Because this slice does not adopt DOMPurify, ContextualWisdomLab accepts direct
maintenance responsibility for the bespoke boundary:

- review relevant browser, TipTap, ProseMirror, jsdom, and HTML parser security
  changes on dependency updates;
- add every confirmed bypass as a failing non-customer regression before fixing;
- keep transform ordering under integration test whenever extension composition
  changes;
- maintain malformed HTML, foreign content, CSS comment/escape, Office hidden
  content, URL interpretation, and serializer differential fixtures;
- publish security advisories and patched releases through exact-head security,
  provenance, independent-review, and release gates; and
- reevaluate DOMPurify or another maintained sanitizer when bespoke maintenance,
  browser variance, or buyer-assurance cost exceeds the dependency/policy cost.

## Release policy

This changes default rich-HTML paste behavior and therefore targets 0.6.0. The
feature remains under `Unreleased` until the integrated feature head passes its
merge gates. Version bumping, tagging, npm publication, provenance, immutable
release creation, and rollback evidence belong to a separate release-only pull
request.

Inkspan 0.6.0 must not be published until the version-pinned cross-engine corpus
and all package, SBOM, provenance, license, security, independent-review,
rollback, and release-acceptance gates pass on the exact published source head.

## References — APA 7th edition

Microsoft Corporation. (n.d.). *Browsers*. Playwright. Retrieved August 5, 2026,
from https://playwright.dev/docs/browsers

Microsoft Corporation. (n.d.). *Continuous integration*. Playwright. Retrieved
August 5, 2026, from https://playwright.dev/docs/ci

Open Worldwide Application Security Project Foundation. (n.d.). *Cross site
scripting prevention cheat sheet*. OWASP Cheat Sheet Series. Retrieved August 5,
2026, from
https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html

Tiptap GmbH. (n.d.). *Extension API*. Tiptap. Retrieved August 5, 2026, from
https://tiptap.dev/docs/editor/extensions/custom-extensions/create-new/extension

WHATWG. (n.d.). *HTML living standard*. Retrieved August 5, 2026, from
https://html.spec.whatwg.org/

World Wide Web Consortium. (2026, June 24). *Clipboard API and events* (W3C
Working Draft). https://www.w3.org/TR/2026/WD-clipboard-apis-20260624/
