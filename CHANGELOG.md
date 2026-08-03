# Changelog

All notable changes to **Inkspan** (`@contextualwisdomlab/cwl-editor`) are documented in this file.

## [Unreleased]

## [0.5.8] — 2026-08-04

### Added
- Host-owned `onSelectionChange` callbacks for standalone and provider-neutral collaborative editor surfaces
- Public `CwlEditorSelectionEvent` and immutable `CwlEditorSelectionSnapshot` types exposing `anchor`, `head`, `from`, `to`, and `empty`

### Changed
- Package version **0.5.8**
- Selection callback props are read through live refs so hosts can add or replace handlers without recreating TipTap state or Yjs bindings
- Selection events contain detached ProseMirror position snapshots rather than mutable selection objects or selected document content

### Security
- Selection coordinates are documented as ephemeral client-side presentation state, not durable identifiers, authorization evidence, or trusted audit records
- Inkspan does not copy selected content into callbacks; CWL and naruon hosts remain responsible for deliberate content access, classification, telemetry minimization, and revalidation before later mutations

### Tests
- Standalone and collaborative tests cover absent callbacks, callbacks attached after mount, live callback replacement, stable editor identity, caret snapshots, and range snapshots under the repository-wide 100% TypeScript coverage gate
- Packed-package verification compiles the public selection lifecycle declarations through a strict external TypeScript consumer

### Documentation
- Added `docs/selection-lifecycle.md` with ProseMirror coordinate semantics, collaborative remapping, AI/contextual-action usage, privacy boundaries, accessibility responsibilities, and primary TipTap/ProseMirror references

## [0.5.7] — 2026-08-04

### Changed
- Package version **0.5.7**
- Native form serialization now writes the hidden input's current value synchronously during every document-changing TipTap transaction instead of waiting for a React state commit
- The form bridge is maintained as an uncontrolled native field, avoiding one React rerender per document transaction while preserving mode changes, disabled state, external form association, and reset restoration

### Fixed
- Immediate `FormData` construction or browser form submission after an imperative or collaborative document transaction can no longer observe the previous serialized document because of React update batching

### Security
- Synchronous mirroring closes a stale-submission window without changing the existing client-controlled trust boundary; servers must still authorize, validate, and size-limit submitted content

### Tests
- A direct transaction harness verifies that selection-only transactions leave the field unchanged and document-changing transactions are visible to `FormData` before another React render or task
- Existing standalone, imperative, reset, external-form, and Yjs collaboration coverage remains under the repository-wide 100% TypeScript coverage gate

### Documentation
- Clarified the same-task form-entry guarantee and the distinction between native field synchronization and host/server validation responsibilities

## [0.5.6] — 2026-08-04

### Added
- SSR-safe standalone and collaborative React rendering with TipTap editor creation deferred until client hydration
- A documented Next.js App Router, traditional SSR, CWL, and naruon hydration contract

### Changed
- Package version **0.5.6**
- `CwlEditor` and `CollaborativeCwlEditor` now configure TipTap with `immediatelyRender: false`, producing a deterministic server shell without constructing a ProseMirror view
- Client initialization remains compatible with existing controlled state, imperative handles, native forms, accessibility metadata, and host-owned Yjs collaboration

### Security
- Server rendering does not initialize browser collaboration transports, expose editor document bodies in the shell, or transfer provider and credential ownership into Inkspan
- CWL and naruon hosts remain responsible for creating authorized browser providers and descriptive nonnumeric document, user, and session identifiers inside the client integration boundary

### Tests
- Node-based `react-dom/server` coverage verifies stable standalone and collaborative shells without ProseMirror markup or initial document-body leakage under the repository-wide 100% TypeScript coverage gate

### Documentation
- Added `docs/server-rendering.md` with hydration timing, Next.js client-boundary guidance, layout responsibility, provider lifecycle, and MSA interoperability requirements

## [0.5.5] — 2026-08-04

