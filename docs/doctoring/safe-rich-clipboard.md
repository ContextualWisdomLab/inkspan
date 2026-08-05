# Doctoring record: Safe rich clipboard ingestion

**Date:** 2026-08-05  
**Target release:** Unreleased after Inkspan 0.5.29  
**Decision owner:** ContextualWisdomLab  
**Scope:** Browser-provided `text/html` clipboard content before TipTap/ProseMirror parsing.

## Decision summary

Inkspan reconstructs rich clipboard HTML into a new allowlisted fragment before
ProseMirror parses it. The sanitizer is enabled by default through the shared
extension kit and therefore applies identically to the standalone React editor
and provider-neutral Yjs collaborative editor.

The selected implementation uses a detached HTML template and iterative tree
reconstruction rather than trusting source nodes or applying regular expressions
to raw HTML. The boundary preserves only Inkspan-supported semantic content,
enforces explicit resource ceilings, reuses the existing SafeLink URI policy,
removes every HTML image and resource-bearing element, and reports only stable
redacted errors.

The implementation remains a deliberately narrow bespoke sanitizer rather than
a claim that OWASP endorses this code. OWASP recommends maintained HTML
sanitization, specifically naming DOMPurify, and warns that modification after
sanitization can void the protection. The no-new-runtime-dependency decision is
therefore paired with explicit transform-order, differential-browser, corpus,
patch-response, and vulnerability-response obligations recorded below.

## Buyer-visible gap

Enterprise users paste from Microsoft Word, Google Docs, email clients, support
systems, wikis, and arbitrary web pages. Those sources commonly include Office
conditional metadata, proprietary classes, style-only formatting, hidden text,
remote images, tracking pixels, forms, embedded objects, event handlers, and
markup far larger or deeper than the visible document.

Before this change, Inkspan's ProseMirror schema, SafeLink transaction filter,
and Base64Image source policy were downstream protections, but the product did
not define a complete pre-parse clipboard trust boundary. Buyers therefore had
to add inconsistent host-specific sanitizers or accept ambiguous paste behavior.

## Standards interpretation

The W3C *Clipboard API and events* Working Draft dated 24 June 2026 defines
clipboard event behavior and identifies security and privacy risks for HTML and
multi-part clipboard data. A paste event occurs before insertion and is
cancelable. Browser provenance is not evidence that supplied HTML is safe for a
product editor. The document is a Working Draft rather than a Recommendation;
W3C explicitly identifies it as a work in progress that may be updated,
replaced, or obsoleted.

TipTap exposes extension-level `transformPastedHTML` before pasted HTML is parsed
and inserted. Current TipTap extension documentation also states that extensions
are sorted by priority, higher priority runs first, every transform receives the
prior transform's output, and the final transformed HTML is parsed. Inkspan
therefore assigns SafeClipboard the lowest-practical TipTap extension priority so
it is the final ordinary `transformPastedHTML` transform in the supported shared
kit. The exact TipTap extension priority and TipTap transformPastedHTML contracts
are represented in deterministic integration tests rather than inferred from
extension array order alone.

A host can deliberately install a lower-priority transform or mutate the parsed
transaction later. Such a lower-priority transform is outside the supported
composition contract because it can reintroduce unsafe markup after
SafeClipboard. The host must preserve SafeClipboard as the final ordinary
`transformPastedHTML` transform or provide and independently verify an equivalent
later validation boundary.

OWASP's XSS prevention guidance recommends HTML sanitization when untrusted rich
HTML must remain HTML, recommends DOMPurify, warns against modification after
sanitization, and requires regular sanitizer patching because browsers and
bypasses change. Inkspan follows the positive-allowlist principle but does not
claim parity with DOMPurify's maturity or vulnerability-response history.

WHATWG HTML fragment parsing supplies defined error recovery for malformed
markup. A detached template is treated only as an input tree. Inkspan never
inserts that source tree, invokes scripts, follows resources, or copies arbitrary
attributes from it.

