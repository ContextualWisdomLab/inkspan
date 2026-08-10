# Inkspan Documentation Fitness Matrix

Status: Protected-main canonical baseline with active-PR reconciliation

This document answers a narrower acquisition question than the PRD or architecture: **can an independent reviewer reconstruct Inkspan's product, technical, security, data/evidence, operating, and release decisions from GitHub without relying on chat history or pull-request prose?**

The documentation graph is a protected-main canonical baseline. Protected `main` remains the implementation authority, while requirements implemented only on another active branch are not shipped merely because this matrix references them. This active reconciliation records newly protected browser assurance and the proposed W3C selector evidence line without promoting the latter to protected authority.

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
| Public/API/schema/plugin contracts | `docs/CONTRACTS.md` | `present_current` | Protected-main contracts plus explicitly active/proposed extensions | Integration authority and degraded behavior are not hidden in implementation details. |
| ADR | `docs/adr/README.md` and detailed ADRs | `present_current` | ADR 0015 governs protected identity routing, ADR 0016 now records protected browser-semantic assurance, ADR 0017 records the protected security-disclosure lifecycle, and ADR 0018 proposes revision-scoped W3C selector evidence | Alternatives, consequences, recovery, migration, verification and supersession are reviewable. |
| UML | `docs/UML.md` | `present_current` | Diagrams include protected-main and clearly active/proposed flows | Component, sequence, state, deployment, degraded-mode and authority flows are visible as diagram-as-code. |
| DATA_MODEL / ERD | `docs/DATA_MODEL.md` | `present_current` | Current logical evidence/domain model; host persistence remains outside Inkspan | The model distinguishes document/evidence/conversion/release values from host-owned entities. |
| physical relational ERD | none by design | `not_applicable` | `out_of_scope` while Inkspan owns no application database | No fake database is invented merely to satisfy an ERD checklist; a physical ERD becomes mandatory if persistence authority moves into Inkspan. |
| SECURITY disclosure policy | root `SECURITY.md` plus ADR 0017 | `present_current` | `implemented_on_protected_main` | Private reporting, evidence minimization, supported release-line binding, ownership limits, coordinated disclosure, and explicit no-SLA/no-certification claim boundaries are reconstructable. |
| Safe rich clipboard | PRD, TRD, `docs/clipboard-security.md`, ADR 0003/0016 and protected SafeClipboard source | `present_current` | `implemented_on_protected_main` | Buyers can reconstruct bounded active/hidden/resource rejection, transform ordering, error redaction and host ownership without treating the sanitizer as active-only work. |
| Autosave lifecycle observation | PRD, TRD, `docs/document-autosave.md`, lifecycle doctoring and protected autosave package/session source | `present_current` | `implemented_on_protected_main` | Buyers can reconstruct saving/blocked/recovery/idle/shutdown observation, document-free snapshots, observer-failure isolation, and durable-validator coherence. |
| SSR/native-form serialization | PRD, TRD, `docs/server-rendering.md`, SSR doctoring and protected editor/form source | `present_current` | `implemented_on_protected_main` | Buyers can reconstruct opt-in server serialization, hydration continuity, client-controlled submission semantics, reset behavior and host-owned auth/CSRF/persistence boundaries. |
| Toolbar shortcut accessibility metadata | PRD/TRD accessibility requirements, accessibility guide/doctoring and protected toolbar source | `present_current` | `implemented_on_protected_main` | Accessibility metadata is tied to actual repository-level keyboard behavior rather than extension-local assumptions. |
| Revision-scoped ProseMirror selection evidence | selection lifecycle guide, doctoring and protected public handle/type contract | `present_current` | `implemented_on_protected_main` | Atomic selection+revision evidence, privacy minimization and host-owned re-anchoring are reconstructable as shipped behavior without overstating cross-revision authority. |
| W3C text-position selector evidence | selection lifecycle guide, `docs/doctoring/w3c-text-position-selector-evidence.md`, ADR 0018 and the active implementation | `present_current` | `implemented_on_active_pr`; protected ProseMirror selection evidence remains distinct | A versioned logical-text projection, Unicode-code-point offsets, grapheme fail-closed behavior, exact-revision binding and host-owned annotation/re-anchoring are reviewable without calling the active PR shipped. |
| Document-transition evidence | transition doctoring, public framework-independent contract and protected revision-evidence package | `present_current` | `implemented_on_protected_main` | Previous/resulting revision lineage and privacy/provenance boundaries are reconstructable as shipped local evidence without implying actor/time/durable-write provenance. |
| THREAT_MODEL | `docs/THREAT_MODEL.md` | `present_current` | Covers current and explicitly active/proposed trust boundaries | Clipboard, Office, SSR/form, Yjs, model, selector-evidence, host-authority and supply-chain threats are reconstructable. |
| TEST_STRATEGY | `docs/TEST_STRATEGY.md` | `present_current` | Protected deterministic and Playwright cross-engine evidence plus active W3C selector tests | Test authority, exact source-head browser evidence, Unicode selector evidence and claim limits are explicit rather than inferred from CI badges. |
| OPERABILITY | `docs/OPERABILITY.md` | `present_current` | Current product responsibilities, protected browser-assurance recovery, active selector compatibility, and host-owned recovery boundaries | Conflict, collaboration, conversion, browser divergence, selector drift and release recovery/rollback ownership are explicit. |
| Release / rollback / provenance | TRD, OPERABILITY and release ADRs | `present_current` | Protected browser release gate plus other protected/active hardening | Exact-source release authority, stale-evidence rejection, packed-artifact evidence and rollback are reconstructable. |
| Envelope schema identity / migration routing | ADR 0015, PRD, TRD, DATA_MODEL, envelope guide/doctoring and protected identity-routing source | `present_current` | `implemented_on_protected_main` | The architecture distinguishes bounded schema identification from host-owned migration execution without expanding Inkspan persistence authority. |
| Cross-engine browser-semantic release assurance | ADR 0016, `docs/doctoring/cross-engine-rich-clipboard-assurance.md`, TEST_STRATEGY, OPERABILITY, TRACEABILITY and protected browser gate source | `present_current` | `implemented_on_protected_main` | Dependency-locked Chromium/Firefox/WebKit differential assurance, fresh-run/package/source evidence and packed-artifact release verification are protected authority while still avoiding a universal-browser-conformance claim. |
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
- protected-main revision-scoped ProseMirror selection and document-transition evidence with local equality/lineage semantics and host-owned re-anchoring/occurrence provenance;
- active revision-scoped W3C `TextPositionSelector` evidence with a versioned logical text projection, Unicode-code-point offsets, grapheme-boundary validation and no selected quote in ordinary evidence;
- naruon `compose` / `ui.panel` modular integration without making naruon a standalone runtime dependency;
- model assistance as untrusted proposed content rather than conversion or persistence authority;
- accessibility, keyboard, print/export and document-fidelity evidence boundaries;
- host ownership of transport, authentication, authorization, tenant isolation, persistence, credentials, migration, retention, deployment, durable audit, annotation publication/re-anchoring and model policy;
- protected-main private vulnerability reporting and coordinated disclosure with explicit evidence-minimization and no-SLA/no-certification boundaries;
- protected-main identity-only envelope routing with strict current-schema parsing and host-owned migration execution;
- protected dependency-locked Playwright 1.62.0 Chromium/Firefox/WebKit differential evidence, exact fresh-run/lock/source/package identity, bounded retained evidence and packed npm artifact release verification for browser-semantic clipboard security; and
- exact-head/package/security/provenance/release evidence as separate authorities from comments, model verdicts and historical checks.

