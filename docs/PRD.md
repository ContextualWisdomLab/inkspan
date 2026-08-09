# Inkspan Product Requirements

Status: Proposed canonical baseline

## Product

Inkspan is a standalone rich-text authoring package and an embeddable CWL editor/conversion module. It gives hosts deterministic authoring, conversion, revision evidence, safe clipboard handling, SSR/form integration, local autosave coordination, and provider-neutral collaboration bindings without taking ownership of host transport, identity, tenancy, durable persistence, credentials, retention, deployment, or model-use policy.

## Users and buyers

- Application developers embedding an editor into web and SSR applications.
- Enterprise platform teams requiring deterministic conversion, evidence, accessibility, security boundaries, and reproducible packages.
- CWL products such as naruon that compose Inkspan through stable package contracts.
- Operators and acquisition reviewers who need explicit ownership, release, security, and rollback evidence.

## Required outcomes

1. Author Markdown and HTML through a deterministic TipTap/ProseMirror surface.
2. Reject or sanitize unsafe rich clipboard input before it becomes editor state.
3. Produce versioned canonical document envelopes and SHA-256 revision evidence.
4. Bind selections and transitions to exact document revisions without copying document bodies into ordinary evidence metadata.
5. Support SSR-safe hydration and optional native form serialization while treating browser-submitted values as untrusted host input.
6. Coordinate bounded single-flight autosave with explicit conflict/failure recovery and server-selected strong validators.
7. Expose lifecycle observation only for externally visible state changes; construction and no-op operations must not manufacture lifecycle notifications.
8. Provide provider-neutral collaboration bindings while hosts retain collaboration transport, authorization, tenant isolation and durable audit ownership.
9. Preserve accessible keyboard, status and toolbar semantics.
10. Produce reproducible package and release evidence with fail-closed publication checks.

## Non-goals

Inkspan is not an identity provider, tenant database, durable document store, collaboration authorization server, deployment platform, model router, durable audit service, or merge/release authority for host applications.

## Security and privacy requirements

- Untrusted HTML, DOM capabilities, clipboard configuration, form values and host callbacks fail closed at documented boundaries.
- Active or hidden rich content must not bypass the supported semantic clipboard policy.
- Revision/entity tags are equality metadata, not credentials or authorization.
- Document bodies must not enter ordinary lifecycle, selection or transition evidence unless an explicit versioned contract requires them.
- Host applications remain responsible for authentication, authorization, CSRF, tenant isolation, persistence and retention.

## Reliability and concurrency requirements

- Autosave remains single-flight with bounded pending work.
- Conflict and ambiguous failure never silently advance durable validators.
- Observer failures cannot change save ordering or outcomes.
- No-op lifecycle operations must not emit a synthetic initial or duplicate snapshot.
- Async revision/selection capture must bind to one immutable editor state.

## Accessibility requirements

Native controls, focus behavior, shortcut metadata and host-facing lifecycle state must support WCAG-oriented embedding. Machine state is not user-facing wording; localization and application-level live-region policy remain host responsibilities.

## Packaging and release acceptance

A release is acceptable only from an exact integrated protected head with required CI/security checks, exact owned production coverage, package-consumer compatibility, reproducibility/provenance evidence, zero valid unresolved findings, required independent review, rollback guidance and verified release artifacts.

## Current and planned scope

Protected main is the authority for implemented behavior. Open PRs may describe Proposed/Active work but are not shipped contracts until protected integration. Provider-neutral collaboration, autosave, review evidence and release hardening evolve through versioned public contracts rather than hidden host coupling.
