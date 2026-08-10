# Inkspan Documentation Fitness Matrix

Status: Protected-main canonical baseline

This document answers a narrower acquisition question than the PRD or architecture: **can an independent reviewer reconstruct Inkspan's product, technical, security, data/evidence, operating, package, presentation, and release decisions from GitHub without relying on chat history or pull-request prose?**

The documentation graph is a protected-main canonical baseline. Protected `main` remains the implementation authority. Requirements implemented only on another active branch are not shipped merely because this matrix or an ADR references them.

## Classification vocabulary

Documentation-family fitness uses exactly these values:

- `present_current` — the canonical document exists on the source generation being reviewed and matches the reviewed product boundary.
- `present_stale` — a document exists but conflicts with current implementation or accepted decisions.
- `partial` — useful authoritative material exists, but one or more required decisions or views are not yet covered.
- `missing` — no adequate canonical artifact exists.
- `not_applicable` — omission is deliberate and the reason is explicit.
- `owned_by_separate_active_pr` — another non-overlapping active branch owns the canonical artifact; this branch must reference rather than duplicate it.

Implementation maturity uses exactly these values:

- `implemented_on_protected_main`
- `implemented_on_active_pr`
- `partial`
- `accepted_architecture`
- `planned`
- `research_only`
- `superseded`
- `out_of_scope`

Document fitness and implementation maturity are independent. A `present_current` PRD or TRD may describe both `implemented_on_protected_main` and `implemented_on_active_pr` requirements so long as those states are explicit and active work is never called shipped.

## Canonical documentation fitness

