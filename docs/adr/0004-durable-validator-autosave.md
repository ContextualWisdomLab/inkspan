# ADR 0004: Strong durable validator and bounded autosave

Status: Proposed

## Context

Local editor revisions are useful equality evidence but cannot prove a durable server write. Autosave also must avoid concurrent duplicate writes, unbounded queued work, silent conflict recovery, and telemetry callbacks that alter persistence behavior.

## Decision

Use a single-flight autosave queue with bounded active/pending work and explicit `idle`, `saving`, `blocked`, `closing`, and `closed` lifecycle state. A durable session accepts and advances only host/server-selected strong HTTP entity tags for compare-and-swap. Conflict or ambiguous save failure blocks progression until explicit recovery. Optional lifecycle observation emits only distinct document-free transitions; construction and no-op operations emit nothing, and observer exceptions are isolated.

## Consequences

Inkspan can coordinate deterministic local ordering while the host remains the only durable authority. Hosts must implement atomic `If-Match` semantics, authorization, retry policy, and durable reconciliation. UI can observe bounded machine state without polling or receiving document bodies.

## Failure and recovery

Malformed or weak validators fail closed. Conflict preserves durable uncertainty and requires authenticated host recovery. Ambiguous transport failure never advances the validator. Recovery with no pending work may return to idle; unsuccessful/no-op recovery does not synthesize an observer event. Closing waits only for bounded retained work.

## Verification

Queue/session state-machine tests, no-op observation regressions, callback-failure isolation, validator grammar tests, concurrency/flush/close regressions, packed ESM/CommonJS/strict-TypeScript consumers, and exact-head coverage/security gates verify the contract.

## Rollback or supersession

Rollback removes optional lifecycle observation or durable-session convenience while preserving explicit `getSnapshot()`, local queue ordering, and host-owned durable writes. Supersession requires an equally bounded concurrency model, exact validator semantics, migration/rollback, and fresh package-consumer evidence.
