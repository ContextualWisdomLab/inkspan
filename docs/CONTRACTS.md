# Inkspan Interface and Integration Contracts

Status: Protected-main canonical baseline

This document is the discoverable contract index for Inkspan's public product boundaries. Protected `main` remains the implementation authority. Open pull requests may describe Proposed behavior, but they are not shipped until protected integration and exact-head acceptance.

## Contract principles

Inkspan owns deterministic editor state, versioned document-envelope semantics, local revision/evidence primitives, local autosave ordering, deterministic conversion, accessibility metadata, and provider-neutral adapter behavior. The embedding **host** owns transport, authentication, authorization, tenant isolation, durable persistence, credentials, migrations, retention, deployment, durable audit storage, collaboration-provider lifecycle, and model-use policy.

Every contract is versioned or otherwise compatibility-bounded, deterministic where the domain permits it, fail closed on malformed or unsupported inputs, and explicit about degraded behavior. No contract silently promotes generated output, model output, a local digest, a browser field, a collaboration update, or a workflow status into authorization or durable-persistence authority.

## Public package and module contract

The root package may expose React/TipTap integration plus framework-independent helpers. Framework-independent subpaths must remain consumable without React, React DOM, TipTap UI, ProseMirror view, Yjs, browser globals, network access, database clients, credentials, or model SDKs unless that subpath's versioned contract explicitly requires them.

Package exports, declaration files, runtime support, and packed ESM/CommonJS/strict-TypeScript consumers are release evidence. A source file being present is not sufficient proof that a public contract is packaged correctly.

## Document envelope and revision contract

The **document envelope** is a versioned boundary carrying schema identity and supported document content. Current-schema parsing validates strict JSON/UTF-8 and active schema requirements before canonicalization or hashing. Unknown schema migration remains host-owned.

Envelope identity routing is implemented on protected `main` through `inspectDocumentEnvelopeIdentity()` and `inspectDocumentEnvelopeIdentityBytes()`, exported by the root package and the framework-independent `./envelope-identity` subpath. The inspectors validate a complete bounded envelope and return only frozen `{ schemaId, schemaVersion }` routing metadata. They do not return `documentJson`, accept unknown document semantics as current, execute a migration, authorize access, or claim durable persistence.

Canonical revision evidence is content-equality metadata only. It is not an actor identity, tenant identity, authorization grant, signature, timestamp, durable write receipt, or bearer credential. Identity routing does not weaken the strict current-schema parser or transfer schema-registry, migration, persistence, rollback, or recovery authority from the host.

Compatibility rule: a new schema or incompatible interpretation requires an explicit new versioned contract and migration story; existing persisted semantics are not silently redefined.

## Editor authoring contract

Markdown/HTML authoring uses the supported TipTap/ProseMirror editor surface as the deterministic editing authority. Import/export adapters must state which constructs are supported, lossy, or rejected. Rendered or exported representations do not silently become the canonical source document.

The editor surface may expose callbacks and handles for local state, revision capture, selection evidence, autosave coordination, and accessibility metadata. Callbacks are ordinary host code and cannot be trusted to preserve product invariants; Inkspan isolates callback failures at documented boundaries.

## Event and evidence contract

Local evidence records describe narrowly scoped facts such as revision identity, document transition, selection coordinates, lifecycle state, conversion warnings, or publication outcome. Evidence classes remain separate:

- local deterministic evidence;
- workflow/check evidence;
- formal review evidence;
- host authorization evidence;
- durable persistence evidence; and
- release/publication evidence.

No single status collapses those authorities. Ordinary evidence must avoid embedding complete document bodies, credentials, tenant identifiers, prompts, model outputs, or private exception causes unless a separate authorized contract explicitly requires them.

## Autosave contract

Autosave is a local coordination surface. It provides bounded single-flight ordering, bounded pending work, explicit blocked/conflict/failure state, optional lifecycle observation, and host callback handoff. The host performs authenticated transport and durable persistence.

A server-selected strong validator is the durable concurrency authority. It advances only from a validated successful host result. Conflict, timeout ambiguity, malformed callback output, host failure, promise/reflection failure, or observer failure never fabricates durable success.

Lifecycle observation emits only distinct externally visible document-free states. Construction and no-op operations do not manufacture events. The explicit local `getSnapshot()` coordination API may expose bounded active/pending/last-saved strong-validator fields defined by the autosave contract; those values remain confidential local concurrency metadata and are not generic diagnostics or telemetry.

Degraded behavior: when host persistence is unavailable or ambiguous, Inkspan preserves local state and explicit blocked/failure evidence rather than inventing a durable save.

## Collaboration contract

Inkspan collaboration is **provider-neutral**. A host may supply Yjs-compatible document, awareness, and provider bindings, but Inkspan does not own production room admission, user identity, authorization, provider credentials, reconnect policy, update persistence, retention, encryption, or durable audit.

Collaboration document content and awareness state are untrusted tenant data. Awareness presence is not authorization. Provider outage is a host-owned degraded mode; Inkspan must not synthesize remote durability or identity from local Yjs state.

No secret is required by the framework-independent collaboration contract itself. Provider credentials remain host-owned and must not be embedded in editor configuration or document content.

## Naruon modular composition contract

A naruon host may compose Inkspan through narrow `compose` / `ui.panel` integration while Inkspan remains independently usable. The host supplies serializable non-secret configuration, authenticated API transport, durable validators, provider lifecycle, tenant/document identity, accessible conflict/recovery UX, and optional model routing.

Inkspan does not directly access a naruon application database, credential store, tenant table, message bus, or deployment control plane. Cross-document mounts require explicit host identity/state so local editor/autosave state cannot bleed between documents.