Autonomous commercial-maintenance scheduling and the no-early-stop execution discipline are **control-plane governance, not a shipped Inkspan product capability**. The external scheduler is the execution authority for cadence and continuation; repository guidance records writer leases, work-conserving queue behavior, lane-local waiting, evidence hierarchy and protected-main authority without pretending the automation prompt is a runtime API or architectural feature.

Where an older conversation, PR body, or plan conflicts with protected `main`, it is historical rather than canonical. Where a requirement is only on an active PR, this documentation may describe it as `implemented_on_active_pr` but never as shipped.

## Remaining documentation and product gaps

The documentation pack is structurally complete for acquisition review, but **repository closure is not documentation closure**. Remaining gaps are represented rather than hidden:

1. W3C text-position selector evidence remains `implemented_on_active_pr` until its current-main replacement completes canonical PRD/TRD/contracts/UML/data-model/traceability reconciliation, exact-head validation/review, and protected integration.
2. Cross-engine browser assurance, envelope identity routing, SafeClipboard, autosave lifecycle observation, security disclosure, toolbar shortcut accessibility metadata, SSR/native-form serialization, revision-scoped ProseMirror selection evidence, and document-transition evidence are `implemented_on_protected_main` and must not regress to active-only wording.
3. A physical relational ERD remains deliberately `not_applicable`; host-owned persistence is an architecture boundary, not a missing database design.
4. Future reconciliation remains mandatory whenever protected source, accepted decisions, active implementation maturity, public package/runtime support, or release evidence materially changes.
5. Documentation becoming mergeable or protected-merged is not a reason for the commercial loop to stop; the next safe product, release, security, accessibility or interoperability lane must continue.

## Sufficiency decision

PRD, TRD, Architecture, ADR, UML, conceptual ERD/data model, contracts, threat model, test strategy, operability, security disclosure, and traceability form a sufficient **documentation-family baseline** for acquisition reconstruction under the current Inkspan product boundary. Cross-engine browser assurance is now `implemented_on_protected_main`. W3C text-position selector evidence is `implemented_on_active_pr` and must remain explicitly non-authoritative until protected integration. A physical relational ERD is `not_applicable` because Inkspan deliberately owns no application persistence.

The active selector line proves why semantic fitness must be re-evaluated continuously: the document families are sufficient, but newly introduced durable public authority cannot remain only in issue/PR prose. This branch therefore carries the required ADR and canonical-graph reconciliation before the feature may be considered documentation-complete. Product/release readiness remains independent of documentation completeness.
