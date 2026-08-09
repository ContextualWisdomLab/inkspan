# Inkspan Documentation Fitness Matrix

Status: Proposed canonical baseline

This document answers a narrower acquisition question than the PRD or architecture: **can an independent reviewer reconstruct Inkspan's product, technical, security, data/evidence, operating, and release decisions from GitHub without relying on chat history or pull-request prose?**

Protected `main` remains the implementation authority. This documentation branch is reviewable evidence, but it is **not yet a protected-main canonical baseline** until normal protected integration succeeds. Requirements implemented only on another active branch are not shipped merely because this matrix references them.

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
| TRD | `docs/TRD.md` | `present_current` | Same mixed maturity discipline; Protected `main` remains runtime authority | Technical invariants, failure semantics, package boundaries and release evidence are reconstructable. |
| ARCHITECTURE | `ARCHITECTURE.md` | `present_current` | `implemented_on_protected_main` for the bounded standalone/modular architecture | Host-vs-Inkspan authority and modular CWL composition are explicit. |
| Public/API/schema/plugin contracts | `docs/CONTRACTS.md` | `present_current` | Protected-main contracts plus explicitly proposed extensions | Integration authority and degraded behavior are not hidden in implementation details. |
| ADR | `docs/adr/README.md` and detailed ADRs | `present_current` | Decisions distinguish current, proposed and future work | Alternatives, consequences, recovery, migration, verification and supersession are reviewable. |
| UML | `docs/UML.md` | `present_current` | Diagrams include protected-main and clearly proposed flows | Component, sequence, state, deployment, degraded-mode and authority flows are visible as diagram-as-code. |
| DATA_MODEL / ERD | `docs/DATA_MODEL.md` | `present_current` | Current logical evidence/domain model; host persistence remains outside Inkspan | The model distinguishes document/evidence/conversion/release values from host-owned entities. |
| physical relational ERD | none by design | `not_applicable` | `out_of_scope` while Inkspan owns no application database | No fake database is invented merely to satisfy an ERD checklist; a physical ERD becomes mandatory if persistence authority moves into Inkspan. |
| SECURITY disclosure policy | root `SECURITY.md` | `owned_by_separate_active_pr` | `implemented_on_active_pr` until protected integration | This branch must not race the separately owned disclosure-policy line. |
| THREAT_MODEL | `docs/THREAT_MODEL.md` | `present_current` | Covers current and explicitly proposed trust boundaries | Clipboard, Office, SSR/form, Yjs, model, host-authority and supply-chain threats are reconstructable. |
| TEST_STRATEGY | `docs/TEST_STRATEGY.md` | `present_current` | Current deterministic evidence plus `planned` cross-engine acceptance where dependency order requires it | Test authority and claim limits are explicit rather than inferred from CI badges. |
| OPERABILITY | `docs/OPERABILITY.md` | `present_current` | Current local/product responsibilities plus host-owned recovery boundaries | Conflict, collaboration, conversion and release recovery/rollback ownership are explicit. |
| Release / rollback / provenance | TRD, OPERABILITY and release ADRs | `present_current` | Mix of `implemented_on_protected_main` and active hardening | Exact-source release authority, stale-evidence rejection and rollback are reconstructable. |
| Envelope schema identity / migration routing | ADR 0015, PRD, TRD, DATA_MODEL and Issue #74 | `present_current` | Identity-only routing capability is `planned`; strict current-schema parsing and host migration ownership remain authoritative | The architecture now distinguishes bounded schema identification from host-owned migration execution without calling the planned API shipped. |
| Cross-engine browser-semantic release assurance | ADR 0016, UML, TEST_STRATEGY, TRACEABILITY and Issue #66 | `present_current` | Differential Chromium/Firefox/WebKit release gate is `planned` behind PR #65 | Browser-realistic security assurance is a durable release decision even though its implementation remains dependency-ordered future work. |
| TRACEABILITY | `docs/TRACEABILITY.md` | `present_current` | Links standards/research/requirements to decisions and evidence with scoped claims | Acquisition reviewers can distinguish evidence from aspiration. |
| Contributor/agent authority | `AGENTS.md`, `CLAUDE.md`, `docs/README.md` | `present_current` | Protected-main-first decision discipline | Agents are directed back to the same canonical graph rather than parallel private memory. |
| Autonomous maintenance governance | `AGENTS.md`, `CLAUDE.md` plus the external scheduler | `present_current` | `out_of_scope` as Inkspan runtime behavior; the external scheduler owns cadence/continuation | Work-conserving execution, lane-local waiting, no-report-as-completion, and the scheduler-vs-product authority boundary are reconstructable without pretending automation is an Inkspan API. |

