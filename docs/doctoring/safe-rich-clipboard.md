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
reconstruction rather than trusting source nodes, applying regular expressions
to raw HTML, or adding a broad sanitizer dependency. The boundary preserves only
Inkspan-supported semantic content, enforces explicit resource ceilings, reuses
the existing SafeLink URI policy, removes every HTML image and resource-bearing
element, and reports only stable redacted errors.

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

The W3C Clipboard API and Events Working Draft dated 24 June 2026 defines
`text/plain`, `text/html`, and `image/png` as mandatory clipboard data types. A
paste event occurs before insertion and is cancelable. Its security and privacy
section identifies hidden data, malicious JavaScript, referenced online
resources, and excessive clipboard content as explicit risks. The specification
also exposes unsanitized HTML in some operations, so browser provenance is not
sufficient evidence that HTML is safe for product insertion.

TipTap delegates editor properties to ProseMirror and supports extension-level
`transformPastedHTML`, which transforms clipboard HTML before parsing. This
hook is the narrowest synchronous control point that retains ordinary paste
selection and parsing behavior without requesting asynchronous clipboard access.

OWASP's XSS prevention guidance recommends HTML sanitization when untrusted rich
HTML must remain HTML. Inkspan adopts a positive allowlist and reconstructs new
nodes; it does not attempt context-insensitive encoding or blacklist-only
removal.

WHATWG HTML fragment parsing supplies deterministic error recovery for malformed
markup. A detached template is treated only as an input tree. Inkspan never
inserts that tree, invokes scripts, follows resources, or copies arbitrary
attributes from it.

## Rejected alternatives

### Trust schema parsing alone

Rejected because it does not state or test product behavior for hidden
subtrees, proprietary metadata, remote resource references, resource ceilings,
or style-only semantic formatting.

### Regular-expression sanitization

Rejected because HTML tokenization, nesting, comments, foreign content, and
malformed markup require an HTML parser. Regex remains limited to already parsed
bounded integer attribute values.

### General-purpose sanitizer dependency

Deferred. A maintained sanitizer can be offered later behind the same contract,
but the first bounded slice would still need a narrower element/attribute
policy, resource ceilings, HTML-image removal, shared editor integration, and
package/supply-chain review. The selected implementation adds no runtime
dependency.

## Semantic allowlist

The output may contain paragraphs, generic divisions, headings, blockquotes,
preformatted text, code, line breaks, horizontal rules, semantic emphasis,
ordered and unordered lists, tables, and SafeLink-approved hyperlinks.
Equivalent presentational tags are normalized (`b`→`strong`, `i`→`em`,
`strike`→`s`). Unsupported ordinary containers are unwrapped so visible text is
retained.

Only these attributes survive:

- exact SafeLink `href` and fixed `rel="noopener noreferrer nofollow"`;
- bounded integer `start` on ordered lists;
- bounded positive integer `colspan` and `rowspan` on table cells.

Four inline style semantics are converted before all style attributes are
removed: bold weight, italic/oblique style, underline, and line-through. Color,
font, size, background, positioning, visibility, generated content, and layout
are discarded.

## Dropped subtrees and privacy boundary

Active, embedded, executable, form, metadata, resource-fetching, template,
SVG, MathML, canvas, media, source, picture, and HTML image elements are removed
with all descendants. Elements carrying `hidden`, case-insensitive
`aria-hidden="true"`, `display:none`, `visibility:hidden`, or Office
`mso-hide:all` are removed with descendants. Comments, including Office
conditional comments, are omitted.

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
100,000 nodes, and 256 levels. Configuration is inspected through exact own data
property descriptors; accessors, symbols, unknown fields, non-integers, and
reflection failures are rejected.

Traversal is iterative and preserves source order by pushing children in
reverse. Source nodes and attributes are never reused. The parser must allocate
at most the bounded input representation; traversal and output work are linear
in the accepted node and text volume.

## Modular ownership

| Concern | Inkspan | Host / naruon / CWL service |
| --- | --- | --- |
| HTML byte/node/depth ceilings | Owns | May choose lower valid limits |
| Semantic element and attribute allowlist | Owns | Cannot bypass through props |
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

Deterministic tests cover Word-like and Google-Docs-like markup, Office
conditional comments, semantic styles, tables and list attributes, hidden data,
resource-bearing elements, scripts, forms, SVG/MathML, remote images, unsafe and
credential-bearing links, malformed nesting, unsupported containers, UTF-8 byte
limits, node and depth limits, invalid/accessor/symbol/reflection-hostile config,
DOM-unavailable invocation, host callback failure, and exact error redaction.

React integration tests prove that standalone and Yjs-backed editors install the
same extension and route failures to the latest callback without recreating the
editor or collaboration binding. Repository acceptance remains 100% production
statement, branch, function, and line coverage; complete public documentation;
TypeScript checking; deterministic builds; packed consumers; Office package
gates; security scans; exact-head review; and branch protection.

## Release boundary

Default rich-HTML paste behavior changes, so this feature targets Inkspan 0.6.0.
It remains under `Unreleased` until the integrated feature head and a later
release-only head pass all required gates. A merge does not imply a tag, npm
publication, provenance, or immutable GitHub Release.

## References — APA 7th edition

Open Worldwide Application Security Project. (n.d.). *Cross site scripting
prevention cheat sheet*. OWASP Cheat Sheet Series.
https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html

Tiptap GmbH. (2026). *Editor API*. https://tiptap.dev/docs/editor/api/editor

WHATWG. (2026). *HTML living standard*. https://html.spec.whatwg.org/

World Wide Web Consortium. (2026, June 24). *Clipboard API and events* (W3C
Working Draft). https://www.w3.org/TR/2026/WD-clipboard-apis-20260624/
