# Untrusted HTML import security contract

Inkspan treats every HTML string supplied to `htmlToMarkdown` as untrusted
content. The conversion surface is used by editor import, naruon compose flows,
previews, indexing, and AI context preparation, so it must not turn an import
operation into script execution, a remote-resource request, or a transport for
unsafe destinations.

## Runtime boundary

In browser runtimes, Inkspan parses the input only inside a detached
`<template>` element. The template's `DocumentFragment` is sanitized before it
is handed to Turndown; the original untrusted string is never passed to
Turndown's browser DOM parser.

In browserless Node.js and SSR runtimes, Inkspan retains Turndown 7's Domino
parser path. This path does not require React, TipTap, a browser DOM, a network
connection, or environment variables. The packed-package consumer gate executes
this DOM-free import surface.

Neither path is a general-purpose HTML sanitizer. The result is Markdown under
Inkspan's narrow authoring contract, and downstream applications must still use
the safe Inkspan serializer or an equivalently strict renderer before placing
that Markdown into an HTML context.

## Element and attribute policy

Before browser conversion, Inkspan removes active or resource-oriented elements,
including:

- `script`, `style`, `iframe`, `object`, `embed`, `template`, and `noscript`;
- `svg`, `math`, and `canvas`;
- `audio`, `video`, `source`, `track`, and `picture`;
- `link`, `meta`, and `base`.

All unrelated attributes are removed. Only the following narrow structural
attributes survive long enough for conversion:

| Element | Retained attributes | Purpose |
| --- | --- | --- |
| `a` | `href`, `title` | Safe Markdown links |
| `img` | `src`, `alt`, `title` | Strict inline raster images |
| `code` | `class` | Fenced-code language labels |
| `ol` | `start` | Ordered-list numbering |
| `input` | `type`, `checked` | GFM task-list checkboxes only |

Event handlers, inline styles, arbitrary `data-*` attributes, resource hints,
form values, and other source attributes do not enter the Markdown output.
Non-checkbox inputs lose their type and checked state.

## Hyperlink policy

An HTML anchor becomes a Markdown link only when its destination passes the same
`isSafeLinkHref` policy used by the editor and Markdown/email serializers.
Accepted targets are credential-free HTTP(S), non-empty `mailto:`/`tel:`, and
ordinary document-relative, query-only, or fragment references.

Executable, active-data, local/blob, protocol-relative, custom-scheme,
credential-bearing, malformed, whitespace/control-character, and backslash
obfuscated targets become ordinary label text. Rejected destinations and titles
are not copied into the result.

## Image policy

An HTML image becomes Markdown image syntax only when its source passes
`validateInlineImageSource` under the standalone serializer's 10 MB boundary.
The accepted source is a strict base64 raster data URI using one of Inkspan's
supported MIME types.

External URLs, protocol-relative references, local/blob sources, SVG or other
active-vector data, malformed or unsupported data URIs, and oversized payloads
become escaped alternative text only. Their source and title are omitted. This
preserves author-supplied non-visual meaning without retaining a tracking URL or
active payload.

Image alternative text is included by default. Hosts that require a
metadata-free projection can suppress it without changing the URI policy:

```ts
import { htmlToMarkdown } from '@contextualwisdomlab/cwl-editor';

const markdown = htmlToMarkdown(untrustedHtml, {
  includeImageAlt: false,
});
```

The same option is forwarded by `htmlToPlainText`, so both accepted and rejected
images remain silent when `includeImageAlt` is false.

## CWL and naruon integration responsibilities

- Keep document authorization, tenant isolation, retention, audit, and privacy
  decisions in the host boundary.
- Use `markdownToHtml` or `markdownToEmailHtml` when rendering imported Markdown;
  do not forward it to a permissive third-party renderer without an equivalent
  URI and image policy.
- Treat authored prose and image alternative text as potentially sensitive even
  though source attributes and destinations are removed.
- Apply the host application's Content Security Policy as defense in depth.
- Do not add custom TipTap protocols or import rules unless the same allowlist is
  applied to editor ingress, transactions, collaboration, and every serializer.

The implementation adds no database object, transport, credential, environment
variable, or naruon-specific runtime dependency. It remains compatible with the
CWL modular MSA and Inkspan's `ui.panel`/compose plugin boundary.

## Primary references

- Turndown security policy and DOM-parser warning:
  <https://github.com/mixmark-io/turndown/security>
- Turndown DOM-node and custom-rule API:
  <https://github.com/mixmark-io/turndown>
- HTML Standard, the `template` element and template contents:
  <https://html.spec.whatwg.org/multipage/scripting.html#the-template-element>
- OWASP Cross Site Scripting Prevention Cheat Sheet:
  <https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html>
- WHATWG URL Standard:
  <https://url.spec.whatwg.org/>

## Verification

The repository-wide 100% TypeScript statement, branch, function, and line
coverage gate verifies:

- safe and rejected hyperlink classes;
- strict inline-image preservation and rejected-source non-disclosure;
- image-alternative inclusion and suppression for accepted and rejected images;
- removal of active/resource-oriented elements;
- attribute allowlisting, task-list behavior, ordered-list starts, and code
  language preservation;
- escaping of Markdown labels, alternative text, titles, and destinations;
- browser conversion through the inert fragment and packed Node/SSR consumer
  operation through the DOM-free fallback.
