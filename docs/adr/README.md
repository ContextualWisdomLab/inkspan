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
| [0011](0011-deterministic-vs-model-assisted-authoring.md) | Proposed | Deterministic conversion versus model-assisted authoring |
| [0012](0012-spreadsheet-formula-injection.md) | Proposed | Spreadsheet formula-injection handling |
| [0013](0013-atomic-file-publication.md) | Proposed | Atomic file publication and explicit overwrite semantics |
| [0014](0014-local-assets-font-licensing.md) | Proposed | Local assets and font-licensing boundary |
| [0015](0015-envelope-schema-migration-routing.md) | Accepted | Envelope schema identity and host-owned migration routing |
| [0016](0016-cross-engine-browser-assurance.md) | Accepted | Cross-engine browser-semantic release assurance |
| [0017](0017-security-disclosure-lifecycle.md) | Accepted | Security disclosure lifecycle and coordinated vulnerability handling |
| [0018](0018-revision-scoped-w3c-text-position-selector.md) | Accepted | Revision-scoped W3C text-position selector authority |
| [0019](0019-unified-release-version-train.md) | Proposed | Unified stable npm and Office registry release version train |

## Decision discipline

- **Proposed**: documented decision whose acceptance evidence is incomplete or whose governing implementation/operational boundary is still being validated; not protected-main implementation authority by status alone.
- **Accepted**: decision has protected-main implementation or process authority with the applicable verification evidence and its canonical ADR status has been reconciled to that authority.
- **Superseded**: retained for historical traceability but explicitly replaced by a later ADR.

ADR decision status and implementation maturity are related but distinct. An ADR file may be present on protected `main` while its decision remains Proposed; conversely, an implemented capability can expose stale documentation until the ADR is reconciled. Canonical fitness and traceability records state implementation maturity explicitly, and an ADR cannot promote an unmerged feature to shipped behavior.

When a decision changes materially, add or supersede an ADR rather than silently rewriting history.

## ADR quality requirements

Every material ADR records explicit sections for:

1. context and the problem boundary;
2. materially distinct alternatives considered;
3. the selected decision;
4. consequences and ownership trade-offs;
5. failure and recovery semantics;
6. security and privacy impact;
7. compatibility and migration behavior;
8. verification/acceptance evidence; and
9. rollback or explicit supersession conditions.

Accessibility, operability, research/standards traceability, and release implications are included wherever the decision affects them. Canonical PRD, TRD, Architecture, contracts, UML, data/evidence model, threat model, test strategy, operability, and traceability documents must remain synchronized with Accepted decisions.
