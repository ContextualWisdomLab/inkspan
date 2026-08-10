# Inkspan Technical Requirements

Status: Protected-main canonical baseline with active W3C selector reconciliation

## Authority and runtime boundary

Inkspan owns deterministic editor, conversion, document-envelope, local evidence, local autosave ordering, accessibility metadata, package, and provider-neutral adapter behavior. Hosts own network transport, authentication, authorization, tenant isolation, durable persistence, credentials, migrations, retention, durable audit storage, deployment, collaboration-provider lifecycle, annotation identity/storage/publication/re-anchoring, and model-use policy.

Protected `main` is the implementation authority. Open PRs may provide Proposed contracts or evidence but do not become shipped behavior until protected integration.

## Package and module boundaries

The root product may compose TipTap/ProseMirror, React-facing integration, deterministic conversion, revision/selection evidence, autosave, collaboration adapters, email/base64 utilities, and Office rendering. Framework-independent subpaths must not accidentally require React, DOM globals, TipTap UI, ProseMirror view, Yjs, network, credentials, database clients, or model SDKs when their public contract excludes those dependencies.

The protected envelope-routing contract includes `@contextualwisdomlab/cwl-editor/envelope-identity` as a framework-independent ESM/CommonJS/strict-TypeScript surface. It remains usable without the interactive editor graph and exposes only routing metadata plus bounded input options.

Revision-scoped W3C text-position evidence is currently an active root-package editor-handle capability rather than a separate persistence service. Its packed ESM/CommonJS/strict-TypeScript consumer contract must prove that public constants, failure types, evidence types, and the handle method are present without adding a database, network, provider, naruon, contextual-orchestrator, credential, or model dependency.

Standalone use must not require naruon or contextual-orchestrator. A CWL host can compose Inkspan additively through stable interfaces.

## Document identity and schema boundary

A versioned `document_envelope` is validated before canonicalization or hashing. Strict current-schema JSON text/byte handling rejects malformed input, duplicate object names, malformed UTF-8, unsupported schemas, hostile JavaScript object descriptors, and resource-limit violations according to the active contract.

Envelope identity routing is implemented on protected `main` under ADR 0015. `inspectDocumentEnvelopeIdentity()` and `inspectDocumentEnvelopeIdentityBytes()` require complete bounded envelope input and return only a frozen string `schemaId` plus positive safe-integer `schemaVersion`. They preserve duplicate-name, strict UTF-8/BOM, JSON-compatibility, resource-limit, descriptor/accessor/proxy-reflection, and redacted-error boundaries while deliberately not treating an unsupported `documentJson` as current TipTap/ProseMirror semantics.

`parseDocumentEnvelope()` remains strict and current-schema-only. Schema registry, migration selection/execution, authorization, tenant isolation, persistence, durable audit, retention, rollback, and recovery remain host-owned. A migrated value must pass the strict current parser before it becomes canonical Inkspan state.

SHA-256 revision evidence identifies exact canonical current-schema content. Local content digests are equality evidence only and never replace server-selected RFC 9110 strong validators for durable compare-and-swap.

## Markdown/HTML editor boundary

TipTap/ProseMirror is the deterministic editing authority for supported Markdown/HTML behavior. Import/export adapters must state supported and lossy constructs explicitly. Generated or rendered output does not silently replace canonical source state. Editor integrations validate extension/plugin configuration and public callback boundaries fail closed without executing accessors merely to inspect untrusted configuration.

## Rich clipboard and real-engine release boundary

SafeClipboard and the cross-engine browser assurance gate are implemented on protected `main`. Rich clipboard HTML is untrusted. Sanitization is installed in the actual TipTap/ProseMirror paste pipeline, uses bounded fail-closed semantic reconstruction, performs no external fetch or active execution, and preserves only supported semantic content. Pure sanitizer APIs and editor integration remain behaviorally consistent.

Where browser fragment parsing or serialization can change security semantics, the same committed adversarial corpus runs through dependency-locked Playwright Chromium, Firefox, and WebKit projects. Security-relevant output is compared semantically, not normalized merely to make engines agree. A difference requires a focused standards/threat rationale.

