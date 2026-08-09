# Inkspan Technical Requirements

Status: Proposed canonical baseline

## Authority and runtime boundary

Inkspan owns deterministic editor, conversion, document-envelope, local evidence, local autosave ordering, accessibility metadata, package, and provider-neutral adapter behavior. Hosts own network transport, authentication, authorization, tenant isolation, durable persistence, credentials, migrations, retention, durable audit storage, deployment, collaboration-provider lifecycle, and model-use policy.

Protected `main` is the implementation authority. Open PRs may provide Proposed contracts or evidence but do not become shipped behavior until protected integration.

## Package and module boundaries

The root product may compose TipTap/ProseMirror, React-facing integration, deterministic conversion, revision evidence, autosave, collaboration adapters, email/base64 utilities, and Office rendering. Framework-independent subpaths must not accidentally require React, DOM globals, TipTap UI, ProseMirror view, Yjs, network, credentials, database clients, or model SDKs when their public contract excludes those dependencies.

Standalone use must not require naruon or contextual-orchestrator. A CWL host can compose Inkspan additively through stable interfaces.

## Document identity and schema boundary

A versioned `document_envelope` is validated before canonicalization or hashing. Strict JSON text/byte handling rejects malformed input, duplicate object names, malformed UTF-8, unsupported schemas, hostile JavaScript object descriptors, and resource-limit violations according to the active contract.

SHA-256 revision evidence identifies exact canonical content. Local content digests are equality evidence only and never replace server-selected RFC 9110 strong validators for durable compare-and-swap. Unknown schema migration remains host-owned; a future identity-inspection helper may expose routing metadata without becoming a permissive current-schema parser or migration executor.

## Markdown/HTML editor boundary

TipTap/ProseMirror is the deterministic editing authority for supported Markdown/HTML behavior. Import/export adapters must state supported and lossy constructs explicitly. Generated or rendered output does not silently replace canonical source state. Editor integrations validate extension/plugin configuration and public callback boundaries fail closed without executing accessors merely to inspect untrusted configuration.

## Rich clipboard boundary

Rich clipboard HTML is untrusted. Sanitization must be installed in the actual TipTap/ProseMirror paste pipeline, use bounded fail-closed validation, perform no external fetch or active execution, and preserve only supported semantic content. Pure sanitizer APIs and editor integration must remain behaviorally consistent.

Where browser fragment parsing or serialization can change security semantics, a release must run the same adversarial corpus through dependency-locked Playwright Chromium, Firefox, and WebKit projects. Differences require an explicit standards/threat rationale rather than an unconditional parity normalization.

## SSR and native forms

Server rendering must not instantiate an editor view. When a native field is explicitly enabled, SSR/hydration serializes the selected controlled Markdown/HTML value as escaped client-controlled input. Once the editor is authoritative, document transactions synchronously mirror the configured serialization into the form field.

The hidden/native field is never authentication, authorization, CSRF protection, tenant identity, signature, integrity proof, or durable-write evidence. Hosts independently validate and authorize submissions.

## Revision-scoped evidence

Selection evidence captures structural coordinates and canonical document state from the same immutable editor snapshot before asynchronous hashing. Transition evidence validates previous and resulting envelopes before sequential revision derivation. Ordinary evidence contains revision/coordinate/change metadata rather than document bodies and does not synthesize actor, tenant, time, model identity, signature, authorization, transport result, or durable-persistence claims.

## Autosave state machine and durable concurrency

States are `idle`, `saving`, `blocked`, `closing`, and `closed`, with explicit blocked reasons. The local queue remains single-flight and retains bounded active/pending work and bounded flush waiters. Evidence supplied to a callback is immutable and validated before scheduling.

Durable sessions carry a host/server-selected strong HTTP entity tag. Successful host callbacks may advance the durable validator only from a validated replacement strong tag. Conflict, malformed result, callback failure, hostile reflection, promise-assimilation failure, timeout/network ambiguity, or explicit host failure never silently advances it.

Lifecycle observation is optional and bounded to one construction-time callback. Construction emits nothing. Only distinct externally visible document-free snapshots are emitted. A method call producing no visible lifecycle transition, including a no-op `resume()`, emits nothing. Observer exceptions are isolated from queue ordering, save outcomes, recovery, and durable-validator handoff.

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

## Model-assisted authoring

Inkspan does not own model credentials, provider routing, prompt retention, external-data-use approval, tenant disclosure policy, or model audit. A host may route assistance through contextual-orchestrator or another approved provider. Model output is untrusted proposed content and cannot bypass deterministic clipboard/document/conversion validation, user/host approval, or durable save authorization.

## Naruon and CWL composition

A naruon host may mount Inkspan through `compose` / `ui.panel` using a narrow client boundary. The host supplies serializable non-secret configuration, authenticated API calls, server-selected strong validators, accessible conflict/recovery UX, provider lifecycle, and optional model routing. Cross-document mounts use explicit host state/identity so editor/autosave state cannot bleed across documents.

Central `.github` automation, contextual-orchestrator, and other CWL repositories are external bounded contexts. Inkspan does not copy a central defect locally merely to make a leaf gate green.

## Failure and diagnostic semantics

Public failures are bounded, deterministic where practical, and redacted. Document bodies, credentials, tenant identifiers, complete provider metadata, callback values, private exception causes, prompts/model output, and durable validators are not reflected into generic public diagnostics unless a versioned authorized contract explicitly requires them.

Cancellation, retry/offline policy, network timeout budgets, durable reconciliation, and user-facing localized recovery remain host responsibilities when they involve host transport or persistence.

## Accessibility and interaction semantics

Shipped keyboard behavior, focus behavior, native controls, `aria-pressed`, `aria-keyshortcuts`, programmatic save/conflict state, and visible shortcut documentation must agree. Status must not depend on color alone. Inkspan exposes machine state sufficient for host WCAG-oriented messaging while leaving localization and application-specific live-region policy to the host.

## Packaging, compatibility, and release evidence

The root package and framework-independent subpaths are verified from packed artifacts under ESM, CommonJS, and strict TypeScript consumers. Office Python surfaces are verified under the documented supported Python matrix, exact production statement/branch coverage, complete public docstrings, built wheel/package inspection, and license/dependency consistency.

Release publication verifies one exact integrated protected source head, expected artifact inventory and digests, package/runtime compatibility, security/coverage/accessibility/document-fidelity gates, SBOM/provenance/reproducibility where configured, zero valid unresolved findings, formal review/branch-protection requirements, and post-publication artifact smoke evidence.

Queued, cancelled, skipped-required, absent, stale-head, predecessor-head, status-only, author-only, or synthetic-merge evidence is not success. A commit status, automated model verdict, comment, formal review, and merge authority are distinct evidence classes.

## Security, privacy, and operability dependencies

`docs/THREAT_MODEL.md`, `docs/TEST_STRATEGY.md`, `docs/OPERABILITY.md`, `docs/TRACEABILITY.md`, and the detailed ADR corpus are part of this technical contract. `SECURITY.md` is separately owned by the open security-disclosure PR until that bounded line reaches protected `main`; this branch must not duplicate/race it.

## Implemented versus proposed

Protected `main` is the sole implemented baseline. Requirements describing open clipboard, autosave observation, transition/selection evidence, SSR/native-form, accessibility, release-hardening, or security-disclosure PRs are Proposed until merged. Canonical docs distinguish target architecture from shipped behavior and must be updated when the protected implementation changes.