### Added
- Opt-in standalone native form reset integration through `formResetValue`, interpreted in the active Markdown or HTML mode
- `onFormReset` lifecycle reporting with the stable TipTap editor and native reset event after an allowed reset completes
- External form association and reset-only observation without requiring a named submission field
- Public `CwlEditorFormResetEvent` and a documented host-owned reset contract

### Changed
- Package version **0.5.5**
- Standalone form resets mutate editor state only when an explicit reset value is configured; callback-only integrations remain host-controlled
- `CollaborativeCwlEditor` excludes and rejects `formResetValue`; collaborative resets are observational through `onFormReset` so hosts must explicitly authorize any shared Yjs mutation

### Security
- Canceled reset events cannot mutate editor or collaborative document state
- A local native form action cannot silently replace shared Yjs document state
- Reset values are documented as client-side presentation state and cannot grant authorization, erase protected server state, or bypass collaborative permissions
- CWL and naruon hosts remain responsible for authorizing shared-document reset operations and synchronizing transport and persistence

### Accessibility
- Reset integrates with native form semantics without adding another focusable or accessibility-tree control
- Hosts retain ownership of validation cleanup, focus recovery, user confirmation, and visible reset affordances through `onFormReset`

### Tests
- Allowed and canceled standalone resets, `onChange` propagation, callback-only external form handling, queued-reset cleanup, collaborative automatic-reset rejection, and callback-only collaborative observation are covered under the repository-wide 100% TypeScript coverage gate

### Documentation
- Expanded the form integration contract with WHATWG reset-event semantics, controlled-state requirements, collaborative authorization, and host responsibilities

## [0.5.4] — 2026-08-04

### Added
- Native form serialization through `formFieldName`, with the current Markdown or HTML document mirrored into a hidden input
- External form association through `formId` and native submission exclusion through `formFieldDisabled`
- Shared standalone and provider-neutral collaborative form behavior without introducing a form-library dependency

### Changed
- Package version **0.5.4**
- The form field listens only to document-changing TipTap transactions, preserving imperative `setValue` synchronization without repeatedly serializing cursor-only movement

### Security
- Documentation now makes the client-controlled and non-secret nature of hidden form values explicit and requires server-side authorization, validation, and request-size enforcement
- Inline base64 image payloads remain subject to host gateway and persistence limits during native submission

### Accessibility
- The hidden field is excluded from the accessibility tree and does not duplicate the editable textbox's accessible name, descriptions, or validation state
- Native constraint validation remains host-owned because hidden inputs are barred from browser constraint validation

### Tests
- Native `FormData`, external form association, disabled fields, live mode changes, selection-only transactions, imperative replacement, and Yjs-backed collaborative updates are covered under the repository-wide 100% TypeScript coverage gate

### Documentation
- Expanded the form integration contract with WHATWG hidden-input and form-control semantics, reset behavior, trust boundaries, CWL/naruon gateway limits, and host responsibilities

## [0.5.3] — 2026-08-04

### Added
- Host-controlled `languageTag` for applying a trimmed BCP 47 `lang` value to the editable document surface
- Host-controlled `textDirection` with the HTML `ltr`, `rtl`, and `auto` writing-direction states
- Public `EditorTextDirection` type shared by standalone and provider-neutral collaborative editor surfaces

### Changed
- Package version **0.5.3**
- Language and direction metadata update live on the existing ProseMirror DOM without recreating editor state, selection, or Yjs bindings

### Accessibility
- Document language can now be programmatically identified independently from the surrounding application shell
- Right-to-left and mixed-source workflows can establish an explicit document-level base direction while preserving host ownership of per-passage language metadata
- Blank language values are omitted instead of emitting an empty `lang` attribute

### Tests
- Shared attribute construction and standalone/collaborative integrations cover trimmed and blank language tags, all supported direction semantics, and live prop replacement under the repository-wide 100% coverage gate

### Documentation
- Expanded the accessibility contract with BCP 47, RTL, host-responsibility, WCAG 2.2 language, and WHATWG HTML `lang`/`dir` guidance

