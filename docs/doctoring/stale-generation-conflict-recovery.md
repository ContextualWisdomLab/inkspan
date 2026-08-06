# Doctoring record: stale-generation conflict recovery

- **Status:** Accepted
- **Decision date:** 2026-08-06
- **Scope:** Naruon `compose` / `ui.panel` durable autosave example
- **Runtime change:** None; this record corrects the host integration contract

## Problem

The documented panel protected asynchronous document capture with a monotonically
increasing edit generation. That guard correctly prevented an older, slower
revision digest from being enqueued after a newer edit, but the same guard was
also applied immediately after the autosave queue settled.

That ordering created a blocked-but-unreported conflict path:

1. edit generation A is captured, enqueued, and becomes the active host save;
2. generation B arrives while A is active, increments the generation, and is
   retained as pending work;
3. A receives `412 Precondition Failed`, so the single-flight queue enters its
   blocked conflict state while B remains retained;
4. the old example observes that A is stale and returns before requesting host
   conflict recovery; and
5. B cannot start until recovery, while no accessible recovery workflow is
   opened and the UI may continue to report an ordinary saving state.

A generation guard is appropriate for superseded local presentation work. It is
not authority to discard a queue-wide blocking outcome whose recovery is needed
by newer retained work.

## Decision

Use two guards with separate responsibilities.

The first guard remains between digest completion and enqueue. It rejects a stale
capture before that document can enter the durable queue.

The invariant is: blocking outcomes before stale-generation status suppression.
A conflict therefore opens one host-owned recovery workflow even when the request
that first observed it belongs to an older generation. Only non-blocking saved,
unchanged, superseded, or closed presentation updates are suppressed when their
generation is stale.

The panel keeps one local `conflictRecoveryPending` ref and issues one
single-flight recovery request for one blocked session. Multiple callers may
share the active queue outcome, so this ref prevents duplicate dialogs or
competing authenticated reloads without becoming persistence, authorization, or
a durable lock.

The recovery callback calls `session.resume(recoveredStrongEntityTag)`. Inkspan
validates the strong entity tag and installs it before retained work starts. A
malformed validator fails closed, preserves the previous durable base, and
returns a generic recovery status without exposing the supplied value or private
exception.

Operational callback failures are handled from the document-free session
snapshot. If the queue is blocked, the host recovery action remains visible even
when an older edit generation observed the failure. The ordering invariant is
therefore queue-wide rather than generation-local.

## Ownership boundary

Inkspan continues to own only deterministic document evidence, the local
single-flight queue, strong-tag syntax validation, and durable-validator handoff.
The host continues to own:

- authentication, authorization, and tenant isolation;
- atomic `If-Match` enforcement and persistence;
- request deadlines, cancellation, idempotency, and retry policy;
- accessible compare, merge, fork, discard, and reload workflows;
- selection of the recovered server validator; and
- private transport and incident telemetry.

The local pending flag is not a tenant identifier, audit record, distributed
lock, or proof that durable recovery succeeded. The host callback returning
`true` means only that the current local session accepted the validated recovery
transition.

## Security and privacy consequences

The repair prevents a newer keystroke from hiding a durable conflict that still
blocks newer work. It also prevents several shared callers from opening parallel
recovery workflows for the same blocked session.

Generic status text contains no document body, server validator, callback value,
tenant metadata, credential, or private exception. The panel never retries an
ambiguous write automatically. A recovered validator must come from an
authenticated durable reload or equivalent confirmed host decision.

## Accessibility consequences

A durable conflict remains represented by one accessible recovery surface until
the supplied recovery callback succeeds or the host deliberately abandons the
editing context. New local edits must not dismiss, duplicate, or obscure that
surface. The host remains responsible for focus movement, keyboard operation,
labelling, and restoration to the editor after resolution.

## Test-first evidence

Commit `43a211b0818636016e2e80d9ceaaad5ab7af1fd7` added the ordering and
single-flight recovery contract before the guide implemented it. Pull-request
workflow run `31065769175` produced the intended red result: the new documentation
test failed while 549 other JavaScript tests and both Office Python package jobs
passed. That workflow checked GitHub's synthetic pull-request merge ref, so it is
historical TDD evidence rather than exact-head acceptance evidence.

Commit `984a35b3dfb140b8f1099e0413f80fc4d1103e9b` extended the red contract to
require this doctoring record and `CHANGELOG.md` evidence. Commit
`bdfb75179f42cb10217803248685bc4e79578d05` then changed the fenced integration
example so a conflict is handled before the second generation guard and the
host recovery request is single-flight.

The final integrated head must still pass repository-wide TypeScript, 100%
production statement/branch/function/line coverage, package consumers, Office,
security, SAST, review, and branch-protection gates. The red run is historical
TDD evidence and is not merge evidence.

## Rejected alternatives

### Keep the second generation guard before conflict handling

Rejected because a stale active request can be the request that transitions the
whole queue into a blocked state while newer work remains pending.

### Resume automatically with the previous validator

Rejected because the previous validator is precisely the value rejected by the
durable service. Automatic retry would violate the authenticated conflict and
ambiguous-write boundaries.

### Open one recovery workflow per enqueue caller

Rejected because active or pending revisions can share outcomes. Parallel
recovery workflows can race to install different durable bases and present
inconsistent user decisions.

### Bind recovery to the generation that observed the conflict

Rejected because the conflict blocks the queue, not only one visual generation.
Recovery must remain available to unblock retained newer work.

## Rollback

Rollback restores the prior example and removes this record and its documentation
contract. Such a rollback also restores the known risk that a newer edit can hide
a queue-wide conflict. A production host should not adopt that rollback unless it
already provides an independently verified equivalent recovery coordinator.

No package version, runtime dependency, database object, migration, credential,
network client, provider, scheduler, or release publication is introduced by
this documentation repair.

## APA 7 references

Fielding, R., Nottingham, M., & Reschke, J. (2022). *HTTP semantics* (RFC 9110;
STD 97). RFC Editor. https://doi.org/10.17487/RFC9110

Herlihy, M. P., & Wing, J. M. (1990). Linearizability: A correctness condition
for concurrent objects. *ACM Transactions on Programming Languages and Systems,
12*(3), 463–492. https://doi.org/10.1145/78969.78972

Meta Platforms, Inc. (n.d.). *useRef*. React. Retrieved August 6, 2026, from
https://react.dev/reference/react/useRef
