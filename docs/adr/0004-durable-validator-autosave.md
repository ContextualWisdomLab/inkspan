# ADR 0004: Strong durable validator and bounded autosave

Status: Proposed

## Context

Local editor revisions are useful equality evidence but cannot prove a durable server write. Autosave also must avoid concurrent duplicate writes, unbounded queued work, silent conflict recovery, and telemetry callbacks that alter persistence behavior.

## Alternatives considered

- Overlapping saves for every local edit: rejected because ordering and retained work become ambiguous.
- A client content digest as the durable validator: rejected because local equality evidence is not durable server authority.
- An unbounded FIFO of every intermediate revision: rejected because memory and write volume grow without a fixed ceiling.
- One active save plus one replaceable pending revision, with explicit blocked recovery and a host/server-selected strong validator: selected.

## Decision

Use a single-flight autosave queue with bounded active/pending work and explicit `idle`, `saving`, `blocked`, `closing`, and `closed` lifecycle state. A durable session accepts and advances only host/server-selected strong HTTP entity tags for compare-and-swap. Conflict or ambiguous save failure blocks progression until explicit recovery. Optional lifecycle observation emits only distinct document-free transitions; construction and no-op operations emit nothing, and observer exceptions are isolated.

`getSnapshot()` is an explicit local coordination API rather than generic diagnostics. Its bounded document-free contract may expose `activeStrongEntityTag`, `pendingStrongEntityTag`, and `lastSavedStrongEntityTag` when those values exist so the host can reason about exact local queue/durable-validator state. These fields remain tenant-confidential equality/concurrency metadata: their presence in an authenticated in-process snapshot does not authorize disclosure, persistence, metrics, logging, or reuse as a public identifier.

## Consequences

Inkspan can coordinate deterministic local ordering while the host remains the only durable authority. Hosts must implement atomic `If-Match` semantics, authorization, retry policy, and durable reconciliation. UI can observe bounded machine state without polling or receiving document bodies. Consumers of `getSnapshot()` must treat validator fields as confidential local state and must not promote them to public telemetry dimensions.

## Failure and recovery

Malformed or weak validators fail closed. Conflict preserves durable uncertainty and requires authenticated host recovery. Ambiguous transport failure never advances the validator. Recovery with no pending work may return to idle; unsuccessful/no-op recovery does not synthesize an observer event. Closing waits only for bounded retained work.

## Security and privacy impact

Autosave coordination does not grant authorization or tenant authority. Strong validators and local revisions can be tenant-confidential equality metadata. The explicit in-process `getSnapshot()` contract may expose only the bounded active/pending/last-saved validator fields required for local coordination, while generic diagnostics, public metrics, unauthenticated logs, lifecycle notifications, and ordinary telemetry remain document-free and must never expose validators, credentials, complete document bodies, or private callback failures. Any durable/shared handling is host-authorized, purpose-bound, and minimum-disclosure.

## Compatibility and migration

The public queue/session states, the three optional validator snapshot fields, validator grammar, and result contracts are compatibility surfaces. Hosts adopting the durable session supply a valid server-selected strong validator, keep durable retry/conflict policy, and classify snapshot validator values as confidential local metadata. Any future lifecycle-state, snapshot-field, or retention change requires compatibility tests, migration guidance, and a rollback that preserves host durable state.

## Verification

Queue/session state-machine tests, active/pending/last-saved snapshot ordering tests, no-op observation regressions, callback-failure isolation, validator grammar tests, concurrency/flush/close regressions, packed ESM/CommonJS/strict-TypeScript consumers, and exact-head coverage/security gates verify the contract. Documentation tests must preserve the distinction between the explicit `getSnapshot()` coordination surface and generic diagnostics/telemetry.

## Rollback or supersession

Rollback removes optional lifecycle observation or durable-session convenience while preserving explicit `getSnapshot()`, local queue ordering, and host-owned durable writes. Removing or renaming validator snapshot fields requires a documented compatibility migration rather than silently changing the privacy contract. Supersession requires an equally bounded concurrency model, exact validator semantics, migration/rollback, and fresh package-consumer evidence.