## [0.5.2] — 2026-08-04

### Added
- Host-owned `onFocus` and `onBlur` lifecycle callbacks for standalone and provider-neutral collaborative editor surfaces
- Public `CwlEditorFocusEvent` with the stable TipTap editor instance and native DOM `FocusEvent`

### Changed
- Package version **0.5.2**
- Focus callback props are read through live refs so hosts can add or replace handlers after mount without recreating editor state or Yjs bindings

### Tests
- Standalone and collaborative tests cover absent callbacks, handlers added after mount, stable editor identity, and native focus/blur event types under the repository-wide 100% coverage gate

### Documentation
- Added the host focus lifecycle, validation, persistence, telemetry, accessibility, and CWL/naruon interoperability contract

## [0.5.1] — 2026-08-03

### Added
- Host-controlled `ariaLabelledBy`, `ariaDescribedBy`, `ariaErrorMessage`, `ariaInvalid`, and `ariaRequired` props for enterprise form and compose integrations
- One shared accessibility-attribute contract for standalone and provider-neutral collaborative editor surfaces

### Changed
- Package version **0.5.1**
- `editable` now exposes an explicit, live `aria-readonly` state without recreating the TipTap editor or collaborative document binding
- Accessibility metadata updates after mount are applied to the existing ProseMirror DOM while preserving document state and selection

### Accessibility
- Non-empty visible-label references take precedence over string labels, following WAI-ARIA accessible-name guidance
- Blank ID references are omitted instead of producing broken `aria-labelledby`, `aria-describedby`, or `aria-errormessage` relationships
- Validation supports boolean, `grammar`, and `spelling` `aria-invalid` states plus explicit required semantics

### Tests
- Shared attribute construction and standalone/collaborative integration are covered under the repository-wide 100% statement/branch/function/line coverage gate
- Tests verify label precedence, relationship normalization, validation metadata, read-only state, and live prop changes

### Documentation
- Expanded the accessibility contract with a form integration example, host responsibilities, WAI-ARIA 1.2, APG, WCAG 2.2, and ARIA-in-HTML references

## [0.5.0] — 2026-08-03

### Added
- Deterministic `markdownToPlainText` and `htmlToPlainText` projections for search indexing, LLM context construction, previews, audit logs, and host-owned analytics
- Plain-text reading order preserves headings, paragraphs, explicit line breaks, code, list items, table rows/cells, link labels, and optional image alternative text
- Browser HTML import now parses through a detached, inert `<template>` fragment before Turndown conversion

### Changed
- Package version **0.5.0**
- `htmlToMarkdown` now applies the same safe-link and strict inline-raster image policies used by editor ingress and standalone HTML/email serialization
- Active and resource-oriented HTML elements are removed before conversion, while unrelated attributes are stripped under a narrow structural allowlist
- Rejected HTML images now preserve only escaped alternative text instead of forwarding an unsafe or external source

### Security
- Plain-text projections omit raw Markdown HTML, link-definition records, hyperlink destinations, HTML attributes, image sources, and inline base64 payloads instead of interpreting or forwarding them
- Untrusted browser HTML strings are no longer passed directly to Turndown's browser parser, closing the pre-rule script/resource-loading boundary identified by Turndown's security policy
- Executable, active-data, local/blob, protocol-relative, custom-scheme, credential-bearing, and malformed HTML links become ordinary text
- External, active-vector, malformed, unsupported, and oversized HTML image sources are omitted from Markdown output

### Tests
- Markdown and HTML projection behavior, payload non-disclosure, image-alternative policy, structural reading order, and public exports are covered under the repository-wide 100% TypeScript coverage gate
- HTML import tests cover inert-fragment conversion, active/resource element removal, attribute allowlisting, safe and rejected links, strict images, Markdown escaping, list starts, code languages, and GFM task checkboxes