| Family | Canonical artifact | Documentation fitness | Implementation / authority interpretation | Acquisition conclusion |
| --- | --- | --- | --- | --- |
| PRD | `docs/PRD.md` | `present_current` | Protected-main product requirements plus explicitly labeled future work | Product promise, users, JTBD, non-goals, security, accessibility and release acceptance are reconstructable. |
| TRD | `docs/TRD.md` | `present_current` | Protected `main` remains runtime authority; print work in #116 remains active and separately labeled | Technical invariants, failure semantics, package boundaries, print authority and release evidence are reconstructable without stale active-branch claims. |
| ARCHITECTURE | `ARCHITECTURE.md` | `present_current` | `implemented_on_protected_main` for the bounded standalone/modular architecture | Host-vs-Inkspan authority and modular CWL composition are explicit. |
| Public/API/schema/plugin contracts | `docs/CONTRACTS.md` | `present_current` | Protected-main contracts plus explicitly proposed extensions | Integration authority and degraded behavior are not hidden in implementation details. |
| ADR | `docs/adr/README.md` and detailed ADRs | `present_current` | ADR 0015–0020 and 0022 record protected decisions; ADR 0021 records active print work as Proposed | Alternatives, consequences, recovery, migration, verification and supersession are reviewable without promoting active work. |
| UML | `docs/UML.md` | `present_current` | Protected-main diagrams remain authoritative; print additions remain Proposed until integrated | Component, sequence, state, deployment, degraded-mode and authority flows remain visible as diagram-as-code. |
| DATA_MODEL / ERD | `docs/DATA_MODEL.md` | `present_current` | Current logical evidence/domain model; host persistence remains outside Inkspan | The model distinguishes document/evidence/conversion/release values from host-owned entities. Package and CSS boundaries create no fake persisted entities. |
| physical relational ERD | none by design | `not_applicable` | `out_of_scope` while Inkspan owns no application database | No database is invented merely to satisfy an ERD checklist; a physical ERD becomes mandatory if persistence authority moves into Inkspan. |
| SECURITY disclosure policy | root `SECURITY.md` plus ADR 0017 | `present_current` | `implemented_on_protected_main` | Private reporting, evidence minimization, supported release-line binding, ownership limits, coordinated disclosure, and explicit no-SLA/no-certification claim boundaries are reconstructable. |
| Safe rich clipboard | PRD, TRD, `docs/clipboard-security.md`, ADR 0003/0016 and protected SafeClipboard source | `present_current` | `implemented_on_protected_main` | Buyers can reconstruct bounded active/hidden/resource rejection, transform ordering, error redaction and host ownership. |
| Autosave lifecycle observation | PRD, TRD, `docs/document-autosave.md`, lifecycle doctoring and protected autosave package/session source | `present_current` | `implemented_on_protected_main` | Buyers can reconstruct saving/blocked/recovery/idle/shutdown observation, document-free snapshots, observer-failure isolation, and durable-validator coherence. |
| SSR/native-form serialization | PRD, TRD, `docs/server-rendering.md`, SSR doctoring and protected editor/form source | `present_current` | `implemented_on_protected_main` | Buyers can reconstruct opt-in server serialization, hydration continuity, client-controlled submission semantics, reset behavior and host-owned auth/CSRF/persistence boundaries. |
| Toolbar shortcut accessibility metadata | PRD/TRD accessibility requirements, accessibility guide/doctoring and protected toolbar source | `present_current` | `implemented_on_protected_main` | Accessibility metadata is tied to actual repository-level keyboard behavior rather than extension-local assumptions. |
| Revision-scoped selection evidence | selection lifecycle guide, doctoring and protected public handle/type contract | `present_current` | `implemented_on_protected_main` | Atomic selection+revision evidence, privacy minimization and host-owned re-anchoring are reconstructable without overstating cross-revision authority. |
| W3C text-position selector evidence / React-free text-position selector subpath | ADR 0018, protected handle/type contract, protected package subpath, selector implementation/verifier, selection lifecycle and doctoring | `present_current` | `implemented_on_protected_main` | Unicode-code-point offsets, grapheme-boundary fail-closed semantics, explicit projection identity, same-state revision binding, React-free projection reuse and text-free evidence are reconstructable without confusing W3C offsets with ProseMirror positions. |
| Document-transition evidence | transition doctoring, public framework-independent contract and protected revision-evidence package | `present_current` | `implemented_on_protected_main` | Previous/resulting revision lineage and privacy/provenance boundaries are reconstructable without implying actor/time/durable-write provenance. |
| Envelope schema identity / migration routing | ADR 0015, PRD, TRD, DATA_MODEL, envelope guide/doctoring and protected identity-routing source | `present_current` | `implemented_on_protected_main` | Bounded schema identification remains separate from host-owned migration execution and persistence. |
| Cross-engine browser-semantic release assurance | ADR 0016, doctoring, TEST_STRATEGY, OPERABILITY, TRACEABILITY and protected browser evidence workflows | `present_current` | `implemented_on_protected_main` | SafeClipboard is also `implemented_on_protected_main`; Chromium/Firefox/WebKit evidence, fresh-run identity, source/lock/browser metadata, packed-artifact digest binding and fail-closed divergence are protected release authority. |
| Unified stable registry release train | ADR 0019, protected release workflow and release doctoring | `present_current` | `implemented_on_protected_main` | Stable npm/Office version equality, OIDC Trusted Publishing, exact-artifact publication and post-publication digest verification are source-integrated; live registry-side configuration/publication remains separate operational evidence. |
| Framework-neutral Markdown package boundary | ADR 0020, protected package export/build/verifier and merged issue #112 implementation | `present_current` | `implemented_on_protected_main` | The `./markdown` subpath and shared framework-neutral serializer policies are shipped protected authority and remain bounded to deterministic conversion. |
| CSS paged-media print boundary | ADR 0021, Issue #115 and active PR #116 | `present_current` | `implemented_on_active_pr` | Declarative print/paged-media behavior is represented as active work, while protected `main` is still the current stylesheet authority. |
| THREAT_MODEL | `docs/THREAT_MODEL.md` | `present_current` | Covers current trust boundaries and explicitly proposed extensions | Clipboard, evidence, Office, SSR/form, Yjs, model, host-authority and supply-chain threats are reconstructable. |
| TEST_STRATEGY | `docs/TEST_STRATEGY.md` | `present_current` | Protected deterministic/browser/package evidence plus active feature-specific test contracts | Test authority, exact source-head evidence and claim limits are explicit rather than inferred from CI badges. |
| OPERABILITY | `docs/OPERABILITY.md` | `present_current` | Current product responsibilities and protected browser/package/release recovery; active print line remains non-authoritative | Conflict, collaboration, conversion, release and recovery ownership are explicit. |
| Release / rollback / provenance | TRD, OPERABILITY and release ADRs | `present_current` | `implemented_on_protected_main` gates plus explicitly labeled future hardening | Exact-source release authority, stale-evidence rejection, registry partial-publication recovery and rollback are reconstructable. |
| TRACEABILITY | `docs/TRACEABILITY.md` | `present_current` | Protected requirements/standards/evidence mapping includes the integrated headless Markdown package line | Acquisition reviewers can distinguish evidence from aspiration. |
| Contributor/agent authority | `AGENTS.md`, `CLAUDE.md`, `docs/README.md` | `present_current` | Protected-main-first decision discipline | Agents are directed back to the same canonical graph rather than parallel private memory. |
| Autonomous maintenance governance | `AGENTS.md`, `CLAUDE.md` plus the external scheduler | `present_current` | `out_of_scope` as Inkspan runtime behavior; the external scheduler owns cadence/continuation | Work-conserving execution, lane-local waiting and scheduler-vs-product authority are reconstructable without pretending automation is an Inkspan API. |

## Conversation-to-GitHub reconciliation

The canonical graph retains durable product decisions from the project conversation only when they agree with live implementation or are explicitly labeled target/active architecture. The reviewed baseline covers:

