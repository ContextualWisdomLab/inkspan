# Inkspan Technical Requirements

Status: Protected-main canonical baseline

## Authority and runtime boundary

Inkspan owns deterministic editor, conversion, document-envelope, local evidence, local autosave ordering, accessibility metadata, package behavior, provider-neutral adapters, and the CSS presentation rules it ships. Hosts own network transport, authentication, authorization, tenant isolation, durable persistence, credentials, migrations, retention, durable audit storage, deployment, collaboration-provider lifecycle, model-use policy, and any durable PDF/print-service authority unless a later Accepted ADR explicitly transfers that ownership.

Protected `main` is the implementation authority. Open PRs may provide Proposed contracts or evidence but do not become shipped behavior until protected integration.

## Package and module boundaries

The root product may compose TipTap/ProseMirror, React-facing integration, deterministic conversion, revision evidence, autosave, collaboration adapters, email/base64 utilities, and Office rendering. Framework-independent subpaths must not accidentally require React, DOM globals, TipTap UI, ProseMirror view, Yjs, network, credentials, database clients, naruon, contextual-orchestrator, or model SDKs when their public contract excludes those dependencies.

Protected framework-independent surfaces include the package's bounded envelope-identity, revision/evidence, text-position-selector, autosave, converter, and other explicitly exported subpaths that are verified from packed artifacts. In particular, the protected React-free text-position-selector subpath reuses the deterministic projection contract without gaining editor-capture, persistence, authorization, or network authority.

ADR 0020 records the Proposed framework-neutral Markdown/HTML/email/plain-text package boundary implemented on active PR #114. Until that branch reaches protected `main`, the root package remains the shipped authority for those serializers and the proposed `./markdown` subpath must not be described as released.

Standalone use must not require naruon or contextual-orchestrator. A CWL host can compose Inkspan additively through stable interfaces.

## Document identity and schema boundary

A versioned `document_envelope` is validated before canonicalization or hashing. Strict current-schema JSON text/byte handling rejects malformed input, duplicate object names, malformed UTF-8, unsupported schemas, hostile JavaScript object descriptors, and resource-limit violations according to the active contract.

Envelope identity routing is implemented on protected `main` under ADR 0015. `inspectDocumentEnvelopeIdentity()` and `inspectDocumentEnvelopeIdentityBytes()` require complete bounded envelope input and return only a frozen string `schemaId` plus positive safe-integer `schemaVersion`. They preserve duplicate-name, strict UTF-8/BOM, JSON-compatibility, resource-limit, descriptor/accessor/proxy-reflection, and redacted-error boundaries while deliberately not treating an unsupported `documentJson` as current TipTap/ProseMirror semantics.

`parseDocumentEnvelope()` remains strict and current-schema-only. Schema registry, migration selection/execution, authorization, tenant isolation, persistence, durable audit, retention, rollback, and recovery remain host-owned. A migrated value must pass the strict current parser before it becomes canonical Inkspan state.

SHA-256 revision evidence identifies exact canonical current-schema content. Local content digests are equality evidence only and never replace server-selected RFC 9110 strong validators for durable compare-and-swap.

## Markdown/HTML editor boundary

TipTap/ProseMirror is the deterministic editing authority for supported Markdown/HTML behavior. Import/export adapters must state supported and lossy constructs explicitly. Generated or rendered output does not silently replace canonical source state. Editor integrations validate extension/plugin configuration and public callback boundaries fail closed without executing accessors merely to inspect untrusted configuration.

The deterministic serializer implementation and its safe-link/inline-image policy must remain one behavioral authority across root and any headless package surface. A framework-neutral package boundary may change dependency topology, not conversion semantics or trust ownership.

## Rich clipboard boundary

SafeClipboard is implemented on protected `main`. Rich clipboard HTML is untrusted. Sanitization is installed in the actual TipTap/ProseMirror paste pipeline, uses bounded fail-closed semantic reconstruction, performs no external fetch or active execution, and preserves only supported semantic content. Pure sanitizer APIs and editor integration remain behaviorally consistent.

Browser-semantic release assurance is implemented on protected `main` under ADR 0016. Where browser fragment parsing or serialization can change security semantics, the same committed adversarial corpus runs through dependency-locked Playwright Chromium, Firefox, and WebKit projects on one exact source head. The gate binds browser results to the browser-test lock, fresh run identity, browser revisions, corpus, operating-system identity, and—on the tagged release path—the exact packed npm artifact digest. Differences require an explicit standards/threat rationale rather than unconditional normalization. Missing, stale, package-mismatched, skipped, cancelled, or semantically divergent evidence fails closed; feature-branch success never substitutes for fresh release-candidate evidence.

## SSR and native forms

