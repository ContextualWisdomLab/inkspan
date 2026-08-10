# Inkspan Documentation Fitness Matrix

Status: Protected-main canonical baseline

This document answers a narrower acquisition question than the PRD or architecture: **can an independent reviewer reconstruct Inkspan's product, technical, security, data/evidence, operating, package, presentation, Office-fidelity, and release decisions from GitHub without relying on chat history or pull-request prose?**

The documentation graph is a protected-main canonical baseline. Protected `main` remains the implementation authority. Requirements implemented only on another active branch are not shipped merely because this matrix, an issue, or an ADR references them.

## Classification vocabulary

Documentation-family fitness uses exactly these values:

- `present_current` — the canonical document exists on the reviewed source generation and matches the reviewed product boundary.
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

Document fitness and implementation maturity are independent. A `present_current` document can describe `implemented_on_protected_main`, `implemented_on_active_pr`, and `planned` capabilities so long as those states are explicit and active work is never called shipped.

## Canonical documentation fitness

| Family | Canonical artifact | Documentation fitness | Implementation / authority interpretation | Acquisition conclusion |
| --- | --- | --- | --- | --- |
| PRD | `docs/PRD.md` | `present_current` | Protected-main product requirements plus explicitly labeled future work | Product promise, users, JTBD, non-goals, security, accessibility and release acceptance are reconstructable. |
| TRD | `docs/TRD.md` | `present_current` | Protected `main` remains runtime authority | Technical invariants, failure semantics, package boundaries, print behavior, Office fidelity and release evidence are reconstructable. |
| ARCHITECTURE | `ARCHITECTURE.md` | `present_current` | `implemented_on_protected_main` for the bounded standalone/modular architecture | Host-vs-Inkspan authority and modular CWL composition are explicit. |
| Public/API/schema/plugin contracts | `docs/CONTRACTS.md` | `present_current` | Protected-main contracts plus explicitly proposed extensions | Integration authority and degraded behavior are not hidden in implementation details. |
| ADR | `docs/adr/README.md` and detailed ADRs | `present_current` | Accepted ADRs describe protected authority; Proposed ADRs remain non-shipped | Alternatives, consequences, failure/recovery, compatibility, verification and supersession are reviewable. |
| UML | `docs/UML.md` | `present_current` | Protected-main diagrams remain authoritative and proposed flows are labeled | Component, sequence, state, deployment, degraded-mode and authority flows are visible as diagram-as-code. |
| DATA_MODEL / ERD | `docs/DATA_MODEL.md` | `present_current` | Current logical evidence/domain model; host persistence remains outside Inkspan | Document/evidence/conversion/release values are distinguished from host-owned entities. |
| physical relational ERD | none by design | `not_applicable` | `out_of_scope` while Inkspan owns no application database | No fake database is invented merely to satisfy an ERD checklist; a physical ERD becomes mandatory if persistence authority moves into Inkspan. |
| SECURITY disclosure policy | root `SECURITY.md` plus ADR 0017 | `present_current` | `implemented_on_protected_main` | Private reporting, evidence minimization, supported release-line binding, ownership limits, coordinated disclosure, and explicit no-SLA/no-certification boundaries are reconstructable. |
| Safe rich clipboard | PRD, TRD, `docs/clipboard-security.md`, ADR 0003/0016 and protected source | `present_current` | `implemented_on_protected_main` | Active/hidden/resource rejection, transform ordering, error redaction and host ownership are reconstructable. |
| Autosave lifecycle observation | PRD, TRD, `docs/document-autosave.md` and protected autosave source | `present_current` | `implemented_on_protected_main` | Saving/blocked/recovery/idle/shutdown observation and durable-validator separation are reconstructable. |
| SSR/native-form serialization | PRD, TRD, `docs/server-rendering.md` and protected source | `present_current` | `implemented_on_protected_main` | Opt-in server serialization, hydration continuity, native submission semantics and host-owned acceptance controls are reconstructable. |
| Toolbar shortcut accessibility metadata | accessibility guidance/doctoring and protected toolbar source | `present_current` | `implemented_on_protected_main` | Assistive metadata is tied to actual repository keyboard behavior. |
| Accessible editor placeholder semantics | accessibility guidance/doctoring and protected editor source from #131 | `present_current` | `implemented_on_protected_main` | Visual placeholder guidance and `aria-placeholder` remain synchronized without making placeholder text an accessible name or persistent document value. |
| Revision-scoped selection evidence | selection lifecycle guide, doctoring and protected public handle/type contract | `present_current` | `implemented_on_protected_main` | Atomic selection+revision evidence, privacy minimization and host-owned re-anchoring are reconstructable. |
| W3C text-position selector evidence / React-free text-position selector subpath | ADR 0018, protected handle/type contract, package subpath, selector implementation/verifier and doctoring | `present_current` | `implemented_on_protected_main` | ADR 0018 makes Unicode-code-point offsets, grapheme-boundary fail-closed semantics, projection identity, same-state revision binding, React-free text-position selector subpath reuse and text-free evidence reconstructable without confusing W3C offsets with ProseMirror positions. |
| Document-transition evidence | transition doctoring, public framework-independent contract and protected revision-evidence package | `present_current` | `implemented_on_protected_main` | Previous/resulting revision lineage is reconstructable without implying actor/time/durable-write provenance. |
| Envelope schema identity / migration routing | ADR 0015, PRD, TRD, DATA_MODEL, envelope guide/doctoring and protected identity-routing source | `present_current` | `implemented_on_protected_main` | Bounded schema identification remains separate from host-owned migration execution and persistence. |
| Cross-engine browser-semantic release assurance | ADR 0016, doctoring, TEST_STRATEGY, OPERABILITY, TRACEABILITY and protected browser-evidence workflows | `present_current` | `implemented_on_protected_main` | SafeClipboard is also `implemented_on_protected_main`; Chromium/Firefox/WebKit evidence, exact source/lock/browser identity, packed-artifact digest binding and fail-closed divergence are protected release authority. |
| Unified stable registry release train | ADR 0019, protected release workflow and release doctoring | `present_current` | `implemented_on_protected_main` | Stable npm/Office version equality, OIDC Trusted Publishing, exact-artifact publication and post-publication digest verification are source-integrated; live registry publication remains separate operational evidence. |
| Framework-neutral Markdown package boundary | ADR 0020, protected `@contextualwisdomlab/cwl-editor/markdown` package subpath and shared policy modules from #114 | `present_current` | `implemented_on_protected_main` | Server/worker consumers can reuse deterministic Markdown/HTML/email/plain-text conversion without evaluating the React/TipTap editor graph. |
| CSS paged-media print boundary | ADR 0021, protected `src/styles.css`, packaged stylesheet evidence and real-browser print tests from #116/#127 | `present_current` | `implemented_on_protected_main` | Declarative print output removes screen-only clipping/chrome while preserving authored content without creating a durable PDF service. |
| Informative DOCX PNG figures | ADR 0022, Office schema/renderer/tests and guidance | `present_current` | `implemented_on_protected_main` | Strict bounded inline PNG figures preserve informative alternative text without remote-resource or arbitrary OOXML authority. |
| DOCX bounded rich-text runs | ADR 0023, Office schema/renderer/tests and doctoring | `present_current` | `implemented_on_protected_main` | Ordered bold/italic/underline runs preserve common inline fidelity under one bounded deterministic contract. |
| DOCX bounded paragraph alignment | ADR 0024, Office schema/renderer/tests, Office guidance and doctoring | `present_current` | `implemented_on_protected_main` | `paragraph` and `rich_paragraph` preserve explicit left/center/right/justify alignment while omission retains inherited/default behavior. |
| DOCX bounded heading alignment | ADR 0025, Office schema/renderer/tests, Office guidance and doctoring | `present_current` | `implemented_on_protected_main` | `heading` preserves the same exact left/center/right/justify contract through the shared paragraph-alignment authority while omission retains heading-style/default behavior. |
| THREAT_MODEL | `docs/THREAT_MODEL.md` | `present_current` | Covers current trust boundaries and explicitly proposed extensions | Clipboard, evidence, Office, SSR/form, Yjs, model, host-authority and supply-chain threats are reconstructable. |
| TEST_STRATEGY | `docs/TEST_STRATEGY.md` | `present_current` | Protected deterministic/browser/Office evidence plus active feature-specific test contracts | Test authority, exact source-head evidence and claim limits are explicit rather than inferred from CI badges. |
| OPERABILITY | `docs/OPERABILITY.md` | `present_current` | Current product responsibilities plus protected browser/release recovery boundaries | Conflict, collaboration, conversion, registry partial-publication recovery and rollback ownership are explicit. |
| Release / rollback / provenance | TRD, OPERABILITY and release ADRs | `present_current` | `implemented_on_protected_main` gates plus explicitly labeled future hardening | Exact-source release authority, stale-evidence rejection and rollback are reconstructable. |
| TRACEABILITY | `docs/TRACEABILITY.md` | `present_current` | Protected requirements/standards/evidence mapping | Acquisition reviewers can distinguish protected evidence from active or planned work. |
| Contributor/agent authority | `AGENTS.md`, `CLAUDE.md`, `docs/README.md` | `present_current` | Protected-main-first decision discipline | Agents are directed back to the same canonical graph rather than parallel private memory. |
| Autonomous maintenance governance | `AGENTS.md`, `CLAUDE.md` plus the external scheduler | `present_current` | `out_of_scope` as Inkspan runtime behavior | Work-conserving execution, lane-local waiting and external scheduler authority are reconstructable without pretending automation is an Inkspan API. |

