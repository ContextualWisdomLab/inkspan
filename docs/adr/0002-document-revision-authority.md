# ADR 0002: Canonical document and revision authority

Status: Proposed

## Context

Inkspan needs deterministic document persistence/export and local equality evidence without turning a content digest into authorization, identity, or durable concurrency authority.

## Decision

A versioned validated `document_envelope` is the canonical document value. Strict JSON/UTF-8 handling and bounded validation precede canonicalization. SHA-256 revision evidence is derived from the exact canonical envelope and is equality evidence only. Durable compare-and-swap uses a host/server-selected strong validator under RFC 9110 semantics.

## Consequences

Local restore, transition, and selection evidence can bind to exact content without copying document bodies. Hosts must maintain their own durable version, actor, authorization, audit, migration, and retention semantics. Unsupported envelope versions remain explicit migration routes rather than permissive parsing.

## Failure and recovery

Malformed, ambiguous, over-limit, unsupported, or hostile envelope input fails closed with bounded diagnostics. If local state moves during asynchronous evidence capture, the operation returns no stale claim. Durable ambiguity is reconciled by the host; a local digest never advances durable state.

## Verification

Envelope parsing/canonicalization/UTF-8/resource-limit regressions, revision/transition/selection tests, packed consumer tests, and RFC 9110/JCS documentation must remain coherent.

## Rollback or supersession

A future algorithm/schema change adds a versioned contract and migration path. It must not silently redefine existing revision values. Supersession requires compatibility tests, rollback, and updated traceability.