Browser evidence is fresh-run scoped and bound to exact source SHA, browser/test lock, browser versions, corpus identity, runner identity, and the exact packed npm artifact digest. The release path exercises the packed artifact and retains only the bounded `.browser-evidence` payload rather than broad Playwright results that can contain unnecessary paths or page output. Stale evidence, mismatched package digests, missing engines, or incomplete evidence fails closed.

## SSR and native forms

SSR/native-form serialization is implemented on protected `main`. Server rendering must not instantiate an editor view. When a native field is explicitly enabled, SSR/hydration serializes the selected controlled Markdown/HTML value as escaped client-controlled input. Controlled `value` precedes `defaultValue` for that field. Before TipTap initializes, prop updates remain authoritative; once the editor is authoritative, document transactions synchronously mirror the configured serialization into the form field, and native reset processing restores the live serialized value when the host does not reset the editor.

The hidden/native field is never authentication, authorization, CSRF protection, tenant identity, signature, integrity proof, or durable-write evidence. Hosts independently validate and authorize submissions. Collaborative Yjs content remains absent from the server shell until the host-owned client collaboration lifecycle is established.

## Revision-scoped review and annotation evidence

Protected ProseMirror selection evidence captures structural coordinates and canonical document state from the same immutable editor snapshot before asynchronous hashing. Transition evidence validates previous and resulting envelopes before sequential revision derivation. Ordinary evidence contains revision/coordinate/change metadata rather than document bodies and does not synthesize actor, tenant, time, model identity, signature, authorization, transport result, or durable-persistence claims.

Revision-scoped W3C `TextPositionSelector` evidence is `implemented_on_active_pr` under ADR 0018. It does not relabel ProseMirror positions. The implementation derives an explicit versioned logical-text projection from the same captured immutable `EditorState` used to create the revision envelope:

- projection identity `inkspan-prosemirror-text`, version `1`;
- logical ProseMirror document order;
- U+000A LINE FEED as the configured block separator;
- U+FFFC OBJECT REPLACEMENT CHARACTER for supported non-text leaf nodes;
- no Unicode normalization or visual bidirectional reordering;
- inclusive `start` / exclusive `end` offsets counted as Unicode code points; and
- grapheme-boundary validation before evidence is returned.

The W3C Recommendation states that text selection is based on Unicode code points and logical order, and that selection boundaries should not split grapheme clusters. Inkspan uses `Intl.Segmenter` grapheme segmentation for the validation boundary. If that capability is absent, the optional selector-evidence operation fails closed with `segmenter_unavailable`; a split boundary fails with `grapheme_boundary`. No automatic boundary adjustment is allowed because that would change the selected range.

The selector value contains no selected quote text by default. It is exact-revision location evidence, not a durable cross-revision anchor, actor/time/auth record, server validator, signature, or persistence receipt. Hosts own annotation IDs/bodies, source-resource IRI policy, authorization, tenancy, storage, publication, audit, and any re-anchoring after source changes.

Selection and transition evidence are implemented on protected `main`; W3C selector evidence remains active-PR authority until protected integration.

## Autosave state machine and durable concurrency

States are `idle`, `saving`, `blocked`, `closing`, and `closed`, with explicit blocked reasons. The local queue remains single-flight and retains bounded active/pending work and bounded flush waiters. Evidence supplied to a callback is immutable and validated before scheduling.

Durable sessions carry a host/server-selected strong HTTP entity tag. Successful host callbacks may advance the durable validator only from a validated replacement strong tag. Conflict, malformed result, callback failure, hostile reflection, promise-assimilation failure, timeout/network ambiguity, or explicit host failure never silently advances it.

Autosave lifecycle observation is implemented on protected `main`. Observation is optional and bounded to one construction-time callback. Construction emits nothing. Only distinct externally visible document-free snapshots are emitted. A method call producing no visible lifecycle transition, including a no-op `resume()`, emits nothing. Observer exceptions are isolated from queue ordering, save outcomes, recovery, and durable-validator handoff.

## Provider-neutral collaboration

Inkspan may bind to host-supplied Yjs-compatible document/awareness surfaces. Inkspan does not create/destroy production network providers and does not own room identity, tenant admission, user identity, authorization, provider credentials, reconnect policy, awareness privacy, update persistence, retention, encryption, durable audit, or annotation re-anchoring.

Provider updates and awareness state are untrusted tenant data, not authorization evidence. Provider outage/degraded mode is resolved by host policy; Inkspan must not invent durable collaboration success. W3C position selectors do not silently become Yjs relative positions.

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

