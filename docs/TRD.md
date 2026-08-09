# Inkspan Technical Requirements

Status: Protected-main canonical baseline

## Authority and runtime boundary

Inkspan owns deterministic editor, conversion, document-envelope, local evidence, local autosave ordering, accessibility metadata, package, and provider-neutral adapter behavior. Hosts own network transport, authentication, authorization, tenant isolation, durable persistence, credentials, migrations, retention, durable audit storage, deployment, collaboration-provider lifecycle, and model-use policy.

Protected `main` is the implementation authority. Open PRs may provide Proposed contracts or evidence but do not become shipped behavior until protected integration.

## Package and module boundaries

The root product may compose TipTap/ProseMirror, React-facing integration, deterministic conversion, revision evidence, autosave, collaboration adapters, email/base64 utilities, and Office rendering. Framework-independent subpaths must not accidentally require React, DOM globals, TipTap UI, ProseMirror view, Yjs, network, credentials, database clients, or model SDKs when their public contract excludes those dependencies.

The active envelope-routing slice adds `@contextualwisdomlab/cwl-editor/envelope-identity` as a framework-independent ESM/CommonJS/strict-TypeScript surface. It must remain usable without the interactive editor graph and expose only routing metadata plus bounded input options.

Standalone use must not require naruon or contextual-orchestrator. A CWL host can compose Inkspan additively through stable interfaces.

## Document identity and schema boundary

A versioned `document_envelope` is validated before canonicalization or hashing. Strict current-schema JSON text/byte handling rejects malformed input, duplicate object names, malformed UTF-8, unsupported schemas, hostile JavaScript object descriptors, and resource-limit violations according to the active contract.

PR #84 implements the ADR 0015 identity-only routing boundary. `inspectDocumentEnvelopeIdentity()` and `inspectDocumentEnvelopeIdentityBytes()` require complete bounded envelope input and return only a frozen string `schemaId` plus positive safe-integer `schemaVersion`. They preserve duplicate-name, strict UTF-8/BOM, JSON-compatibility, resource-limit, descriptor/accessor/proxy-reflection, and redacted-error boundaries while deliberately not treating an unsupported `documentJson` as current TipTap/ProseMirror semantics.

`parseDocumentEnvelope()` remains strict and current-schema-only. Schema registry, migration selection/execution, authorization, tenant isolation, persistence, durable audit, retention, rollback, and recovery remain host-owned. A migrated value must pass the strict current parser before it becomes canonical Inkspan state.

SHA-256 revision evidence identifies exact canonical current-schema content. Local content digests are equality evidence only and never replace server-selected RFC 9110 strong validators for durable compare-and-swap.

## Markdown/HTML editor boundary

TipTap/ProseMirror is the deterministic editing authority for supported Markdown/HTML behavior. Import/export adapters must state supported and lossy constructs explicitly. Generated or rendered output does not silently replace canonical source state. Editor integrations validate extension/plugin configuration and public callback boundaries fail closed without executing accessors merely to inspect untrusted configuration.

## Rich clipboard boundary

SafeClipboard is implemented on protected `main`. Rich clipboard HTML is untrusted. Sanitization is installed in the actual TipTap/ProseMirror paste pipeline, uses bounded fail-closed semantic reconstruction, performs no external fetch or active execution, and preserves only supported semantic content. Pure sanitizer APIs and editor integration remain behaviorally consistent.

Where browser fragment parsing or serialization can change security semantics, a release must run the same adversarial corpus through dependency-locked Playwright Chromium, Firefox, and WebKit projects. Differences require an explicit standards/threat rationale rather than an unconditional parity normalization. Issue #66 remains the separate browser-realistic release-assurance implementation lane and is no longer blocked by SafeClipboard integration.

## SSR and native forms

SSR/native-form serialization is implemented on protected `main`. Server rendering must not instantiate an editor view. When a native field is explicitly enabled, SSR/hydration serializes the selected controlled Markdown/HTML value as escaped client-controlled input. Controlled `value` precedes `defaultValue` for that field. Before TipTap initializes, prop updates remain authoritative; once the editor is authoritative, document transactions synchronously mirror the configured serialization into the form field, and native reset processing restores the live serialized value when the host does not reset the editor.

The hidden/native field is never authentication, authorization, CSRF protection, tenant identity, signature, integrity proof, or durable-write evidence. Hosts independently validate and authorize submissions. Collaborative Yjs content remains absent from the server shell until the host-owned client collaboration lifecycle is established.

## Revision-scoped evidence

