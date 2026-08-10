# Headless deterministic Markdown package

Status: Implemented on active PR

## Purpose

Inkspan's protected root package already exposes deterministic Markdown, HTML,
email-HTML, and plain-text conversion. The root package also evaluates the
interactive React/TipTap editor graph, which is unnecessary for server, worker,
CLI, and other headless consumers that only need deterministic conversion.

The active package line therefore exposes the same conversion behavior through
`@contextualwisdomlab/cwl-editor/markdown` while keeping the interactive editor,
collaboration provider, persistence, transport, credentials, and model authority
outside the subpath.

## Decision boundary

The new subpath does not implement a second serializer. Existing conversion
functions remain the single behavioral authority. Safe hyperlink and inline
raster source checks are extracted into framework-neutral policy modules and are
shared by both the serializer and the TipTap extensions. This prevents a
headless package from weakening the editor trust boundary or creating divergent
security policy.

The package exports:

- `markdownToHtml()`;
- `htmlToMarkdown()`;
- `normalizeMarkdown()`;
- `markdownToEmailHtml()`;
- `markdownToPlainText()`;
- `htmlToPlainText()`; and
- their public option types.

It deliberately does not export editor construction, TipTap extensions, Yjs,
autosave, revision evidence, annotation capture, transport, persistence, or
model integration.

## Standards and compatibility

CommonMark 0.31.2 remains the current published CommonMark specification. Inkspan
uses Marked with GFM enabled and keeps its product-specific fail-closed rules for
raw HTML, hyperlink targets, and raster data-URI images on top of that parsing
behavior. This package change does not expand the set of supported or trusted
Markdown constructs.

Node.js package `exports` is the public encapsulation boundary. The subpath has
explicit ESM, CommonJS, and TypeScript declaration targets; consumers are not
expected to reach internal source files. Adding the subpath is additive, while a
future removal or incompatible signature change is a semantic-versioning event.

Turndown 7.2.4 publishes separate browser and Node entrypoints. Its package
metadata maps the normal ESM/CommonJS files to browser variants through the
`browser` field, while the Node entry depends on `@mixmark-io/domino`. Turndown's
security guidance states that standalone string parsing uses its custom Domino
parser and that this parser does not execute scripts or download external
resources. Vite's client-oriented default `resolve.mainFields` prefers
`browser` before `module`; therefore a nominally headless library build can
silently select Turndown's browser entry and require a global `document` unless
the build resolution policy is explicit.

The dedicated Markdown build excludes `browser` from its resolution order and
bundles Turndown's Node path, including the non-fetching parser, into the package
artifact. This is a product authority decision rather than a build-performance
tweak: browser-field selection previously caused the packed Node consumer to
fail with `ReferenceError: document is not defined` at the actual
HTML-to-Markdown boundary.

## Runtime authority and security

The dedicated build produces a self-contained JavaScript artifact. Packed
consumer verification rejects:

- external runtime imports or re-exports;
- dynamic `import()` and `require()` loaders;
- ambient `fetch`, XHR, WebSocket, EventSource, or environment-backed credential
  access;
- React/React DOM, TipTap, Yjs, naruon, contextual-orchestrator, or model
  credential references.

HTML-to-Markdown remains usable in Node without a browser DOM through the
bundled non-fetching parser path. The packed ESM and CommonJS consumers install a
throwing `globalThis.document` accessor before loading/calling the Markdown
subpath, so successful conversion proves that the artifact does not silently
fall back to ambient browser-document authority. The package performs no network
request and does not own MIME delivery, recipients, authentication,
authorization, tenancy, durable persistence, retention, or audit. Full-document
email output is deterministic content only.

## Verification

Permanent tests and packed-artifact checks cover:

- public export-map discovery;
- explicit non-browser Vite main-field resolution;
- ESM and CommonJS consumers outside the source tree;
- strict TypeScript declarations;
- browserless Node HTML-to-Markdown with hostile ambient `document` access;
- safe and rejected hyperlinks;
- plain-text projection;
- normalization;
- full-document email language/direction preservation;
- absence of forbidden runtime authority; and
- repository-wide exact 100% owned production coverage.

The package line remains `implemented_on_active_pr` until the unchanged exact
head passes all applicable CI/security/review gates and reaches protected main.

## Rollback

Before protected integration, rollback removes the additive export/build/verifier
and restores serializer imports to the existing editor policy modules. After
integration, rollback may remove only the additive subpath in a versioned
breaking release; it must not fork or silently weaken the shared hyperlink/image
policies.

## References — APA 7th

MacFarlane, J. (2024, January 28). *CommonMark specification* (Version 0.31.2). CommonMark. https://spec.commonmark.org/0.31.2/

Mixmark-io. (2026). *Turndown* (Version 7.2.4) [Computer software]. GitHub. https://github.com/mixmark-io/turndown

Mixmark-io. (2026). *Turndown security policy*. GitHub. https://github.com/mixmark-io/turndown/security

Node.js contributors. (2026). *Modules: Packages*. Node.js documentation. https://nodejs.org/api/packages.html

Vite contributors. (2026). *Shared options: resolve.mainFields*. Vite documentation. https://vite.dev/config/shared-options.html
