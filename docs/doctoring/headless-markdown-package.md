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
existing bounded non-fetching parser fallback. The package performs no network
request and does not own MIME delivery, recipients, authentication,
authorization, tenancy, durable persistence, retention, or audit. Full-document
email output is deterministic content only.

## Verification

Permanent tests and packed-artifact checks cover:

- public export-map discovery;
- ESM and CommonJS consumers outside the source tree;
- strict TypeScript declarations;
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

Node.js contributors. (2026). *Modules: Packages*. Node.js documentation. https://nodejs.org/api/packages.html
