# Inkspan Product Requirements

Status: Proposed canonical baseline

## Product definition

Inkspan is a standalone Markdown/HTML rich-text authoring and deterministic document-conversion product that can also be embedded as a modular CWL component. Protected `main` is the implementation authority for what Inkspan actually provides today. This canonical PRD also records Active PR / Proposed requirements such as safe rich clipboard handling, revision-scoped selection/transition evidence, SSR/native-form integration, and lifecycle observation; they are target requirements, not shipped claims, until protected integration. Across current and proposed scope, Inkspan keeps host transport, identity, authorization, tenancy, durable persistence, credentials, migrations, retention, deployment, audit storage, and model-use policy outside the product boundary unless a future accepted versioned contract explicitly changes that division.

The product promise is: **author, convert, collaborate, and prove document changes without hiding authority inside the editor.**

## Users and buyers

- Application developers embedding an editor into web, SSR, worker, or desktop-shell products.
- Enterprise platform teams requiring deterministic conversion, evidence, accessibility, security boundaries, reproducible packages, and explicit operational ownership.
- Authors and reviewers who need accessible Markdown/HTML editing, safe paste, import/export, and predictable recovery from save conflicts.
- CWL products such as naruon that compose Inkspan through `compose` / `ui.panel` while retaining host identity, persistence, collaboration-provider, and model policy.
- Acquisition, security, and operations reviewers who need a bounded source-of-truth graph for architecture, threats, tests, rollback, release evidence, and supported claims.

## Jobs to be done

1. Author and revise Markdown/HTML through one deterministic editor surface without losing canonical document identity.
2. Paste rich content while rejecting or sanitizing unsafe active, hidden, or resource-bearing input before it becomes editor state.
3. Import, export, and convert supported content deterministically, including independently reusable network-free Office DOCX/XLSX/PPTX rendering.
4. Detect exact content equality and stale review/selection state without copying complete document bodies into ordinary evidence metadata.
5. Save through a host-controlled durable boundary that prevents lost updates and makes conflict/ambiguous failure recoverable instead of silently successful.
6. Embed safely in SSR/native-form products while treating browser-submitted values as untrusted host input.
7. Add real-time collaboration without locking Inkspan to one provider or moving room authorization, awareness privacy, persistence, or tenant identity into the editor.
8. Compose Inkspan inside naruon or another CWL host without making those hosts required runtime dependencies for standalone adopters.
9. Offer model-assisted authoring only as host-approved untrusted proposals; deterministic editor/conversion validation remains authoritative.
10. Produce reviewable package, security, compatibility, accessibility, SBOM/provenance, and release evidence tied to one exact protected source head.

## Required outcomes

### Authoring and source fidelity

- Markdown and HTML authoring use a deterministic TipTap/ProseMirror surface.
- Supported import/export behavior is explicitly versioned and testable; unsupported or lossy constructs are not silently advertised as lossless.
- Canonical document envelopes preserve exact schema/version identity and strict JSON/UTF-8 boundaries.
- Source and rendered/exported representations must have documented authority; generated output never silently becomes a new source of truth.

### Clipboard and external content

- Untrusted rich clipboard content is processed through the actual editor paste pipeline, not a disconnected helper.
- Active, hidden, executable, externally fetching, malformed, or over-limit input fails closed or is removed only under a documented semantic allowlist.
- Browser-parser differences that can change security semantics require real Chromium, Firefox, and WebKit differential acceptance before the relevant release line.

### Evidence and concurrency

- SHA-256 document revisions are equality evidence only, never authentication, tenant identity, authorization, signature, timestamp, or durable-write proof.
- Selection and transition evidence bind to one exact immutable editor state and omit document bodies from ordinary metadata.
- Autosave remains single-flight with bounded active/pending work and explicit conflict/failure recovery.
- Durable saves use a host/server-selected strong validator; conflict or ambiguous failure never silently advances it.
- Lifecycle observation emits only distinct externally visible document-free state transitions; construction and no-op operations do not manufacture notifications.

### SSR and native forms

- Server rendering never creates a browser editor view.
- Optional native-form serialization survives SSR/hydration and remains synchronized once the editor is authoritative.
- Hidden/native field values are client-controlled data and never replace host authentication, authorization, CSRF controls, request validation, tenant isolation, or durable concurrency.

### Collaboration

