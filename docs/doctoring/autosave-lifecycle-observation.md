# Autosave lifecycle observation doctoring

## Decision

Inkspan exposes one optional construction-time `onSnapshotChange` callback on the framework-free document autosave queue and durable autosave session. The callback is intentionally bounded: one callback is retained, construction does not emit, only distinct externally visible snapshots are delivered, and callback exceptions are ignored so UI or telemetry code cannot alter persistence ordering.

The observer is a local coordination surface, not transport or persistence. Inkspan continues to own deterministic editor/conversion behavior and local autosave ordering. Hosts continue to own authorization, tenant isolation, network transport, credentials, durable storage, migration, retention, retry budgets, audit retention, and model-use policy.

## Evidence boundary

Each delivered queue snapshot is frozen and contains only lifecycle state, blocked reason, active/pending revision equality tags, and the last locally acknowledged saved revision tag. Durable-session snapshots additionally contain the current server-issued strong entity tag. Document bodies, callback results, credentials, tenant identifiers, transport errors, and server responses are not included.

Revision and durable entity tags are tenant-confidential equality metadata. Hosts must not place them in public URLs, unauthenticated logs, high-cardinality public metric labels, analytics dimensions, or cross-tenant telemetry. The callback is suitable for in-process UI state and bounded local observability; shareable evidence requires the host's normal authorization and redaction policy.

## Concurrency and failure semantics

The observer never becomes a second save path. The underlying queue remains single-flight, retains at most one active and one pending revision, and keeps conflict/failure recovery explicit. Observer exceptions are swallowed after the current snapshot identity is recorded, so a failing observer cannot cause duplicate notification loops or roll back persistence state.

Durable-session notifications are emitted only after the queue state and server validator are coherent. A successful durable save advances the server-issued entity tag before the saved/idle notification is observed. Conflict or ambiguous save failure never advances that durable validator. This preserves the same optimistic-concurrency boundary used by the host's atomic `If-Match` operation.

RFC 9110 requires strong comparison for `If-Match` and describes its use in state-changing requests to prevent lost updates. Inkspan therefore treats the durable server validator as host-owned concurrency evidence rather than substituting a local content digest. The lifecycle callback does not weaken that requirement.

## Accessibility boundary

The callback provides machine state, not user-facing copy. Hosts are responsible for translating `saving`, `blocked`, recovery, and completion states into localized accessible UI. When a host surfaces non-focus-changing save or error status in a web UI, WCAG 2.2 Success Criterion 4.1.3 requires status messages to be programmatically determinable so assistive technologies can present them without moving focus. Inkspan deliberately does not prescribe ARIA wording because that belongs to the embedding application's interaction and localization layer.

WCAG 2.2 was approved as ISO/IEC 40500:2025. Hosts targeting conformant web experiences should apply the current WCAG 2.2 status-message requirement to any visible or assistive autosave announcement derived from this observer.

## Test and release evidence

The regression contract proves that:

- no notification occurs during construction;
- saving, pending, blocked/conflict, resumed, idle, and closed states are observable without polling;
- snapshots are frozen and document-free;
- one observer throwing does not change save outcomes or queue progression; and
- durable-session notification exposes the newly committed server validator in the same post-save lifecycle transition.

Repository release evidence remains authoritative only when exact-head type checking, 100% production statement/branch/function/line coverage, package-consumer verification, security checks, review, independent approval, and branch protection all pass. Local or predecessor-head evidence is diagnostic only.

## Rollback

Rollback is source-only: remove the optional observer fields and wrapper notifications while retaining `getSnapshot()`, queue ordering, durable-validator handoff, and host-owned persistence. No data migration or storage rollback is required because this surface stores no durable state and introduces no database object.

## References

Fielding, R., Nottingham, M., & Reschke, J. (Eds.). (2022). *HTTP semantics* (RFC 9110; STD 97). Internet Engineering Task Force. https://doi.org/10.17487/RFC9110

Kung, H. T., & Robinson, J. T. (1981). On optimistic methods for concurrency control. *ACM Transactions on Database Systems, 6*(2), 213–226. https://doi.org/10.1145/319566.319567

World Wide Web Consortium. (2024). *Web Content Accessibility Guidelines (WCAG) 2.2*. https://www.w3.org/TR/WCAG22/

World Wide Web Consortium. (2026, February 11). *Understanding WCAG 2.2*. https://www.w3.org/WAI/WCAG22/Understanding/
