# Inkspan canonical documentation

Status: Protected-main canonical baseline

This directory is the discoverable index for Inkspan's product, technical, security, operability, and architecture records. Protected `main` is the implementation authority. Proposed or active-PR behavior must remain labeled as such until it reaches protected `main` with the required evidence.

## Canonical graph

| Document | Authority |
| --- | --- |
| [`../ARCHITECTURE.md`](../ARCHITECTURE.md) | Current protected-main implementation architecture and bounded-context ownership |
| [`../SECURITY.md`](../SECURITY.md) | Protected-main private vulnerability reporting, supported security lines, coordinated disclosure, and claim limits |
| [`DOCUMENTATION_FITNESS.md`](DOCUMENTATION_FITNESS.md) | Acquisition completeness matrix, implementation maturity, deliberate non-applicability and remaining canonical gaps |
| [`PRD.md`](PRD.md) | Product users, jobs, buyer outcomes, non-goals, acceptance and claim boundaries |
| [`TRD.md`](TRD.md) | Technical invariants, runtime boundaries, failure semantics and release evidence |
| [`CONTRACTS.md`](CONTRACTS.md) | Public package/API/event/schema/plugin/collaboration and host-integration contracts |
| [`UML.md`](UML.md) | Component, sequence, state and authority-flow diagrams |
| [`DATA_MODEL.md`](DATA_MODEL.md) | Conceptual evidence/domain model and persistence ownership |
| [`THREAT_MODEL.md`](THREAT_MODEL.md) | Trust boundaries, abuse cases, security/privacy controls and residual risks |
| [`TEST_STRATEGY.md`](TEST_STRATEGY.md) | Unit/integration/browser/Office/security/accessibility/package evidence strategy |
| [`OPERABILITY.md`](OPERABILITY.md) | Failure handling, recovery, incident ownership, rollback and release operations |
| [`TRACEABILITY.md`](TRACEABILITY.md) | Requirements/standards/research-to-decision/test evidence traceability |
| [`adr/README.md`](adr/README.md) | Status-bearing architectural decision index, including ADR 0017 for the protected security-disclosure lifecycle |

Root `SECURITY.md` is now implemented on protected `main` and remains the normative reporting/disclosure policy. ADR 0017 records the durable architecture/process decision and ownership/claim boundaries without duplicating policy prose. `CHANGELOG.md` records shipped/reviewable change history, while `AGENTS.md` and `CLAUDE.md` point contributors back to this canonical graph rather than becoming parallel architecture specifications.

## Status discipline

Use these terms consistently:

- **Implemented on protected main** — code and behavior exist on the current protected branch and have applicable acceptance evidence.
- **Active PR / Proposed** — reviewable work exists but is not shipped authority.
- **Accepted architecture** — a durable decision is approved by the governing ADR but implementation may still be incomplete.
- **Planned** — bounded future work with no protected implementation claim.
- **Research only** — evidence or alternatives under evaluation, not a product commitment.
- **Superseded** — retained only for history; a newer decision or implementation is authoritative.
- **Out of scope** — deliberately excluded from Inkspan ownership.

The exact machine-oriented documentation-fitness and implementation-maturity vocabulary is defined in [`DOCUMENTATION_FITNESS.md`](DOCUMENTATION_FITNESS.md). Human-facing labels above must map to those states without combining evidence qualifiers, PR numbers, or temporary execution status into the status value itself.

Never use a PR body, check status, model verdict, local test, or conversation as a substitute for protected-main implementation authority.

## Ownership boundary

Inkspan owns deterministic editor/conversion behavior, versioned document/evidence contracts, local autosave coordination, accessibility metadata, package behavior, and provider-neutral adapters. The embedding host owns authenticated transport, authorization, tenant isolation, durable persistence, credentials, migration execution, retention, deployment, durable audit, collaboration-provider authority, and model-use policy unless a future accepted versioned contract explicitly changes that division.

## Change discipline

A material contract change should update the smallest affected set of PRD/TRD/CONTRACTS/Architecture/ADR/UML/data-model/security/test/operability/traceability records and corresponding machine-checkable documentation contracts. If a document is unaffected, preserve it rather than performing churn solely for consistency optics.

Stable architectural documents should avoid embedding transient PR heads, workflow run IDs, or temporary provider states. Put dated operational evidence in bounded doctoring/evidence records instead.