### Documentation
- Added the CWL/naruon plain-text interoperability, runtime, and downstream data-governance contract
- Added the untrusted HTML import security, runtime, MSA interoperability, host-responsibility, and verification contract

## [0.4.2] — 2026-08-03

### Added
- A tag-triggered, fail-closed GitHub release pipeline now rebuilds and revalidates the npm package, demo, and Inkspan Office wheel from the tagged commit before publishing release assets
- Release artifacts now include the exact npm tarball, Office wheel, and a SHA-256 checksum manifest
- GitHub/Sigstore artifact attestations provide verifiable SLSA provenance for every published release artifact without a long-lived signing secret

### Changed
- Package version **0.4.2**
- Release builds and dependency execution now occur in a read-only job; only a separate source-free publication job receives contents-write, OpenID Connect, and attestation permissions
- Validated artifacts cross the privilege boundary through a one-day GitHub workflow artifact and are checksum-verified again before attestation
- The package-distribution contract now identifies `@tiptap/core` as an externalized runtime dependency of the editor and collaboration entrypoints while confirming that the converter entrypoint does not require it

### Security
- Release tags must exactly match `package.json`, a corresponding changelog section, semantic-version syntax, the canonical repository identity, and a commit already reachable from `main`
- The workflow publishes through a complete draft, requires the resulting release to report `isImmutable: true`, deletes and rejects a mutable result, and never overwrites an existing published release
- Release-level and per-asset attestations are verified immediately after publication
- Every third-party action remains pinned to a complete commit SHA
- npm and PyPI publication are intentionally deferred until their canonical Trusted Publisher and environment-approval configuration is externally established

### Tests
- The release gate now inspects the Office wheel for its bundled schema and license and rechecks the artifact checksum manifest after the read-only build job hands files to the privileged publication job

### Documentation
- Expanded the release security, immutable publication, provenance, verification, registry-publishing, MSA, and CWL/naruon interoperability contract

## [0.4.1] — 2026-08-03

### Changed
- Package version **0.4.1**
- The npm distribution now ships compiled JavaScript, declarations, documentation, licenses, and the public offline-font assets without bundling internal TypeScript implementation or test files
- Added a package-distribution contract for CWL/naruon integrators covering public subpaths, runtime dependency boundaries, and release verification

### Fixed
- CommonJS `require()` now unwraps TipTap's transpiler-shaped default exports correctly for both the editor and collaboration entrypoints instead of failing during module initialization

### Tests
- CI now inspects the exact `npm pack` file manifest and rejects missing exports, missing license/font assets, internal source, tests, demos, Office sources, coverage data, or workflow files
- ESM, CommonJS, SSR-safe Node imports, collaboration/converter subpaths, CSS/font resolution, and strict TypeScript consumer declarations are executed against the built package before merge

## [0.4.0] — 2026-08-03

### Added
- **Strict safe-hyperlink boundary** — one allowlist now governs initial HTML/Markdown, toolbar and keyboard commands, pasted/autolinked content, direct ProseMirror transactions, provider-neutral collaborative updates, and HTML serialization
- Public `SafeLink`, `SafeLinkHrefError`, `validateSafeLinkHref`, `isSafeLinkHref`, and `safeLinkPluginKey` exports for CWL/naruon hosts and headless integrations
- A documented hyperlink and serializer security contract with TipTap, OWASP, WHATWG URL, and CSP references

### Changed
- Package version **0.4.0**
- Allowed targets are credential-free HTTP(S), non-empty `mailto:`/`tel:`, ordinary document-relative paths, query-only references, and fragments
- Protocol-relative, executable, active-data, local/blob, unknown-scheme, credential-bearing, malformed, whitespace/control-character, and backslash-obfuscated targets are rejected without trimming or repair
- `markdownToHtml` and `markdownToEmailHtml` now emit clickable anchors only for safe targets and emit `<img>` only for strict inline base64 raster sources within the 10 MB serializer boundary
- Rejected Markdown links render as ordinary text; rejected external, active-vector, malformed, unsupported, local, or oversized image sources render as inert `data-cwl-rejected-image` markers and cannot trigger a network request

