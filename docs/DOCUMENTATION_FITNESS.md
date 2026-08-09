# Inkspan Documentation Fitness Matrix

Status: Protected-main canonical baseline

This document answers a narrower acquisition question than the PRD or architecture: **can an independent reviewer reconstruct Inkspan's product, technical, security, data/evidence, operating, and release decisions from GitHub without relying on chat history or pull-request prose?**

The documentation graph is a protected-main canonical baseline. Protected `main` remains the implementation authority, while requirements implemented only on another active branch are not shipped merely because this matrix references them.

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

Document fitness and implementation maturity are independent. A `present_current` PRD may describe both `implemented_on_protected_main` and `planned` requirements so long as those states are explicit.

## Canonical documentation fitness

| Family | Canonical artifact | Documentation fitness | Implementation / authority interpretation | Acquisition conclusion |
| --- | --- | --- | --- | --- |
| PRD | `docs/PRD.md` | `present_current` | Mix of `implemented_on_protected_main`, `implemented_on_active_pr`, and `planned`, explicitly labeled | Product promise, users, JTBD, non-goals, security, accessibility and release acceptance are reconstructable. |
| TRD | `docs/TRD.md` | `present_current` | Same mixed maturity discipline; protected `main` remains runtime authority | Technical invariants, failure semantics, package boundaries and release evidence are reconstructable. |
| ARCHITECTURE | `ARCHITECTURE.md` | `present_current` | `implemented_on_protected_main` for the bounded standalone/modular architecture | Host-vs-Inkspan authority and modular CWL composition are explicit. |
| Public/API/schema/plugin contracts | `docs/CONTRACTS.md` | `present_current` | Protected-main contracts plus explicitly proposed extensions | Integration authority and degraded behavior are not hidden in implementation details. |
| ADR | `docs/adr/README.md` and detailed ADRs | `present_current` | Decisions distinguish current, proposed and future work; ADR 0015 governs active identity routing and ADR 0017 records the protected security-disclosure lifecycle | Alternatives, consequences, recovery, migration, verification and supersession are reviewable. |
| UML | `docs/UML.md` | `present_current` | Diagrams include protected-main and clearly proposed flows | Component, sequence, state, deployment, degraded-mode and authority flows are visible as diagram-as-code. |
| DATA_MODEL / ERD | `docs/DATA_MODEL.md` | `present_current` | Current logical evidence/domain model; host persistence remains outside Inkspan | The model distinguishes document/evidence/conversion/release values from host-owned entities. |
| physical relational ERD | none by design | `not_applicable` | `out_of_scope` while Inkspan owns no application database | No fake database is invented merely to satisfy an ERD checklist; a physical ERD becomes mandatory if persistence authority moves into Inkspan. |
| SECURITY disclosure policy | root `SECURITY.md` plus ADR 0017 | `present_current` | `implemented_on_protected_main`; the root policy is protected authority and ADR 0017 records its durable architecture/process decision | Private reporting, evidence minimization, supported release-line binding, ownership limits, coordinated disclosure, and explicit no-SLA/no-certification claim boundaries are reconstructable. |
| Safe rich clipboard | PRD, TRD, clipboard/security doctoring and protected SafeClipboard source | `present_current` | `implemented_on_protected_main`; protected main includes bounded fail-closed semantic reconstruction in the actual TipTap/ProseMirror paste pipeline | Buyers can reconstruct the sanitizer trust boundary without confusing jsdom integration evidence with cross-engine browser assurance. |
| Autosave lifecycle observation | PRD, TRD, `docs/document-autosave.md`, lifecycle doctoring and protected autosave package/session source | `present_current` | `implemented_on_protected_main`; protected main exposes the bounded construction-time observer contract | Buyers can reconstruct saving/blocked/recovery/idle/shutdown observation, document-free snapshots, observer-failure isolation, and durable-validator coherence without treating it as an active-PR promise. |
| SSR/native-form serialization | PRD, TRD, `docs/server-rendering.md`, SSR doctoring and protected editor/form source | `present_current` | `implemented_on_protected_main`; protected main includes the explicit server-value handoff and synchronous hydrated mirror | Buyers can reconstruct opt-in server serialization, hydration continuity, client-controlled submission semantics, reset behavior and host-owned auth/CSRF/persistence boundaries. |
| Toolbar shortcut accessibility metadata | PRD/TRD accessibility requirements, accessibility guide/doctoring and protected toolbar source | `present_current` | `implemented_on_protected_main`; shipped bold/italic/link/undo/redo shortcuts expose truthful `aria-keyshortcuts` metadata | Accessibility metadata is tied to actual repository-level keyboard behavior rather than extension-local assumptions. |
| Revision-scoped selection evidence | selection lifecycle guide, doctoring and protected public handle/type contract | `present_current` | `implemented_on_protected_main`; protected main atomically binds structural selection coordinates to the exact revision | Atomic selection+revision evidence, privacy minimization and host-owned re-anchoring are reconstructable as shipped behavior without overstating cross-revision authority. |
| Document-transition evidence | transition doctoring, public framework-independent contract and protected revision-evidence package | `present_current` | `implemented_on_protected_main`; protected main exposes object/JSON and strict UTF-8 transition evidence | Previous/resulting revision lineage and privacy/provenance boundaries are reconstructable as shipped local evidence without implying actor/time/durable-write provenance. |
| THREAT_MODEL | `docs/THREAT_MODEL.md` | `present_current` | Covers current and explicitly proposed trust boundaries | Clipboard, Office, SSR/form, Yjs, model, host-authority and supply-chain threats are reconstructable. |
| TEST_STRATEGY | `docs/TEST_STRATEGY.md` | `present_current` | Current deterministic evidence plus `planned` cross-engine acceptance | Test authority and claim limits are explicit rather than inferred from CI badges. |
| OPERABILITY | `docs/OPERABILITY.md` | `present_current` | Current local/product responsibilities plus host-owned recovery boundaries | Conflict, collaboration, conversion and release recovery/rollback ownership are explicit. |
| Release / rollback / provenance | TRD, OPERABILITY and release ADRs | `present_current` | Mix of `implemented_on_protected_main` and active hardening | Exact-source release authority, stale-evidence rejection and rollback are reconstructable. |
| Envelope schema identity / migration routing | ADR 0015, PRD, TRD, DATA_MODEL, envelope guide/doctoring and PR #84 | `present_current` | Identity-only routing capability is `implemented_on_active_pr`; strict current-schema parsing and host migration ownership remain authoritative | The architecture distinguishes bounded schema identification from host-owned migration execution without calling the active PR shipped. |
| Cross-engine browser-semantic release assurance | ADR 0016, UML, TEST_STRATEGY, TRACEABILITY and Issue #66 | `present_current` | Differential Chromium/Firefox/WebKit release gate is `planned` and now unblocked by SafeClipboard protected integration | Browser-realistic security assurance is a durable release decision even though its implementation remains future work. |
| TRACEABILITY | `docs/TRACEABILITY.md` | `present_current` | Links standards/research/requirements to decisions and evidence with scoped claims | Acquisition reviewers can distinguish evidence from aspiration. |
| Contributor/agent authority | `AGENTS.md`, `CLAUDE.md`, `docs/README.md` | `present_current` | Protected-main-first decision discipline | Agents are directed back to the same canonical graph rather than parallel private memory. |
| Autonomous maintenance governance | `AGENTS.md`, `CLAUDE.md` plus the external scheduler | `present_current` | `out_of_scope` as Inkspan runtime behavior; the external scheduler owns cadence/continuation | Work-conserving execution, lane-local waiting, no-report-as-completion, and the scheduler-vs-product authority boundary are reconstructable without pretending automation is an Inkspan API. |

