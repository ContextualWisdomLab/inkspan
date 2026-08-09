# ADR 0002: Canonical document and revision authority

Status: Proposed

## Context

Inkspan needs deterministic document persistence/export and local equality evidence without turning a content digest into authorization, identity, or durable concurrency authority.

## Alternatives considered

- Use editor-local JSON or rendered HTML directly as durable identity. Rejected because semantically equivalent values can serialize differently and because rendered output is not the canonical source authority.
- Treat a SHA-256 content digest as the durable concurrency token. Rejected because a client-derived digest does not prove the server's current durable representation or authorization state.
- Use a versioned canonical envelope for local equality and a host/server-selected validator for durable concurrency. Selected because it separates deterministic content identity from durable authority.

## Decision

A versioned validated `document_envelope` is the canonical document value. Strict JSON/UTF-8 handling and bounded validation precede canonicalization. SHA-256 revision evidence is derived from the exact canonical envelope and is equality evidence only. Durable compare-and-swap uses a host/server-selected strong validator under RFC 9110 semantics.

## Consequences

Local restore, transition, and selection evidence can bind to exact content without copying document bodies. Hosts must maintain their own durable version, actor, authorization, audit, migration, and retention semantics. Unsupported envelope versions remain explicit migration routes rather than permissive parsing.

## Failure and recovery

Malformed, ambiguous, over-limit, unsupported, or hostile envelope input fails closed with bounded diagnostics. If local state moves during asynchronous evidence capture, the operation returns no stale claim. Durable ambiguity is reconciled by the host; a local digest never advances durable state.

## Security and privacy impact

Canonicalization and revision derivation operate without granting network, tenant, credential, or persistence authority. Revision values can still be tenant-confidential correlation metadata, so they must not be exposed as public high-cardinality telemetry or treated as bearer capabilities. Ordinary evidence avoids duplicating complete document bodies.

## Compatibility and migration

Envelope schema identifiers and versions are explicit compatibility boundaries. Existing revision values must remain stable for the same accepted canonical contract. Unsupported legacy/future versions route through host-owned migration rather than being interpreted by the current parser. Any canonicalization or digest change requires a new versioned contract, compatibility fixtures, migration guidance, and rollback evidence.

## Verification

Envelope parsing/canonicalization/UTF-8/resource-limit regressions, revision/transition/selection tests, packed consumer tests, and RFC 9110/JCS documentation must remain coherent.

## Rollback or supersession

A future algorithm/schema change adds a versioned contract and migration path. It must not silently redefine existing revision values. Supersession requires compatibility tests, rollback, and updated traceability.