A naruon host may mount Inkspan through `compose` / `ui.panel` using a narrow client boundary. The host supplies serializable non-secret configuration, authenticated API calls, server-selected strong validators, accessible conflict/recovery UX, provider lifecycle, annotation/review policy, and optional model routing. Cross-document mounts use explicit host state/identity so editor/autosave state cannot bleed across documents.

Central `.github` automation, contextual-orchestrator, and other CWL repositories are external bounded contexts. Inkspan does not copy a central defect locally merely to make a leaf gate green.

## Failure and diagnostic semantics

Public failures are bounded, deterministic where practical, and redacted. Document bodies, credentials, tenant identifiers, complete provider metadata, callback values, private exception causes, prompts/model output, durable validators, source-defined unsupported envelope fields, and selected annotation text are not reflected into generic public diagnostics unless a versioned authorized contract explicitly requires them.

Identity inspection returns no partial routing object on malformed input. An unknown structurally valid identity is not proof of migration success or current-schema compatibility. W3C selector evidence returns no weakened approximation when grapheme segmentation is unavailable or a boundary is invalid. Cancellation, retry/offline policy, migration retry/recovery, annotation re-anchoring, network timeout budgets, durable reconciliation, and user-facing localized recovery remain host responsibilities when they involve host transport or persistence.

## Accessibility and interaction semantics

Toolbar shortcut metadata is implemented on protected `main`. Shipped keyboard behavior, focus behavior, native controls, `aria-pressed`, `aria-keyshortcuts`, programmatic save/conflict state, and visible shortcut documentation must agree. Repository-level keyboard behavior outranks extension-local defaults when determining metadata. Status must not depend on color alone. Inkspan exposes machine state sufficient for host WCAG-oriented messaging while leaving localization and application-specific live-region policy to the host.

W3C selector projection uses logical text order rather than visual bidirectional order so interoperable text positions do not depend on presentation layout.

## Packaging, compatibility, and release evidence

The root package and framework-independent subpaths are verified from packed artifacts under ESM, CommonJS, and strict TypeScript consumers. The protected `envelope-identity` subpath has equivalent packed-artifact verification without framework dependencies. Active W3C selector evidence adds a root-package packed consumer verifying runtime exports and strict declarations for the selector constants, types, error contract, and imperative handle.

Office Python surfaces are verified under the documented supported Python matrix, exact production statement/branch/function/line coverage, complete public docstrings, built wheel/package inspection, and license/dependency consistency.

Release publication verifies one exact integrated protected source head, expected artifact inventory and digests, package/runtime compatibility, security/coverage/accessibility/document-fidelity/browser gates, SBOM/provenance/reproducibility where configured, zero valid unresolved findings, formal review/branch-protection requirements, and post-publication artifact smoke evidence.

Queued, cancelled, skipped-required, absent, stale-head, predecessor-head, status-only, author-only, or synthetic-merge evidence is not success. A commit status, automated model verdict, comment, formal review, and merge authority are distinct evidence classes.

## Security, privacy, and operability dependencies

`SECURITY.md`, `docs/THREAT_MODEL.md`, `docs/TEST_STRATEGY.md`, `docs/OPERABILITY.md`, `docs/TRACEABILITY.md`, and the detailed ADR corpus are part of this technical contract. Root `SECURITY.md` is `implemented_on_protected_main` and is the normative private vulnerability-reporting/coordinated-disclosure policy. ADR 0017 records the durable decision, ownership boundary, claim limits, and recovery/supersession semantics without duplicating the policy text. ADR 0018 records the active W3C selector coordinate/projection authority without transferring host annotation persistence.

## Implemented versus active/proposed

Protected `main` is the sole implemented baseline. SafeClipboard, cross-engine browser assurance with packed-artifact evidence, the security disclosure lifecycle, autosave lifecycle observation, toolbar shortcut accessibility metadata, SSR/native-form serialization, revision-scoped ProseMirror selection evidence, document-transition evidence, and envelope identity routing are `implemented_on_protected_main`. Revision-scoped W3C text-position selector evidence is `implemented_on_active_pr` and remains unshipped until protected integration. Canonical docs distinguish target architecture from shipped behavior and must be updated when the protected implementation changes.