## Conversation-to-GitHub reconciliation

The canonical graph must retain durable product decisions from the project conversation only when they agree with live implementation or are explicitly labeled as target architecture. The reviewed baseline currently covers:

- Markdown/HTML WYSIWYG authoring and deterministic source/document authority;
- strict link, image, protected-main SafeClipboard, envelope and revision/evidence boundaries;
- bundled local/offline font licensing and air-gapped asset behavior;
- deterministic email/document conversion boundaries and independently reusable Office rendering;
- provider-neutral collaboration with host-owned Yjs provider, room, persistence and awareness authority;
- bounded protected-main autosave lifecycle observation with document-free distinct snapshots and observer-failure isolation;
- protected-main SSR/native-form serialization with opt-in document disclosure, controlled hydration handoff, synchronous native-field mirroring, and host-owned acceptance controls;
- protected-main toolbar shortcut metadata that reflects the actual cross-platform bold, italic, link, undo and redo bindings;
- protected-main revision-scoped selection and document-transition evidence with local equality/lineage semantics and host-owned re-anchoring/occurrence provenance;
- naruon `compose` / `ui.panel` modular integration without making naruon a standalone runtime dependency;
- model assistance as untrusted proposed content rather than conversion or persistence authority;
- accessibility, keyboard, print/export and document-fidelity evidence boundaries;
- host ownership of transport, authentication, authorization, tenant isolation, persistence, credentials, migration, retention, deployment, durable audit and model policy;
- protected-main private vulnerability reporting and coordinated disclosure with explicit evidence-minimization and no-SLA/no-certification boundaries;
- strict current-schema parsing plus `implemented_on_active_pr` identity-only envelope routing in PR #84, while migration execution remains host-owned;
- real Chromium/Firefox/WebKit differential evidence as a planned release gate for browser-semantic clipboard security rather than a jsdom conformance claim; and
- exact-head/package/security/provenance/release evidence as separate authorities from comments, model verdicts and historical checks.