## Conversation-to-GitHub reconciliation

The canonical graph retains durable product decisions from the project conversation only when they agree with live implementation or are explicitly labeled target/active architecture. The reviewed baseline covers Markdown/HTML WYSIWYG authoring; strict link/image/SafeClipboard boundaries; local/offline fonts; deterministic Markdown/HTML/email/plain-text conversion; independently reusable Office rendering; provider-neutral Yjs collaboration with host-owned provider/persistence authority; bounded autosave lifecycle observation; SSR/native-form serialization; accessibility metadata; revision-scoped evidence and W3C text-position selectors; naruon modular composition; model assistance as an untrusted proposal; host-owned transport/authentication/authorization/tenant isolation/persistence/credentials/migration/retention/deployment/durable audit/model policy; cross-engine browser assurance; OIDC trusted publishing; framework-neutral Markdown packaging; CSS paged-media presentation; and bounded DOCX figure/rich-text/paragraph/heading alignment fidelity.

Autonomous commercial-maintenance scheduling and no-early-stop execution are control-plane governance, not shipped Inkspan runtime capability. The external scheduler owns cadence and continuation. Where older conversation, issue, PR body, or plan conflicts with protected `main`, it is historical. Where a requirement is only on an active PR, this documentation uses `implemented_on_active_pr` and never presents it as shipped.

