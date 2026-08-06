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
   recovery; and
5. B cannot start until recovery, while no accessible recovery workflow is
   opened and the UI may continue to report an ordinary saving state.

A related path existed for operational failures. A callback exception, abort,
timeout, or malformed result rejects the active `enqueue()` promise and blocks
the same queue with reason `failure`. The example displayed a generic action
message but did not actually invoke a host recovery workflow, so pending newer
work could remain blocked indefinitely.

A generation guard is appropriate for superseded local presentation work. It is
not authority to discard a queue-wide blocking outcome whose recovery is needed
by newer retained work. A status message alone is not a recovery mechanism.

## Decision

Use two generation guards with separate responsibilities and one reason-aware
recovery boundary.

The first guard remains between digest completion and enqueue. It rejects a stale
capture before that document can enter the durable queue.

The invariant is: blocking outcomes before stale-generation status suppression.
A conflict therefore opens one host-owned recovery workflow even when the request
that first observed it belongs to an older generation. Only non-blocking saved,
unchanged, superseded, or closed presentation updates are suppressed when their
generation is stale.

If `enqueue()` rejects, the example reads the document-free queue snapshot. When
that snapshot is blocked and supplies a stable `blockedReason`, the host callback
failure and a durable conflict both request recovery through the same bounded
interface. The host receives only `conflict` or `failure`; it does not receive
the document, validator, callback value, or private exception.

The panel keeps one local `durableRecoveryPending` ref and issues one
single-flight recovery request for one blocked session. Multiple callers may
share the active queue outcome, so this ref prevents duplicate dialogs or
competing authenticated reloads without becoming persistence, authorization, or
a durable lock.

For `conflict`, the host may compare, merge, fork, discard, or perform an
authenticated reload. For `failure`, the host must first determine whether an
ambiguous write committed and obtain the authoritative current representation
and server-selected strong `ETag`; it must not blindly retry the failed evidence.

The recovery callback calls `session.resume(recoveredStrongEntityTag)`. Inkspan
validates the strong entity tag and installs it before retained work starts. A
malformed validator fails closed, preserves the previous durable base, and
returns a generic recovery status without exposing the supplied value or private
exception.

Operational callback failures are handled from the document-free session
snapshot. If the queue is blocked, the host recovery action remains active even
when an older edit generation observed the failure. The ordering invariant is
therefore queue-wide rather than generation-local.

## Ownership boundary

Inkspan continues to own only deterministic document evidence, the local
single-flight queue, stable blocked-reason metadata, strong-tag syntax
validation, and durable-validator handoff. The host continues to own:

- authentication, authorization, and tenant isolation;
- atomic `If-Match` enforcement and persistence;
- request deadlines, cancellation, idempotency, and retry policy;
- accessible compare, merge, fork, discard, verify, and reload workflows;
- determination of whether an ambiguous write committed;
- selection of the recovered server validator; and
- private transport and incident telemetry.

The local pending flag and blocked reason are not tenant identifiers, audit
records, distributed locks, or proof that durable recovery succeeded. The host
callback returning `true` means only that the current local session accepted the
validated recovery transition.

## Security and privacy consequences

The repair prevents a newer keystroke from hiding a durable conflict that still
blocks newer work. It also prevents an operational save failure from leaving
retained work blocked behind a message that offers no callable recovery path.
Several shared callers cannot open parallel recovery workflows for the same
blocked session.

Generic status text contains no document body, server validator, callback value,
tenant metadata, credential, or private exception. The panel never retries an
ambiguous write automatically. A recovered validator must come from an
authenticated durable reload or equivalent confirmed host decision.

## Accessibility consequences

A blocked queue remains represented by one accessible recovery surface until the
supplied recovery callback succeeds or the host deliberately abandons the
editing context. New local edits must not dismiss, duplicate, or obscure that
surface. The host remains responsible for focus movement, keyboard operation,
labelling, reason-appropriate actions, and restoration to the editor after
resolution.

## Test-first evidence

Commit `43a211b0818636016e2e80d9ceaaad5ab7af1fd7` added the original ordering
and single-flight conflict contract before the guide implemented it.
Pull-request workflow run `31065769175` produced the intended red result: the
new documentation test failed while 549 other JavaScript tests and both Office
Python package jobs passed. That workflow checked GitHub's synthetic pull-request
merge ref, so it is historical TDD evidence rather than exact-head acceptance
evidence.

Commit `984a35b3dfb140b8f1099e0413f80fc4d1103e9b` extended the red contract to
require this doctoring record and `CHANGELOG.md` evidence. Commit
`bdfb75179f42cb10217803248685bc4e79578d05` then changed the fenced integration
example so a conflict is handled before the second generation guard and the host
recovery request is single-flight.

Commit `f6cdcf4c5879c4c1661731590d9295fb61485205` added the reason-aware
operational-recovery contract before the guide implemented it. The contract
requires the public `DocumentAutosaveBlockedReason`, one shared recovery guard,
conflict recovery before stale status suppression, and a catch path that invokes
host recovery from a blocked snapshot rather than merely changing text.

Commit `dd8edbe8e4b8953ed5ef91fe864c052879b79b07` then implemented the
reason-aware host boundary. The final integrated head must still pass
repository-wide TypeScript, 100% production statement/branch/function/line
coverage, package consumers, Office, security, SAST, review, and
branch-protection gates. Red runs and commits are historical TDD evidence and are
not merge evidence.

## Rejected alternatives

### Keep the second generation guard before conflict handling

Rejected because a stale active request can be the request that transitions the
whole queue into a blocked state while newer work remains pending.

### Display an operational error without invoking recovery

Rejected because the queue remains blocked and newer retained work cannot start.
A visible message that has no associated host recovery workflow is not actionable
reliability behavior.

### Resume automatically with the previous validator

Rejected because the previous validator may have been rejected or may no longer
describe durable state. Automatic retry would violate authenticated conflict and
ambiguous-write boundaries.

### Open one recovery workflow per enqueue caller

Rejected because active or pending revisions can share outcomes. Parallel
recovery workflows can race to install different durable bases and present
inconsistent user decisions.

### Bind recovery to the generation that observed the block

Rejected because both conflict and failure block the queue, not only one visual
generation. Recovery must remain available to unblock retained newer work.

### Expose the original callback error to select recovery behavior

Rejected because transport exceptions can contain URLs, headers, tenant data,
provider details, or other private material. The stable document-free blocked
reason is sufficient for control flow.

## Rollback

Rollback restores the prior example and removes the expanded documentation
contract. Such a rollback also restores the known risks that a newer edit can
hide a queue-wide conflict and an operational failure can block retained work
without invoking recovery. A production host should not adopt that rollback
unless it already provides an independently verified equivalent recovery
coordinator.

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
