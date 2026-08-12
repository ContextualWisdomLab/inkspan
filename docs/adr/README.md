# Inkspan Architecture Decision Records

Status values: Proposed, Accepted, Superseded.

This index records durable architectural decisions. An ADR on a branch or protected `main` is not shipped behavior by status alone. `Accepted` requires protected-main implementation or process authority plus applicable verification evidence.

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
| [0019](0019-unified-release-version-train.md) | Accepted | Unified stable npm and Office registry release version train |
| [0020](0020-framework-neutral-markdown-package-boundary.md) | Accepted | Framework-neutral deterministic Markdown package boundary |
| [0021](0021-css-paged-media-print-boundary.md) | Accepted | CSS paged-media print boundary |
| [0022](0022-informative-docx-png-figures.md) | Accepted | Informative inline PNG figures in deterministic DOCX output |
| [0023](0023-bounded-docx-rich-text-runs.md) | Accepted | Bounded rich-text runs in deterministic DOCX output |
| [0024](0024-bounded-docx-paragraph-alignment.md) | Accepted | Bounded paragraph alignment in deterministic DOCX output |
| [0025](0025-bounded-docx-heading-alignment.md) | Accepted | Bounded heading alignment in deterministic DOCX output |
| [0026](0026-bounded-docx-external-hyperlinks.md) | Accepted | Bounded external hyperlinks in deterministic DOCX rich text |
| [0027](0027-host-owned-llm-writing-diagnostics.md) | Proposed | Host-owned, revision-bound LLM writing diagnostics |

## Decision discipline

- **Proposed:** the decision is documented, but implementation or operational acceptance evidence is incomplete.
- **Accepted:** protected `main` contains the governing implementation or process and its verification evidence is current.
- **Superseded:** the ADR remains for history but a later ADR replaces it.

Material changes add or supersede an ADR rather than silently rewriting history.

## ADR quality requirements

Every material ADR documents the following evidence explicitly:

- context and the problem boundary;
- materially distinct alternatives considered;
- the selected decision and its consequences;
- failure and recovery semantics;
- security and privacy impact;
- compatibility and migration behavior;
- verification/acceptance evidence;
- rollback or explicit supersession conditions.

Accessibility, operability, standards/research traceability, release impact, and synchronized PRD/TRD/Architecture/contracts/UML/data model/threat model/test strategy are also required where affected.