## Remaining documentation and product gaps

The documentation pack is substantially complete for acquisition review, but repository closure is not documentation closure:

1. The unified OIDC release workflow is source-integrated, but issue #118 remains open because the next stable registry release still requires one coherent npm/Office/tag version plus live npm/PyPI publication and post-publication digest verification.
2. Future protected-source changes must continue to reconcile PRD/TRD/Architecture/ADR/UML/DATA_MODEL/security/test/operability/traceability semantics rather than treating this baseline as permanently complete.
3. Documentation becoming mergeable, green, or protected-merged is never a reason for the commercial loop to stop; the next safe product, release, security, accessibility, package, Office-fidelity, or interoperability lane continues.

## Sufficiency decision

PRD, TRD, Architecture, ADR, UML, conceptual ERD/data model, contracts, threat model, test strategy, operability, security disclosure, and traceability are `present_current` for the durable product boundary reconstructed from the conversation and live repository. Protected capabilities are labeled `implemented_on_protected_main`; future active work remains explicitly `implemented_on_active_pr` or `planned`; physical relational ERD remains `not_applicable` because Inkspan deliberately owns no application persistence.

No material protected product architecture decision identified by this review remains only in chat or issue prose. Accordingly, the documentation graph is a protected-main canonical baseline suitable for acquisition reconstruction. Documentation sufficiency is not product/release readiness: active implementation, exact-head checks, browser/fidelity evidence, registry operation and publication acceptance remain separate gates.