### Security
- Rejected hyperlink diagnostics expose bounded categories rather than complete URLs, query strings, fragments, credentials, or payloads
- A full-document transaction filter closes bypasses through direct ProseMirror dispatch and CRDT ingress while preserving TipTap's native link paste/autolink plugins

### Tests
- Accepted and rejected target classes, redacted diagnostics, HTML parsing, command insertion, direct transactions, public exports, shared-kit configuration, Markdown/email link rendering, and external/active image rejection are covered under the 100% TypeScript coverage gate

## [0.3.2] — 2026-08-03

### Fixed
- **Composite toolbar keyboard access** — the formatting toolbar is now one remembered tab stop with wrapping Left/Right navigation, Home/End navigation, disabled-control skipping, and automatic fallback when the remembered control becomes unavailable
- Toggle buttons retain `aria-pressed`, while one-shot command buttons no longer expose a misleading pressed state
- Visible `:focus-visible` indicators now ship for normal and forced-colors modes
- **Strict inline raster image boundary** — initial HTML/Markdown, controlled and imperative APIs, direct ProseMirror transactions, collaborative updates, and serialization now enforce one source policy
- External, protocol-relative, `blob:`, `file:`, JavaScript, SVG/active-vector, unsupported-MIME, malformed, empty, and oversized image sources are rejected before decoder use, editor-state entry, or emission of a network-capable `<img>`
- Rejected source diagnostics are categorized and redacted so URL secrets and base64 payload bytes are not retained in host telemetry
- Removed temporary branch-patching workflows that were inadvertently retained after the previous image-policy merge

### Changed
- Package version **0.3.2**
- The toolbar declares horizontal orientation and follows the WAI-ARIA Authoring Practices toolbar interaction model
- Added documented accessibility and image-security integration contracts covering behavior, host responsibilities, and verification
- Supported inline image MIME types are PNG, JPEG/JPG, GIF, WebP, AVIF, APNG, BMP, and ICO

### Tests
- Single-tab-stop behavior, remembered focus, disabled-control fallback, wrapping navigation, Home/End, orientation, and toggle-only pressed semantics are covered under the 100% TypeScript coverage gate
- Source-policy tests cover initial and controlled content, imperative insertion/replacement, direct transactions, collaborative propagation, active-vector rejection, byte limits, redacted errors, and block/inline defense-in-depth serialization

## [0.3.1] — 2026-08-03

### Added
- **Accessible image alternative-text authoring** — an `Alt` toolbar action is enabled only for a selected image, prefills existing replacement text, and supports either a meaningful description or an explicit empty value for decorative images
- New toolbar uploads and paste/drop image insertion now write `alt=""` explicitly until an author supplies meaningful replacement text

### Changed
- Package version **0.3.1**
- Image alternative text remains intact through HTML, Markdown, and collaborative Yjs editing

### Tests
- Alternative-text editing, cancellation, decorative images, upload/paste/drop defaults, Markdown serialization, and collaborative convergence are covered under the 100% TypeScript coverage gate

## [0.3.0] — 2026-08-03

### Added
- **Provider-neutral real-time collaboration** — a separate `@contextualwisdomlab/cwl-editor/collaboration` entrypoint backed by a host-owned `Y.Doc`, with no transport, authentication, persistence, credential, or provider-lifecycle coupling
- Shared CRDT-aware editor shell preserving the existing toolbar, tables, inline base64 images, Markdown/HTML exports, read-only behavior, and `CwlEditorHandle`
- Allowlisted public awareness payloads with descriptive nonnumeric user identifiers, safe remote label rendering, computed black/white label contrast, and an accessible connection/collaborator status region
- **Inkspan Office 0.1.0** — a deterministic, network-free Python package and CLI that renders strict machine-readable JSON to DOCX, XLSX, or PPTX through `python-docx`, `openpyxl`, and `python-pptx`
- Bundled JSON Schema for structured LLM output, plus in-memory and atomic file-writing APIs
- Formula-injection protection for AI-authored spreadsheet strings and strict rejection of unknown or malformed fields
- Public Office safety facade that rejects XML-incompatible text, cyclic containers, excessive JSON nesting, invalid freeze-pane coordinates, oversized Excel grids/cells, Excel-incompatible worksheet names, and integers Excel cannot preserve exactly
- Canonical OOXML packaging that normalizes generated metadata and ZIP-entry timestamps, producing byte-identical output for the same validated request

