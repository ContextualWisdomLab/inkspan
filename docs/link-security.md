# Hyperlink and serializer security contract

Inkspan treats hyperlink targets and image sources as untrusted content. The
same policy applies whether content enters through initial Markdown or HTML,
controlled props, imperative APIs, toolbar commands, paste/autolink rules,
direct ProseMirror transactions, collaborative Yjs updates, standalone
Markdown/email serialization, or public HTML-to-Markdown conversion.

## Safe hyperlink policy

Inkspan accepts only these target classes:

- absolute `https://` and `http://` URLs without embedded username/password
  credentials;
- non-empty `mailto:` and `tel:` targets;
- document-relative paths such as `/docs`, `./next`, `../previous`, and
  `docs/reference`;
- query-only and fragment-only references such as `?view=compact` and
  `#section`.

Inkspan rejects:

- executable or active schemes such as `javascript:`, `data:`, and `vbscript:`;
- local or host-coupled schemes such as `file:` and `blob:`;
- protocol-relative URLs beginning with `//`;
- unknown/custom schemes;
- absolute HTTP(S) URLs containing username or password credentials;
- malformed absolute URLs, empty scheme payloads, literal whitespace/control
  characters, and backslashes.

The validator does not trim, repair, or reinterpret a rejected target. This is
intentional: canonicalization before validation can cause the browser and the
application to evaluate different strings.

Rejected values raise `SafeLinkHrefError` only when a host calls
`validateSafeLinkHref` directly. The error exposes a bounded, redacted
`hrefPreview`; it never retains the complete URL, query string, fragment,
credentials, or payload in host telemetry.

```ts
import {
  isSafeLinkHref,
  validateSafeLinkHref,
} from '@contextualwisdomlab/cwl-editor';

if (isSafeLinkHref(candidate)) {
  // Candidate is safe to pass to Inkspan's Link mark.
}

const validated = validateSafeLinkHref('/documents/current');
```

## Enforcement points

`SafeLink` configures TipTap's `isAllowedUri` hook. TipTap applies this hook to
HTML parsing and rendering, link commands, pasted links, and autolinking.
Inkspan additionally installs a ProseMirror transaction filter that checks the
complete changed document. This closes bypasses through direct transaction
dispatch and provider-neutral collaborative updates.

The standalone Markdown renderer uses the same validator. Unsafe Markdown
links are rendered as ordinary text rather than clickable anchors. Safe links
receive `rel="noopener noreferrer nofollow"`.

`htmlToMarkdown` also uses the validator. In browsers, untrusted HTML is parsed
inside a detached `<template>` fragment, active/resource-oriented elements and
unrelated attributes are removed, and only safe anchor targets become Markdown
links. Rejected targets become ordinary label text and their destinations and
titles are omitted. Browserless Node/SSR consumers retain Turndown 7's
non-fetching Domino parser path while the same custom link and image rules apply.
See [`html-import-security.md`](html-import-security.md) for the complete import
contract.

## Image serialization boundary

`markdownToHtml` and `markdownToEmailHtml` emit an `<img>` only when its source
is a strict inline base64 raster data URI accepted by
`validateInlineImageSource`. External URLs, protocol-relative sources, local
schemes, SVG/active-vector data, malformed payloads, unsupported MIME types,
and payloads above the serializer's 10 MB limit become an inert
`data-cwl-rejected-image` marker. Therefore standalone serialization cannot
create a remote tracking request or an active-vector image even when it is used
without mounting the React editor.

The same 10 MB policy now applies in the reverse `htmlToMarkdown` direction.
Only accepted inline raster sources become Markdown images. Rejected images
produce escaped alternative text only; their source and title are not forwarded
to another renderer.

The 10 MB serializer limit matches the editor's default. Hosts using a smaller
editor `image.maxSizeBytes` remain responsible for applying that same smaller
limit before passing independently sourced Markdown to the standalone
serializer.

## Host responsibilities

- Treat returned HTML or Markdown as content, not as an authorization decision.
- Apply the host application's Content Security Policy and navigation policy.
- Decide whether HTTP links are acceptable for the product's deployment; the
  shared Inkspan policy permits them for interoperability.
- Do not register additional TipTap link protocols unless the host also defines
  and tests a stricter equivalent policy.
- Render imported Markdown through Inkspan's safe serializers or an equivalently
  strict downstream renderer.
- Keep document authorization, collaboration transport, persistence, and audit
  controls in the CWL/naruon host boundary.
- Avoid logging raw rejected content. Use the typed error's redacted preview.

## Standards and primary references

- TipTap Link extension, including `isAllowedUri` and protocol configuration:
  <https://tiptap.dev/docs/editor/extensions/marks/link>
- Turndown security policy and browser DOM-parser warning:
  <https://github.com/mixmark-io/turndown/security>
- HTML Standard, the inert template-content boundary:
  <https://html.spec.whatwg.org/multipage/scripting.html#the-template-element>
- OWASP Cross Site Scripting Prevention Cheat Sheet, URL-context validation and
  allowlisting guidance:
  <https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html>
- WHATWG URL Standard, browser URL parsing and serialization model:
  <https://url.spec.whatwg.org/>
- W3C Content Security Policy Level 3, defense-in-depth for resource loading and
  navigation:
  <https://www.w3.org/TR/CSP3/>

## Verification

The TypeScript 100% statement/branch/function/line coverage gate verifies:

- every accepted and rejected target class;
- redacted error categories;
- initial HTML parsing;
- command insertion;
- direct ProseMirror transaction acceptance/rejection;
- safe and unsafe Markdown/email links;
- inert HTML-to-Markdown import and active/resource element removal;
- inline raster image preservation and external/active image rejection in both
  serialization directions;
- public package exports and shared extension-kit configuration.
