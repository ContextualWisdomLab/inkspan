# ADR 0032: Provider-neutral revision-scoped review contract

- Status: Proposed
- Date: 2026-08-20
- Scope: Inkspan JavaScript package and editor integration

## Context

Reviewers need inline targets, threads, and suggestions while hosts retain
identity, authorization, durable comments, collaboration, and persistence.
W3C text-position selectors provide interoperable range semantics but are
fragile when the underlying revision changes. Commercial editor products expose
review panels and individually accept/rejectable changes, but their hosted
services are outside Inkspan's provider-neutral boundary.

## Alternatives considered

1. Add a database-backed annotation and comments service to Inkspan.
2. Depend on a vendor comments or track-changes extension as the public model.
3. Expose a bounded revision-scoped contract and a controlled React adapter,
   leaving durable records and provider integration to the host.

## Decision

Choose alternative 3. Version the core as
`https://inkspan.io/schemas/review/v1`. Validate immutable revision, selector,
projection, bounded IDs/counts/text, and insert/delete shape. Accept and reject
are exact-once local operations: accept must change the document, reject must
not, and an expected-revision mismatch returns `stale` without re-anchoring.
Return only revision and transition evidence; never return comment or document
bodies from the operation-result contract.

## Consequences

Inkspan gains a reusable React-free package surface and a deterministic editor
integration seam. Hosts supply thread/suggestion metadata, authorization,
durable storage, callbacks, notification policy, collaboration lifecycle,
audit, and cross-revision re-anchoring. The active review package must remain
usable without React, TipTap view, Yjs, network, credentials, or a database.

## Failure and recovery

Malformed or unsupported metadata fails closed with redacted error codes. A
stale revision returns a stale result so the host can refetch and decide what to
show. An invalid accept/reject revision transition is an error; the editor must
not mutate the document or mark the host record final. Undo/redo is delegated to
the editor transaction history after a successful local operation.

## Security and privacy impact

The contract bounds hostile input and rejects accessors/exotic objects. It does
not authorize an actor, tenant, thread, or suggestion. It carries no comment
body, selected quote, credential, network handle, or durable audit claim.

## Compatibility and migration

The `v1` schema and projection identity are explicit. Unknown review schema or
projection versions fail closed. Hosts own storage migrations and may retain
older records, but migrated values must pass the current validator before the
editor displays or operates on them.

## Verification

The active branch must provide core 100% statement/branch/function/line
coverage, strict TSDoc, packed ESM/CommonJS/TypeScript consumers, React editor
integration tests, keyboard and assistive metadata tests, Chromium/Firefox/
WebKit interaction coverage, print-state coverage, and a rendered Storybook or
equivalent state fixture. Review/check evidence must be bound to the exact
current head before merge; active-PR evidence is not shipped behavior.

## Rollback or supersession

Before protected merge, delete or revise the active package surface and its
documentation if the acceptance contract changes. After acceptance, supersede
this ADR with a versioned decision before changing selector, lifecycle, or
ownership semantics. A host may disable the optional review UI without changing
the document-envelope or text-position contracts.

## References

World Wide Web Consortium. (2017, February 23). *Web Annotation Data Model*.
https://www.w3.org/TR/annotation-model/

CKSource. (n.d.). *Track changes overview*. CKEditor 5 documentation. Retrieved
August 20, 2026, from
https://ckeditor.com/docs/ckeditor5/latest/features/collaboration/track-changes/track-changes.html
