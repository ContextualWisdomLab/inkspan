# Inkspan Technical Requirements

Status: Proposed canonical baseline

## Runtime boundary

Inkspan owns deterministic editor, conversion and local coordination code. Hosts own network transport, authentication/authorization, tenant isolation, durable persistence, credentials, migrations, retention, durable audit storage, deployment and model-use policy.

## Document identity

A versioned document envelope is validated before canonicalization or hashing. SHA-256 revision evidence identifies exact canonical content. Local content digests do not replace server-selected RFC 9110 strong validators for durable compare-and-swap.

## Clipboard boundary

Rich clipboard HTML is untrusted. Sanitization must be installed in the actual TipTap v2/ProseMirror paste pipeline, use bounded fail-closed validation, avoid external fetch or active execution, and preserve only supported semantic content. Pure sanitizer APIs and editor integration must remain behaviorally consistent.

## SSR and native forms

Server rendering must not instantiate an editor view. When a native field is explicitly enabled, SSR/hydration serializes the selected controlled value as escaped input data. The value is client-controlled submission data, never authorization, CSRF protection, signature or durable-write evidence.

## Revision-scoped evidence

Selection evidence captures selection coordinates and revision from the same immutable editor state before asynchronous hashing. Transition evidence validates previous and resulting envelopes before sequential revision derivation and contains revision metadata rather than document bodies.

## Autosave state machine

States are `idle`, `saving`, `blocked`, `closing`, and `closed`, with explicit blocked reasons. The queue retains bounded active/pending work and exposes immutable document-free snapshots. Durable sessions carry a host-owned strong validator that advances only after a validated saved result.

Lifecycle observers are optional and bounded to one construction-time callback. They receive only distinct externally visible state snapshots. Construction emits nothing. A method call that produces no externally visible state transition, including `resume()` returning false, emits nothing. Observer exceptions are isolated from persistence behavior.

## Collaboration

Collaboration bindings are provider-neutral. Inkspan may adapt editor state to Yjs-compatible surfaces, but provider lifecycle, identity, awareness privacy, tenant authorization, persistence and durable audit remain host responsibilities.

## Failure semantics

Public failures are bounded and redacted. Host callback exceptions, malformed callback results, hostile reflection/accessors, invalid envelopes, invalid UTF-8 and unsafe clipboard input must not leak private values or silently succeed. Cancellation and host-owned transport policy remain explicit.

## Accessibility

Shipped keyboard behavior and programmatic shortcut metadata must agree. Host-visible save/conflict state must be sufficient for accessible application messaging without prescribing localized wording.

## Packaging and compatibility

The root package and framework-independent subpaths must remain consumable from packed ESM/CommonJS and strict TypeScript environments without accidental React/DOM/framework dependencies where the subpath contract excludes them. Office artifacts follow their separately versioned package contract.

## Evidence and governance

Check runs, commit statuses, automated model verdicts, formal reviews and merge authority are distinct evidence classes. Exact-head evidence does not transfer after source movement. Comments or textual approvals are not formal approval. Release publication must fail closed on ambiguous/stale artifact inventory or digest mismatch.

## Implemented versus planned

Protected `main` is the sole implemented baseline. Open PRs are Active/Proposed evidence only until protected merge. Documentation must not convert an unmerged feature into an Accepted shipped claim.