Autonomous commercial-maintenance scheduling and the no-early-stop execution discipline are **control-plane governance, not a shipped Inkspan product capability**. The external scheduler is the execution authority for cadence and continuation; repository guidance records writer leases, work-conserving queue behavior, lane-local waiting, evidence hierarchy and protected-main authority without pretending the automation prompt is a runtime API or architectural feature.

Where an older conversation, PR body, or plan conflicts with protected `main`, it is historical rather than canonical. Where a requirement is only on an active PR, this documentation may describe it as `implemented_on_active_pr` but never as shipped.

## Remaining documentation and product gaps

The documentation pack itself is substantially complete for acquisition review, but **repository closure is not documentation closure**. The remaining gaps are intentionally represented rather than hidden:

1. PR #84 implements Issue #74 on an active branch: identity-only migration routing must still pass exact-head CI/security/package/review/repository-policy gates and protected integration before its maturity changes to `implemented_on_protected_main`.
2. Issue #66 remains `planned`, but SafeClipboard is now integrated: the dependency-locked Chromium/Firefox/WebKit differential suite can start from fresh protected `main` and remains required before the rich-clipboard release line.
3. SafeClipboard, autosave lifecycle observation, security disclosure, toolbar shortcut accessibility metadata, SSR/native-form serialization, revision-scoped selection evidence, and document-transition evidence are `implemented_on_protected_main` and must not be described as active-only work.
4. The canonical documentation graph is already integrated on protected `main`; future reconciliation is required when protected source, accepted decisions, or implementation maturity materially changes.
5. Documentation becoming mergeable or protected-merged is not a reason for the commercial loop to stop; the next safe product, release, security, accessibility or interoperability lane must continue.

## Sufficiency decision

PRD, TRD, Architecture, ADR, UML, conceptual ERD/data model, contracts, threat model, test strategy, operability, security disclosure, and traceability are `present_current` for the durable product and accepted/planned architecture decisions reconstructed from the conversation and live repository. SafeClipboard, autosave lifecycle observation, the security disclosure lifecycle, toolbar shortcut accessibility metadata, SSR/native-form serialization, revision-scoped selection evidence, and document-transition evidence are `implemented_on_protected_main`. Envelope migration routing is `implemented_on_active_pr` in PR #84. Cross-engine browser assurance remains `planned`. A physical relational ERD is `not_applicable` because Inkspan deliberately owns no application persistence.

No material product architecture decision identified by this review remains only in chat or issue prose. Accordingly, the **documentation graph is a protected-main canonical baseline** and is sufficient for acquisition reconstruction under the current product boundary. Product/release readiness must continue to be evaluated independently of documentation completeness.