No database is owned by this composition contract. Durable host data models and migrations stay outside Inkspan unless a future accepted ADR explicitly transfers ownership.

## Model-assisted authoring contract

Model-assisted authoring is separate from deterministic conversion and validation. A host may submit selected or derived context to an approved model path and receive a proposal. The proposal is untrusted content until the host/user accepts it and Inkspan's deterministic document/clipboard/conversion validators accept the resulting state.

The host owns model/provider selection, credentials, external-data-use approval, redaction, prompt retention, model logging, tenancy, authorization, human approval, and audit. No model may authorize a save, bypass deterministic validation, or redefine a revision/durable-validator contract.

## Deterministic Office conversion contract

Office rendering accepts versioned bounded JSON and produces supported DOCX/XLSX/PPTX artifacts without model, network, macro, or Desktop Office dependency. Inputs must satisfy XML 1.0, size/depth/container/cycle, spreadsheet, worksheet-name, freeze-pane, supported-structure, and formula-injection rules before publication.

File publication is explicit about overwrite semantics and uses race-safe publication behavior. Partial or failed writes are not successful artifacts. Reproducible metadata and package/document-fidelity tests define supported claims; unsupported Office constructs are rejected or documented as unsupported rather than silently approximated.

## Security and data authority contract

Untrusted clipboard HTML, DOM capabilities, native form values, Office structures, host callbacks, collaboration updates, and model proposals are data, not instruction or authority. Active content, external resource fetching, macros, formula execution, malicious descriptors/accessors, and malformed structures remain behind explicit fail-closed boundaries.

No secret, credential, durable validator, tenant identifier, complete document body, or model prompt belongs in generic public diagnostics or telemetry. Hosts own authenticated transport, authorization, encryption, retention, tenant isolation, durable audit, incident response, and deployment controls.

## Versioning and schema evolution

Public types, schema identifiers, event/evidence shapes, package subpaths, and host integration behavior must evolve compatibly or under a new explicit version. Breaking behavior requires documented migration and rollback guidance. Unknown versions fail closed unless a specifically bounded identity-routing contract allows inspection without interpretation.

A compatibility claim must be backed by packed-package consumers, schema fixtures, migration/rollback evidence where relevant, and the supported runtime/version matrix.

## Failure and degraded-mode contract

Expected degraded states are explicit rather than mapped to false success:

- host persistence unavailable or ambiguous -> local save state remains blocked/failed;
- collaboration provider unavailable -> local editing may continue only according to host policy, with no remote-durability claim;
- unsupported or malformed document schema -> fail closed or route through an explicit host migration path;
- conversion validation/publication failure -> no successful artifact claim;
- model/provider unavailable -> deterministic authoring/conversion remains authoritative and the model proposal path is unavailable;
- review/check/release evidence missing -> merge/release remains blocked even if source-local tests pass.

## Release and rollback contract

A public release binds one exact integrated protected source head to package/artifact identity, applicable CI/security/accessibility/document-fidelity evidence, owned production coverage, public-docstring evidence, SBOM/provenance/reproducibility where configured, formal review requirements, rollback guidance, and post-publication smoke verification.

Before immutable publication, the canonical draft inventory is **exactly three regular top-level files**: exactly one npm tarball, exactly one Inkspan Office wheel, and `SHA256SUMS`. Missing, stale, unexpected, duplicate, non-regular, incompletely uploaded, or digest-mismatched assets fail closed. After upload and before publication, the authenticated paginated GitHub Releases API inventory must equal the local release directory by exact asset name, every remote asset must report an uploaded state, and every GitHub-reported `sha256:` digest must equal the digest of the exact transferred local file. The workflow does not silently delete an unexpected remote asset to make an ambiguous draft look clean.

Rollback must preserve readable canonical documents and must not require silently reinterpreting persisted schema semantics. Host-owned migrations, persistence rollback, tenant recovery, and deployment rollback remain host responsibilities unless a future versioned contract explicitly assigns them to Inkspan.

## Contract-to-authority map

| Contract surface | Inkspan authority | Host authority |
| --- | --- | --- |
| Markdown/HTML editing | deterministic editor state and supported import/export semantics | application workflow, document ownership, authorization |
| document envelope/revision | schema validation, identity routing, canonical bytes, local equality evidence | migration orchestration, durable storage, signatures, tenant binding |
| autosave | local ordering/state, callback contract, validator validation | transport, durable CAS, retry/offline policy, persistence |
| collaboration | provider-neutral editor/Yjs binding | provider lifecycle, rooms, identity, authorization, persistence, awareness privacy |
| Office rendering | deterministic bounded JSON→artifact conversion | file destination policy, downstream distribution, tenant authorization |
| naruon composition | stable local package/module boundary | authenticated compose transport, tenancy, provider/model policy |
| model assistance | deterministic proposal acceptance boundary | provider, prompt/data policy, credentials, human approval |
| release evidence | exact three-file draft inventory, package/artifact/digest verification and repository evidence | downstream deployment and operational rollout |

## Related canonical documents

- `docs/PRD.md` — buyer/user requirements and accepted outcomes.
- `docs/TRD.md` — technical invariants and runtime boundaries.
- `ARCHITECTURE.md` — protected-main implementation architecture.
- `docs/UML.md` and `docs/DATA_MODEL.md` — interaction and conceptual data/evidence views.
- `docs/THREAT_MODEL.md` — threat analysis and trust boundaries.
- `docs/TEST_STRATEGY.md` — machine evidence required for these contracts, including the exact release draft inventory/digest gate.
- `docs/OPERABILITY.md` — failure, recovery, rollback, incident ownership, and release draft reconciliation.
- `docs/TRACEABILITY.md` — standards, research, and implementation evidence traceability.
- `docs/adr/README.md` — detailed architectural decisions.