SSR/native-form serialization is implemented on protected `main`. Server rendering must not instantiate an editor view. When a native field is explicitly enabled, SSR/hydration serializes the selected controlled Markdown/HTML value as escaped client-controlled input. Controlled `value` precedes `defaultValue` for that field. Before TipTap initializes, prop updates remain authoritative; once the editor is authoritative, document transactions synchronously mirror the configured serialization into the form field, and native reset processing restores the live serialized value when the host does not reset the editor.

The hidden/native field is never authentication, authorization, CSRF protection, tenant identity, signature, integrity proof, or durable-write evidence. Hosts independently validate and authorize submissions. Collaborative Yjs content remains absent from the server shell until the host-owned client collaboration lifecycle is established.

## Revision-scoped evidence

Selection evidence captures structural coordinates and canonical document state from the same immutable editor snapshot before asynchronous hashing. Transition evidence validates previous and resulting envelopes before sequential revision derivation. Ordinary evidence contains revision/coordinate/change metadata rather than document bodies and does not synthesize actor, tenant, time, model identity, signature, authorization, transport result, or durable-persistence claims.

Selection, transition, and W3C text-position evidence are implemented on protected `main`. W3C text-position evidence is a separate versioned projection under ADR 0018: offsets count Unicode code points in the named `inkspan-prosemirror-text` projection, start is inclusive, end is exclusive, grapheme-splitting boundaries fail closed, and evidence stays bound to the exact immutable document revision without selected quote text. ProseMirror structural positions and W3C text positions are never interchangeable merely because simple documents may yield equal numeric values.

The React-free text-position-selector package surface is also protected-main behavior. It reuses the deterministic projection helper without claiming editor state capture, annotation identity, authorization, durable persistence, or cross-revision re-anchoring. Hosts retain those authorities.

## Autosave state machine and durable concurrency

States are `idle`, `saving`, `blocked`, `closing`, and `closed`, with explicit blocked reasons. The local queue remains single-flight and retains bounded active/pending work and bounded flush waiters. Evidence supplied to a callback is immutable and validated before scheduling.

Durable sessions carry a host/server-selected strong HTTP entity tag. Successful host callbacks may advance the durable validator only from a validated replacement strong tag. Conflict, malformed result, callback failure, hostile reflection, promise-assimilation failure, timeout/network ambiguity, or explicit host failure never silently advances it.

Autosave lifecycle observation is implemented on protected `main`. Observation is optional and bounded to one construction-time callback. Construction emits nothing. Only distinct externally visible document-free snapshots are emitted. A method call producing no visible lifecycle transition, including a no-op `resume()`, emits nothing. Observer exceptions are isolated from queue ordering, save outcomes, recovery, and durable-validator handoff.

## Provider-neutral collaboration

Inkspan may bind to host-supplied Yjs-compatible document/awareness surfaces. Inkspan does not create/destroy production network providers and does not own room identity, tenant admission, user identity, authorization, provider credentials, reconnect policy, awareness privacy, update persistence, retention, encryption, or durable audit.

Provider updates and awareness state are untrusted tenant data, not authorization evidence. Provider outage/degraded mode is resolved by host policy; Inkspan must not invent durable collaboration success.

## Deterministic conversion and Office renderer

Deterministic conversion is an authority boundary separate from model-assisted authoring. Model output may become a proposed document change, but deterministic editor/conversion validation decides whether the resulting content is structurally acceptable.

The Office JSON→DOCX/XLSX/PPTX renderer is **network-free**, **macro-free**, model-free, and Desktop-Office-free. It must:

- validate the versioned input contract before publication;
- reject invalid XML 1.0 content and unsupported/non-JSON structures;
- bound bytes, strings, values, nesting, containers, and cyclic/aliased input according to the active renderer contract;
- enforce Excel worksheet-name, workbook, row/column, freeze-pane, and supported-cell limits;
- neutralize untrusted spreadsheet **formula**-significant strings under the supported value contract rather than silently creating formulas;
- preserve deterministic package metadata and supported document structure;
- publish through race-safe file operations with explicit overwrite semantics; and
- fail closed without reusing partial artifacts after validation or write failure.

Format-fidelity claims are limited to tested supported constructs. The renderer does not execute macros, scripts, formula calculation, embedded external resources, or Desktop Office automation.

## Print and paged-media presentation

Protected `main` does not yet contain the proposed paged-media stylesheet contract. Issue #115 and active PR #116 are `implemented_on_active_pr` only and are governed by Proposed ADR 0021.

The target contract is declarative CSS under `@media print`: hide Inkspan-owned interactive chrome, remove screen-only scroll/max-height clipping, suppress placeholder pseudo-content, keep authored links distinguishable without color alone, and apply conservative fragmentation hints while preserving authored content. It must not introduce JavaScript print orchestration, a PDF service, durable export authority, credentials, network access, identity, tenancy, or persistence.

Until protected integration, browser printing remains subject to the current screen stylesheet and must not be advertised as the new paged-media behavior.

## Model-assisted authoring

