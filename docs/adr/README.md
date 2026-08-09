# Inkspan Architecture Decision Records

Status values: Proposed, Accepted, Superseded.

This index records durable architectural decisions. Protected-main implementation is required before a feature-specific decision may be treated as shipped behavior. Detailed ADR files are authoritative for their decision; this index is authoritative for discovery and status.

| ADR | Status | Decision |
|---|---|---|
| [0001](0001-product-host-authority.md) | Proposed | Product and host authority boundary |
| [0002](0002-document-revision-authority.md) | Proposed | Canonical document and revision authority |
| [0003](0003-safe-rich-clipboard.md) | Proposed | Safe rich clipboard boundary |
| [0004](0004-durable-validator-autosave.md) | Proposed | Strong durable validator and bounded autosave |
| [0005](0005-revision-scoped-review-evidence.md) | Proposed | Revision-scoped review evidence |
| [0006](0006-ssr-native-form-boundary.md) | Proposed | SSR/native form client-controlled boundary |
| [0007](0007-provider-neutral-collaboration.md) | Proposed | Provider-neutral collaboration and host ownership |
| [0008](0008-deterministic-office-rendering.md) | Proposed | Deterministic Office rendering boundary |
| [0009](0009-naruon-modular-composition.md) | Proposed | Naruon modular composition without product coupling |
| [0010](0010-release-evidence-authority.md) | Proposed | Release evidence authority |

## Decision discipline

- **Proposed**: documented or implemented on an unmerged branch; not protected-main authority.
- **Accepted**: integrated into protected `main` with the applicable verification evidence.
- **Superseded**: retained for historical traceability but explicitly replaced by a later ADR.

An ADR cannot promote an unmerged feature to shipped behavior. When a decision changes materially, add or supersede an ADR rather than silently rewriting history.

## ADR quality requirements

Every material ADR records:

1. context and the problem boundary;
2. the selected decision and rejected authority expansion or alternative where material;
3. consequences and ownership trade-offs;
4. failure and recovery semantics;
5. verification/acceptance evidence; and
6. rollback or explicit supersession conditions.

Security/privacy, compatibility, migration, accessibility, operability, and release implications belong in those sections when relevant. Canonical PRD, TRD, Architecture, UML, data/evidence model, threat model, test strategy, operability, and traceability documents must remain synchronized with Accepted decisions.
