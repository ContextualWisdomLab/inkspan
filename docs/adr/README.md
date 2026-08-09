# Inkspan Architecture Decision Records

Status values: Proposed, Accepted, Superseded.

This index records durable architectural decisions. Protected-main implementation is required before a feature-specific decision may be treated as shipped behavior.

| ADR | Status | Decision |
|---|---|---|
| 0001 | Proposed | Product and host authority boundary |
| 0002 | Proposed | Canonical document and revision evidence |
| 0003 | Proposed | Safe rich clipboard boundary |
| 0004 | Proposed | Strong durable validator and bounded autosave |
| 0005 | Proposed | Revision-scoped review evidence |
| 0006 | Proposed | SSR/native form client-controlled boundary |
| 0007 | Proposed | Provider-neutral collaboration ownership |
| 0008 | Proposed | Release evidence and independent governance |

## Decision summaries

### ADR-0001 Product and host authority boundary

Inkspan owns editor, deterministic conversion and local coordination. Hosts own transport, authentication/authorization, tenancy, durable persistence, credentials, migration, retention, durable audit, deployment and model policy. Alternative rejected: an editor package that silently becomes the host platform.

### ADR-0002 Canonical document and revision evidence

Validate a versioned document envelope before deterministic canonicalization and SHA-256 revision derivation. Revision tags are equality evidence, not identity or authorization. Alternative rejected: hashing arbitrary editor/JSON serialization.

### ADR-0003 Safe rich clipboard boundary

Treat rich HTML as untrusted and sanitize through a bounded fail-closed semantic policy installed in the actual ProseMirror paste path. Alternative rejected: UI-only/manual sanitizer calls that do not protect real paste behavior.

### ADR-0004 Strong durable validator and bounded autosave

Use bounded single-flight local autosave. A server-selected strong validator is host-owned compare-and-swap evidence and advances only on validated durable success. Lifecycle observation reports only real externally visible transitions; construction and no-op operations emit nothing. Alternative rejected: treating a local content digest as durable server concurrency authority or allowing polling/subscriber growth to become persistence control.

### ADR-0005 Revision-scoped review evidence

Selections and document transitions are bound to exact revisions while ordinary evidence omits document bodies. Alternative rejected: copying selected/document text into every evidence object or reusing structural coordinates across revisions without explicit re-anchoring.

### ADR-0006 SSR/native form client-controlled boundary

Optional native form serialization is escaped SSR/hydration data and synchronously mirrors editor transactions, but submitted values remain untrusted client input. Alternative rejected: treating hidden fields as authorization, integrity or CSRF evidence.

### ADR-0007 Provider-neutral collaboration ownership

Inkspan exposes collaboration adapters without owning provider transport, tenant authorization, identity, durable collaboration storage or audit. Alternative rejected: coupling the package to one provider or application database.

### ADR-0008 Release evidence and independent governance

Exact-head CI/security/package/provenance evidence, formal independent review where required, and fail-closed release-asset verification are separate authorities. Comments, statuses and predecessor evidence do not become formal approval. Alternative rejected: publication or merge from stale/ambiguous evidence.

## ADR quality requirements

Material follow-up ADRs must record context, alternatives, decision, consequences, security/privacy impact, failure/recovery, acceptance tests, migration/rollback and supersession conditions. Detailed standalone ADR files should replace these summaries as decisions evolve; the index remains authoritative for status and discovery.