## Conversation-to-GitHub reconciliation

The canonical graph must retain durable product decisions from the project conversation only when they agree with live implementation or are explicitly labeled as target architecture. The reviewed baseline currently covers:

- Markdown/HTML WYSIWYG authoring and deterministic source/document authority;
- strict link, image, clipboard, envelope and revision/evidence boundaries;
- bundled local/offline font licensing and air-gapped asset behavior;
- deterministic email/document conversion boundaries and independently reusable Office rendering;
- provider-neutral collaboration with host-owned Yjs provider, room, persistence and awareness authority;
- naruon `compose` / `ui.panel` modular integration without making naruon a standalone runtime dependency;
- model assistance as untrusted proposed content rather than conversion or persistence authority;
- accessibility, keyboard, print/export and document-fidelity evidence boundaries;
- host ownership of transport, identity, authorization, tenancy, persistence, credentials, migration, retention, deployment, durable audit and model policy;
- strict current-schema parsing plus planned identity-only envelope routing, while migration execution remains host-owned;
- real Chromium/Firefox/WebKit differential evidence as a release gate for browser-semantic clipboard security rather than a jsdom conformance claim; and
- exact-head/package/security/provenance/release evidence as separate authorities from comments, model verdicts and historical checks.

Autonomous commercial-maintenance scheduling and the no-early-stop execution discipline are **control-plane governance, not a shipped Inkspan product capability**. The external scheduler is the execution authority for cadence and continuation; repository guidance records writer leases, work-conserving queue behavior, lane-local waiting, evidence hierarchy and protected-main authority without pretending the automation prompt is a runtime API or architectural feature.

Where an older conversation, PR body, or plan conflicts with Protected `main`, it is historical rather than canonical. Where a requirement is only on an active PR, this documentation may describe it as `implemented_on_active_pr` but never as shipped.

## Remaining documentation and product gaps

The documentation pack itself is substantially complete for acquisition review, but **repository closure is not documentation closure**. The remaining gaps are intentionally represented rather than hidden:

1. The security disclosure policy remains `owned_by_separate_active_pr`; after protected merge, this graph must be reconciled against the actual root `SECURITY.md`.
2. Issue #74 remains `planned`: the identity-only migration-routing API must still be implemented test-first while the current parser remains strict. Its architectural decision is now present rather than hidden in issue prose.
3. Issue #66 remains `planned` behind PR #65: the dependency-locked Chromium/Firefox/WebKit differential suite must still be implemented before the rich-clipboard release line. Its release-assurance decision is now present rather than hidden in issue prose.
4. Active feature branches for autosave observation, revision evidence, SSR/native forms, accessibility, release hardening and runtime compatibility remain `implemented_on_active_pr` until protected integration.
5. Documentation becoming mergeable or protected-merged is not a reason for the commercial loop to stop; the next safe product, release, security, accessibility or interoperability lane must continue.

## Sufficiency decision

For this active documentation branch, PRD, TRD, Architecture, ADR, UML, conceptual ERD/data model, contracts, threat model, test strategy, operability and traceability are `present_current` for the durable product and accepted/planned architecture decisions reconstructed from the conversation and live repository. Envelope migration routing and cross-engine browser assurance are now explicit Proposed ADR decisions while their implementations remain `planned`. A physical relational ERD is `not_applicable` because Inkspan deliberately owns no application persistence. The repository security disclosure policy is separately owned and therefore `owned_by_separate_active_pr` rather than duplicated.

No material product architecture decision identified by this review remains only in chat or issue prose. Accordingly, the **documentation design is sufficient as a proposed acquisition baseline**, but the repository is **not yet a protected-main canonical baseline** until this graph and the separately owned security policy pass their exact-head checks/reviews and normal protected integration. Product/release readiness must continue to be evaluated independently of documentation completeness.