Inkspan does not own model credentials, provider routing, prompt retention, external-data-use approval, tenant disclosure policy, or model audit. A host may route assistance through contextual-orchestrator or another approved provider. Model output is untrusted proposed content and cannot bypass deterministic clipboard/document/conversion validation, user/host approval, or durable save authorization.

## Naruon and CWL composition

A naruon host may mount Inkspan through `compose` / `ui.panel` using a narrow client boundary. The host supplies serializable non-secret configuration, authenticated API calls, server-selected strong validators, accessible conflict/recovery UX, provider lifecycle, and optional model routing. Cross-document mounts use explicit host state/identity so editor/autosave state cannot bleed across documents.

Central `.github` automation, contextual-orchestrator, and other CWL repositories are external bounded contexts. Inkspan does not copy a central defect locally merely to make a leaf gate green.

## Failure and diagnostic semantics

Public failures are bounded, deterministic where practical, and redacted. Document bodies, credentials, tenant identifiers, complete provider metadata, callback values, private exception causes, prompts/model output, durable validators, and source-defined unsupported envelope fields are not reflected into generic public diagnostics unless a versioned authorized contract explicitly requires them.

Identity inspection returns no partial routing object on malformed input. An unknown structurally valid identity is not proof of migration success or current-schema compatibility. Browser evidence does not contain tenant clipboard content and cannot become application authorization/audit evidence. Text-position projection failure does not mutate the document or manufacture an annotation. Cancellation, retry/offline policy, migration retry/recovery, network timeout budgets, durable reconciliation, print destination policy, and user-facing localized recovery remain host responsibilities when they involve host transport, persistence, or OS/browser output.

## Accessibility and interaction semantics

Toolbar shortcut metadata is implemented on protected `main`. Shipped keyboard behavior, focus behavior, native controls, `aria-pressed`, `aria-keyshortcuts`, programmatic save/conflict state, and visible shortcut documentation must agree. Repository-level keyboard behavior outranks extension-local defaults when determining metadata. Status must not depend on color alone. Inkspan exposes machine state sufficient for host WCAG-oriented messaging while leaving localization and application-specific live-region policy to the host.

The Proposed print contract extends the same principle to paged output: Inkspan-owned interactive UI must not become document content, placeholder instruction must not print as authored text, and link semantics must remain visually distinguishable without relying on color alone.

## Packaging, compatibility, and release evidence

The root package and protected framework-independent subpaths are verified from packed artifacts under ESM, CommonJS, and strict TypeScript consumers according to each subpath's declared runtime boundary. Office Python surfaces are verified under the documented supported Python matrix, exact production statement/branch/function/line coverage, complete public docstrings, built wheel/package inspection, and license/dependency consistency.

ADR 0019 is Accepted on protected `main`. Stable registry publication uses one shared `MAJOR.MINOR.PATCH` product release version for the npm editor package and `inkspan-office` wheel, excludes prerelease tags from the registry jobs under the current contract, consumes the exact validated release tarball/wheel rather than rebuilding them, publishes through OIDC Trusted Publishing, and verifies public registry artifacts against the exact release digests. A live external registry release remains operational acceptance evidence separate from the integrated workflow contract.

Release publication verifies one exact integrated protected source head, expected artifact inventory and digests, package/runtime compatibility, security/coverage/accessibility/document-fidelity gates, fresh exact-source browser evidence bound to the exact packed npm artifact, SBOM/provenance/reproducibility where configured, zero valid unresolved findings, formal review/branch-protection requirements, and post-publication artifact smoke evidence.

Queued, cancelled, skipped-required, absent, stale-head, predecessor-head, status-only, author-only, or synthetic-merge evidence is not success. A commit status, automated model verdict, comment, formal review, merge authority, and external registry publication are distinct evidence classes.

## Security, privacy, and operability dependencies

`SECURITY.md`, `docs/THREAT_MODEL.md`, `docs/TEST_STRATEGY.md`, `docs/OPERABILITY.md`, `docs/TRACEABILITY.md`, and the detailed ADR corpus are part of this technical contract. Root `SECURITY.md` is `implemented_on_protected_main` and is the normative private vulnerability-reporting/coordinated-disclosure policy. ADR 0017 records the durable decision, ownership boundary, claim limits, and recovery/supersession semantics without duplicating the policy text.

## Implemented versus proposed

Protected `main` is the sole shipped implementation baseline. SafeClipboard, cross-engine browser assurance, the security disclosure lifecycle, autosave lifecycle observation, toolbar shortcut accessibility metadata, SSR/native-form serialization, revision-scoped selection evidence, W3C text-position selector evidence, the React-free text-position-selector subpath, document-transition evidence, envelope identity routing, and the OIDC-backed unified stable registry release train are `implemented_on_protected_main`.

The framework-neutral deterministic Markdown package subpath in PR #114 and CSS paged-media print boundary in PR #116 are `implemented_on_active_pr` only. They must remain labeled unshipped until their exact heads satisfy repository policy and reach protected `main`.