## Rejected alternatives

### Trust schema parsing alone

Rejected because it does not state or test product behavior for hidden
subtrees, proprietary metadata, remote resource references, resource ceilings,
or style-only semantic formatting.

### Regular-expression sanitization

Rejected because HTML tokenization, nesting, foreign content, and malformed
markup require an HTML parser. Regular expressions are limited to already parsed
bounded integer attribute values and a bounded raw inline-style declaration scan
for the proprietary Office `mso-hide` property that browser CSS object models do
not expose consistently.

### General-purpose sanitizer dependency

Deferred, not dismissed. OWASP recommends DOMPurify for untrusted HTML. A future
maintained sanitizer may replace or precede the current reconstruction behind the
same public contract, but it would still require Inkspan's narrow
semantic/attribute policy, resource ceilings, HTML-image rejection, SafeLink
policy, final-transform guarantee, package review, deterministic fixtures, and
cross-engine evidence. The present slice introduces no runtime dependency, but
that supply-chain reduction transfers maintenance and vulnerability-response
obligation to ContextualWisdomLab.

## Semantic allowlist

The output may contain paragraphs, generic divisions, headings, blockquotes,
preformatted text, code, line breaks, horizontal rules, semantic emphasis,
ordered and unordered lists, tables, and SafeLink-approved hyperlinks.
Equivalent presentational tags are normalized (`b`→`strong`, `i`→`em`,
`strike`→`s`). Unsupported ordinary containers are unwrapped so visible text is
retained.

Only these attributes survive:

- exact SafeLink `href` and fixed `rel="noopener noreferrer nofollow"`;
- bounded integer `start` on ordered lists; and
- bounded positive integer `colspan` and `rowspan` on table cells.

Four inline style semantics are converted before all style attributes are
removed: bold weight, italic/oblique style, underline, and line-through. Color,
font, size, background, positioning, visibility, generated content, and layout
are discarded.

## Dropped subtrees and privacy boundary

Active, embedded, executable, form, metadata, resource-fetching, template, SVG,
MathML, canvas, media, source, picture, and HTML image elements are removed with
all descendants. Elements carrying `hidden`, case-insensitive
`aria-hidden="true"`, `display:none`, `visibility:hidden`, or Office
`mso-hide:all` are removed with descendants. Comments, including Office
conditional comments, are omitted.

Office hidden-content detection reads the bounded raw `style` attribute, removes
CSS comments, splits declarations, and requires an exact case-insensitive
`mso-hide` property with exact value `all`, optionally followed by terminal
`!important`. This avoids relying on engine-specific CSSOM support while
rejecting misleading values such as `alligator` and property names such as
`not-mso-hide`. No source style attribute survives reconstruction.

All HTML images are removed even when their source appears to be a data URI.
Binary clipboard image items use the pre-existing Base64Image pipeline instead.
This prevents a rich HTML paste from introducing tracking requests, local-file
references, or image data that bypasses the image byte/decode/dimension policy.

Errors never contain source HTML, plain text, URLs, attributes, parser details,
tenant identifiers, or document content. Host error observers are isolated so a
throwing observer cannot weaken the fail-closed paste result.

## Resource and algorithmic bounds

Default ceilings are one MiB of UTF-8 HTML, 10,000 traversed source nodes, and
64 source-tree levels. Public configuration has absolute maxima of 16 MiB,
100,000 nodes, and 256 levels. The original nested host configuration is
preserved by identity during editor construction and is inspected only at paste
through exact own data property descriptors. Accessors, symbols, unknown fields,
non-integers, and reflection failures are rejected without leaking private
errors.

Traversal is iterative and preserves source order by pushing children in
reverse. Source nodes and attributes are never reused. The parser must allocate
at most the bounded input representation; traversal and output work are linear
in the accepted node and text volume.

## Modular ownership