Selection evidence captures structural coordinates and canonical document state from the same immutable editor snapshot before asynchronous hashing. Transition evidence validates previous and resulting envelopes before sequential revision derivation. Ordinary evidence contains revision/coordinate/change metadata rather than document bodies and does not synthesize actor, tenant, time, model identity, signature, authorization, transport result, or durable-persistence claims.

Selection and transition evidence are implemented on protected `main`; their local equality/lineage claims remain intentionally narrower than host-owned authorization, occurrence provenance, durable audit, re-anchoring, and persistence authority.

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

## Model-assisted authoring

Inkspan does not own model credentials, provider routing, prompt retention, external-data-use approval, tenant disclosure policy, or model audit. A host may route assistance through contextual-orchestrator or another approved provider. Model output is untrusted proposed content and cannot bypass deterministic clipboard/document/conversion validation, user/host approval, or durable save authorization.

## Naruon and CWL composition

A naruon host may mount Inkspan through `compose` / `ui.panel` using a narrow client boundary. The host supplies serializable non-secret configuration, authenticated API calls, server-selected strong validators, accessible conflict/recovery UX, provider lifecycle, and optional model routing. Cross-document mounts use explicit host state/identity so editor/autosave state cannot bleed across documents.

Central `.github` automation, contextual-orchestrator, and other CWL repositories are external bounded contexts. Inkspan does not copy a central defect locally merely to make a leaf gate green.

## Failure and diagnostic semantics

Public failures are bounded, deterministic where practical, and redacted. Document bodies, credentials, tenant identifiers, complete provider metadata, callback values, private exception causes, prompts/model output, durable validators, and source-defined unsupported envelope fields are not reflected into generic public diagnostics unless a versioned authorized contract explicitly requires them.

Identity inspection returns no partial routing object on malformed input. An unknown structurally valid identity is not proof of migration success or current-schema compatibility. Cancellation, retry/offline policy, migration retry/recovery, network timeout budgets, durable reconciliation, and user-facing localized recovery remain host responsibilities when they involve host transport or persistence.

## Accessibility and interaction semantics

Toolbar shortcut metadata is implemented on protected `main`. Shipped keyboard behavior, focus behavior, native controls, `aria-pressed`, `aria-keyshortcuts`, programmatic save/conflict state, and visible shortcut documentation must agree. Repository-level keyboard behavior outranks extension-local defaults when determining metadata. Status must not depend on color alone. Inkspan exposes machine state sufficient for host WCAG-oriented messaging while leaving localization and application-specific live-region policy to the host.

## Packaging, compatibility, and release evidence

The root package and framework-independent subpaths are verified from packed artifacts under ESM, CommonJS, and strict TypeScript consumers. PR #84 adds equivalent packed-artifact verification for `envelope-identity` without framework dependencies. Office Python surfaces are verified under the documented supported Python matrix, exact production statement/branch/function/line coverage, complete public docstrings, built wheel/package inspection, and license/dependency consistency.

Release publication verifies one exact integrated protected source head, expected artifact inventory and digests, package/runtime compatibility, security/coverage/accessibility/document-fidelity gates, SBOM/provenance/reproducibility where configured, zero valid unresolved findings, formal review/branch-protection requirements, and post-publication artifact smoke evidence.

Queued, cancelled, skipped-required, absent, stale-head, predecessor-head, status-only, author-only, or synthetic-merge evidence is not success. A commit status, automated model verdict, comment, formal review, and merge authority are distinct evidence classes.

## Security, privacy, and operability dependencies

`SECURITY.md`, `docs/THREAT_MODEL.md`, `docs/TEST_STRATEGY.md`, `docs/OPERABILITY.md`, `docs/TRACEABILITY.md`, and the detailed ADR corpus are part of this technical contract. Root `SECURITY.md` is `implemented_on_protected_main` and is the normative private vulnerability-reporting/coordinated-disclosure policy. ADR 0017 records the durable decision, ownership boundary, claim limits, and recovery/supersession semantics without duplicating the policy text.

## Implemented versus proposed

Protected `main` is the sole implemented baseline. SafeClipboard, the security disclosure lifecycle, autosave lifecycle observation, toolbar shortcut accessibility metadata, SSR/native-form serialization, revision-scoped selection evidence, and document-transition evidence are implemented on protected `main`. Envelope identity routing is `implemented_on_active_pr` in PR #84 and remains unshipped until protected integration. Cross-engine browser assurance remains `planned`, now unblocked and required before the SafeClipboard behavior enters the verified release line. Canonical docs distinguish target architecture from shipped behavior and must be updated when the protected implementation changes.
