# ADR 0009: Naruon modular composition without product coupling

Status: Proposed

## Context

CWL hosts need to compose Inkspan through naruon `compose` / `ui.panel` surfaces while standalone adopters must not acquire a naruon or contextual-orchestrator dependency. SSR, autosave, collaboration, model use, and durable storage also have distinct authority boundaries that must not collapse inside a panel component.

## Decision

Naruon integration is additive and host-owned. A naruon host mounts Inkspan through a narrow client boundary, passes only serializable non-secret configuration, owns authenticated API calls and strong durable validators, owns Yjs provider lifecycle, and optionally routes model assistance through contextual-orchestrator under host policy. Inkspan retains deterministic editor/conversion/evidence authority and does not import host control-plane authority.

## Consequences

Inkspan remains independently usable and testable, while CWL products can share composition conventions. Cross-document remount identity, accessible conflict/recovery UX, and server-selected validators are explicit host responsibilities. Shared platform defects are fixed in their owning repository rather than duplicated in Inkspan.

## Failure and recovery

A host must issue a fresh editing-context identity when switching authorized documents so local queue/editor state cannot bleed across documents. Provider or model outages are host-degraded modes. A central `.github`, naruon, or contextual-orchestrator defect is treated as a read-only dependency; Inkspan continues independent work rather than weakening local safety gates.

## Verification

Use `ARCHITECTURE.md`, `docs/naruon-compose-ui-panel.md`, architecture documentation tests, SSR/client-boundary tests, autosave validator/recovery tests, host-provider lifecycle tests, and packed standalone consumers proving no required naruon/contextual-orchestrator dependency.

## Rollback or supersession

Rollback detaches the naruon adapter/guide while preserving standalone Inkspan APIs and host data. Supersession requires an explicit versioned host composition contract, compatibility/migration evidence, and preserved standalone operation.