| Concern | Inkspan | Host / naruon / CWL service |
| --- | --- | --- |
| HTML byte/node/depth ceilings | Owns | May choose lower valid limits |
| Semantic element and attribute allowlist | Owns | Cannot bypass through supported props |
| Final ordinary paste transform | Owns in shared kit | Must not install a later lower-priority transform |
| SafeLink validation | Reuses and owns | Supplies ordinary document links |
| HTML image rejection | Owns | Uses binary-image pipeline or separate upload UX |
| Error code and redaction | Owns | Chooses accessible notification/telemetry |
| Clipboard permissions | Does not own | Owns |
| Authentication and tenant isolation | Does not own | Owns |
| Persistence, retention, audit, residency | Does not own | Owns |
| Downstream CSP and rendering | Does not own | Owns |
| Model/AI handling of pasted content | Does not own | Owns |

No database object, migration, scheduler, credential, provider, model call,
network client, or storage adapter is introduced. Standalone and collaborative
editors share the same extension and callback-liveness pattern.

## Verification strategy

Deterministic jsdom tests cover Word-like and Google-Docs-like markup, Office
conditional comments, semantic styles, tables and list attributes, hidden data,
raw `mso-hide` declaration variants and false positives, resource-bearing
elements, scripts, forms, SVG/MathML, remote images, unsafe and
credential-bearing links, malformed nesting, unsupported containers, UTF-8 byte
limits, node and depth limits, invalid/accessor/symbol/reflection-hostile config,
DOM-unavailable invocation, host callback failure, and exact error redaction.

A real TipTap extension-manager regression installs a competing transform that
reintroduces a script and tracking image and proves SafeClipboard runs last and
removes both before parsing. React integration tests prove that standalone and
Yjs-backed editors preserve the untrusted configuration without evaluating
nested accessors during construction, validate it at paste time, install the same
extension, and route failures to the latest callback without recreating the
editor or collaboration binding.

No Chromium, Firefox, or WebKit conformance claim is made by this slice. jsdom
evidence does not establish cross-engine HTML parsing, CSS declaration handling,
inertness, or serialization parity. The compensating acceptance plan is a
version-pinned Playwright differential corpus executed against current Chromium,
Firefox, and WebKit with identical source fixtures, semantic output assertions,
resource-request denial, and failure-output parity. That test infrastructure must
be dependency-locked and reproducible; an unpinned package download in CI is not
acceptable evidence.

Repository acceptance remains 100% production statement, branch, function, and
line coverage; complete public documentation; TypeScript checking;
deterministic builds; packed consumers; Office package gates; security scans;
exact-head review; and branch protection.

## Vulnerability response and maintenance

Because this slice does not adopt DOMPurify, ContextualWisdomLab accepts a direct
vulnerability-response obligation for the bespoke boundary:

- review upstream browser, TipTap, ProseMirror, jsdom, and HTML parsing security
  changes on every dependency update;
- add every confirmed bypass as a failing non-customer regression before fixing;
- maintain differential browser fixtures for malformed HTML, foreign content,
  CSS comments/escapes, hidden Office content, URL interpretation, and serializer
  differences;
- keep transform ordering under integration test whenever extension composition
  changes;
- publish security advisories and patched releases through the repository's
  normal exact-head security and provenance gates; and
- reevaluate DOMPurify or another maintained sanitizer when the bespoke
  maintenance burden, corpus variance, or buyer assurance cost exceeds the
  dependency and policy cost.

## Release boundary

Default rich-HTML paste behavior changes, so this feature targets Inkspan 0.6.0.
It remains under `Unreleased` until the integrated feature head and a later
release-only head pass all required gates. A merge does not imply a tag, npm
publication, provenance, or immutable GitHub Release.

Inkspan 0.6.0 must not be published until the cross-engine corpus passes on
version-pinned Chromium, Firefox, and WebKit, or an explicit security decision
records why one engine is technically unsupported and what equivalent evidence
replaces it. The release head must also prove the package, SBOM, provenance,
license, security, independent-review, rollback, and release-acceptance gates on
the exact published source head.

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