- Markdown/HTML WYSIWYG authoring and deterministic source/document authority;
- strict link, image, SafeClipboard, envelope and revision/evidence boundaries;
- bundled local/offline fonts and air-gapped asset behavior;
- deterministic Markdown/HTML/email/plain-text conversion, the protected framework-neutral Markdown package boundary, and independently reusable Office rendering;
- provider-neutral collaboration with host-owned Yjs provider, room, persistence and awareness authority;
- bounded autosave lifecycle observation and durable-validator separation;
- SSR/native-form serialization with client-controlled browser values and host-owned acceptance controls;
- repository-level keyboard/accessibility metadata;
- revision-scoped selection, W3C text-position selector, React-free selector projection, and document-transition evidence;
- naruon `compose` / `ui.panel` modular integration without making naruon a standalone runtime dependency;
- model assistance as untrusted proposed content rather than conversion, authorization or persistence authority;
- host ownership of transport, authentication, authorization, tenant isolation, persistence, credentials, migration, retention, deployment, durable audit and model policy;
- private vulnerability reporting and coordinated disclosure;
- identity-only envelope routing with host-owned migration execution;
- dependency-locked real Chromium/Firefox/WebKit release assurance for rich-clipboard semantics;
- exact-head/package/security/provenance/release evidence as separate authorities from comments, model verdicts and historical checks;
- protected OIDC npm/PyPI trusted-publishing workflow and unified stable product release train under ADR 0019, while external registry configuration/live publication remains operational evidence rather than a source-code fact;
- protected framework-neutral deterministic Markdown package behavior under Accepted ADR 0020; and
- active CSS-only paged-media print work under ADR 0021/#116, explicitly separate from any durable PDF service or artifact authority.

Autonomous commercial-maintenance scheduling and no-early-stop execution are **control-plane governance, not shipped Inkspan runtime capability**. The external scheduler owns cadence/continuation. Repository guidance records writer leases, evidence hierarchy, documentation-to-code handoff, and protected-main authority without pretending the automation prompt is a product API.

Where older conversation, issue, PR body, or plan conflicts with protected `main`, it is historical. Where a requirement is only on an active PR, this documentation may describe it as `implemented_on_active_pr` but never as shipped.

## Documentation defects corrected by the current reconciliation line

The current reconciliation line addresses the implementation-maturity change created when PR #114 reached protected `main`:

1. ADR 0020 changes from Proposed to Accepted because the framework-neutral Markdown package boundary is now protected product authority.
2. `ARCHITECTURE.md` and `docs/TRD.md` stop calling `./markdown` an active/unshipped surface and describe the protected package topology and unchanged host authority boundary.
3. This fitness matrix changes the Markdown package line from `implemented_on_active_pr` to `implemented_on_protected_main` while retaining #116 as active print work.
4. Machine-checkable documentation tests are updated so a future regression cannot silently demote or re-promote the package boundary by stale PR prose.

These corrections do not transfer checks, reviews, implementation maturity, or merge authority from #116 or any other active branch.

## Remaining documentation and product gaps

The documentation pack is substantially complete for acquisition review, but **repository closure is not documentation closure**:

1. #116 must independently prove and integrate the CSS paged-media print boundary before ADR 0021 can become protected authority.
2. A source-integrated OIDC registry workflow does not prove that npm/PyPI Trusted Publisher configuration is live and correct. A successful registry publication is separate operational acceptance evidence.
3. Root npm and Office package versions remain intentionally unreconciled until the current product queue permits one stable release-preparation head; issue #118 tracks that release readiness gap.
4. Future protected-source changes must continue to reconcile PRD/TRD/Architecture/ADR/UML/DATA_MODEL/security/test/operability/traceability semantics rather than treating this baseline as permanently complete.
5. Documentation becoming mergeable, green, or protected-merged is never a reason for the commercial loop to stop; the next safe product, release, security, accessibility, package, or interoperability lane continues.

## Sufficiency decision

PRD, TRD, Architecture, ADR, UML, conceptual ERD/data model, contracts, threat model, test strategy, operability, security disclosure, and traceability are `present_current` on this reconciliation generation for the durable product boundary reconstructed from the conversation and live repository. The framework-neutral Markdown package boundary is labeled `implemented_on_protected_main`; #116 remains `implemented_on_active_pr`; physical relational ERD remains `not_applicable` because Inkspan deliberately owns no application persistence.

No material durable architecture decision identified by this whole-conversation review remains only in chat or issue prose. Accordingly, the **documentation graph is a protected-main canonical baseline** suitable for acquisition reconstruction, subject to this reconciliation branch itself passing review and protected integration. Documentation sufficiency is not product/release readiness: active implementation, external registry operation, exact-head checks, browser/fidelity evidence, and publication acceptance remain separate gates.