- Collaboration remains provider-neutral and compatible with host-supplied Yjs surfaces.
- Hosts own provider creation/destruction, room authorization, identities, awareness privacy, reconnect policy, update persistence, retention, encryption, and durable audit.
- Provider outage or degraded collaboration does not permit Inkspan to invent durable collaboration success or broader host authority.

### Deterministic Office conversion

- JSON→DOCX/XLSX/PPTX rendering is deterministic, network-free, macro-free, model-free, and Desktop-Office-free.
- Inputs are bounded and validated for XML 1.0, container/depth/cycle limits, worksheet/freeze-pane constraints, supported structures, and spreadsheet formula-injection boundaries.
- File publication is race-safe and explicit about overwrite behavior.
- Format-fidelity claims are limited to tested supported constructs; generated artifacts are verified through realistic package/document tests.

### Modular composition and model assistance

- Standalone Inkspan does not require naruon, contextual-orchestrator, a database, a provider SDK, or a model credential.
- A naruon host may compose Inkspan through a narrow client panel while host services retain authenticated transport, tenant persistence, collaboration provider, conflict UX, and model policy.
- Model output is untrusted proposed content. The host owns provider choice, credentials, redaction, external-data-use approval, logging, retention, and human approval; deterministic Inkspan validation remains the acceptance boundary.

### Accessibility, print, and export

- Native controls, focus behavior, keyboard parity, shortcut metadata, non-color status semantics, and host-facing lifecycle state support WCAG-oriented embedding.
- Application-visible saving/conflict/recovery messages must be derivable from programmatic state without Inkspan prescribing untranslated user-facing copy.
- Export/print surfaces must not rely on color alone or inaccessible interaction-only state where the corresponding product surface exists.

## Non-goals

Inkspan is not an identity provider, tenant database, durable document store, collaboration authorization server, deployment platform, credential manager, retention engine, model router, durable audit service, application migration owner, or merge/release authority for host products.

Inkspan does not promise universal HTML/Office round-trip fidelity, arbitrary executable document content, implicit network fetching, model-generated content as trusted source, or silent migration of unknown document schemas.

## Security and privacy requirements

- Untrusted HTML, DOM capabilities, clipboard configuration, form values, Office structures, host callbacks, collaboration updates, and model proposals fail closed at documented boundaries.
- Active or hidden rich content must not bypass the supported semantic clipboard policy.
- Spreadsheet formula-significant input must not silently become executable formulas unless a future explicit trusted formula contract says otherwise.
- Document bodies, revision/entity tags, provider metadata, tenant identifiers, prompts, and model outputs must not enter generic public metrics or unauthenticated logs.
- Host applications remain responsible for authentication, authorization, CSRF, tenant isolation, persistence, encryption, retention, audit storage, provider admission, and external-model policy.

## Reliability and operability requirements

- Autosave is bounded, single-flight, idempotency-aware at its local contract, and explicit about blocked/conflict/failure state.
- Observer failures cannot change save ordering, result classification, or durable-validator handoff.
- Async revision/selection capture binds to one immutable editor state.
- Conversion/publication never reports a partial artifact as successful output.
- Package/release operations fail closed on stale source, ambiguous artifact inventory, digest mismatch, missing required evidence, or stale review/check state.
- Boundary-specific rollback must preserve canonical document readability and host-owned durable state.

## Packaging and acquisition acceptance

A release is acceptable only from an exact integrated protected head with applicable CI/security checks, exact owned production statement/branch/function/line coverage, complete public docstrings where required, package-consumer compatibility, real browser/document-fidelity evidence, accessibility evidence, SBOM/provenance/reproducibility, zero valid unresolved findings, required independent non-author review, rollback guidance, and verified published artifacts.

Shareable acquisition evidence excludes production tenant content and credentials. Protected `main`, exact-head machine evidence, formal reviews, and canonical product documentation outrank historical PR bodies, comments, local-only results, or predecessor-head status.

## Current, proposed, and planned scope

Protected `main` is the sole implemented baseline. Open PRs may describe Proposed or Active work but are not shipped contracts until protected integration. Canonical documentation must state when a requirement is target architecture rather than current implementation.

Current open development lines include richer browser-verified clipboard assurance, lifecycle observation, document-transition/revision evidence, SSR/native-form integration, accessibility metadata, release hardening, and security disclosure documentation. Their detail is useful design evidence but remains Proposed until merged. A future envelope-identity migration-routing API is tracked separately and must preserve host migration ownership.