### Changed
- Package version **0.3.0**
- Collaborative editing disables StarterKit history and delegates undo/redo to the Yjs collaboration extension
- Common editor serialization, imperative-handle, keyboard, toolbar, and surface behavior now share one internal implementation across standalone and collaborative entrypoints

### Fixed
- Non-overwrite Office writes now use atomic link publication, closing the check-then-replace race that could overwrite a file created concurrently
- Excel strings longer than 32,767 characters are rejected instead of being silently truncated by `openpyxl`
- Large integers that would be rounded by Excel's binary64 numeric storage are rejected even when their decimal representation contains trailing zeroes
- Worksheet names beginning or ending with an apostrophe, or using Excel's reserved `History` name, are rejected before rendering

### Tests
- Collaboration tests cover rich-text convergence, concurrent changes, shared undo, tables, inline images, awareness validation and removal, accessible status updates, runtime source-of-truth guards, image-error forwarding, and host lifecycle ownership
- 82 Python tests re-open all generated Office formats and exercise deterministic packaging, validation, storage limits, atomic publication, CLI, and module entrypoints on minimum Python 3.11 and current stable Python 3.14
- 100% statement/branch/function/line coverage remains required for the TypeScript package; 100% statement/branch and shipped-symbol docstring coverage are required for Office
- Hash-locked binary dependencies protect the Office CI jobs from unreviewed package changes
- Wheel packaging gate verifies that the JSON Schema and MIT license ship with the package

## [0.2.1] — 2026-07-31

### Added
- **`CwlEditorHandle.insertValue`** — insert Markdown/HTML at the cursor (AI/snippet path); fires `onChange` and does not wipe the document
- **Table toolbar** — delete column and delete row (enabled only inside a table)

### Tests
- Drop-path `onImageError`, `insertValue` markdown+html, table delete row/column

## [0.2.0] — 2026-07-31

Commercial host-integration release: a buyer embedding the editor can control it, surface image failures, edit tables, and emit email-ready HTML without forking.

### Added
- **`CwlEditorHandle`** via `ref` — `getValue` / `getHTML` / `getMarkdown` / `setValue` / `clear` / `focus` / `blur` / `isEmpty` / `getEditor`
- **`onImageError`** — image size-guard failures are never silent
- **Table editing toolbar** — add column after, add row after, delete table (enabled only when the cursor is in a table)
- **Horizontal rule** toolbar control
- **Live toolbar state** — re-renders on TipTap `transaction` / `selectionUpdate` so active/disabled UI stays correct without host re-renders
- **`markdownToEmailHtml`** — Markdown → email body HTML (fragment or full document), preserving inline base64 images for compose→send

### Fixed
- **`onImageError` paste/drop path** — previously only toolbar file-picker failures reached the host; paste/drop size-guard failures were silently dropped because `buildExtensions` never forwarded `onError` to `Base64Image`. Wired via a live ref so hosts can attach the handler after mount (including `hideToolbar`).

### Changed
- Package version **0.2.0**
- README documents the imperative handle, `onImageError`, table ops, and email helper
- README submodule URL corrected to `ContextualWisdomLab/inkspan`

### Tests
- 116 real vitest cases driving shipped modules (handle, image errors including paste path, table ops, email HTML)

## [0.1.0] — prior

Initial public surface: Markdown/HTML modes, base64 inline images, standalone converter, bundled Noto Sans fonts, ship gates.
