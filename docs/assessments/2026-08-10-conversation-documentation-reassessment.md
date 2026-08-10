# Inkspan conversation-to-GitHub documentation reassessment — 2026-08-10

Status: Reviewable protected-main reassessment with explicit operational deltas

## Purpose

This assessment answers whether an independent product, engineering, security, operations, or acquisition reviewer can reconstruct the durable Inkspan decisions established through the project conversation from GitHub alone. It compares the canonical documentation graph with protected `main`, the current issue queue, and protected implementation evidence. It does not treat conversation text, a pull-request body, a model response, or predecessor evidence as shipped authority.

## Evidence generation reviewed

- Protected implementation generation reviewed: `main@f2a87bc32710574b54c0ccd1a4f33fee2c6f2224`, including the unified Inkspan 0.6.0 source candidate from #135 and bounded DOCX external hyperlinks from #137.
- Release operational-acceptance line reviewed separately: issue #118.
- Repository guidance reviewed: `AGENTS.md`, `CLAUDE.md`, `docs/README.md`, `docs/DOCUMENTATION_FITNESS.md`, `docs/PRD.md`, `docs/TRD.md`, `ARCHITECTURE.md`, `docs/CONTRACTS.md`, `docs/UML.md`, `docs/DATA_MODEL.md`, `SECURITY.md`, `docs/THREAT_MODEL.md`, `docs/TEST_STRATEGY.md`, `docs/OPERABILITY.md`, `docs/TRACEABILITY.md`, and the ADR index.

Mutable heads, checks, reviews, workflow runs, releases, tags, and registry records must still be re-fetched immediately before any merge or release decision. The immutable generation above records the basis for this dated documentation assessment only.

## Fitness matrix

| Documentation family | Fitness | Implementation interpretation | Reassessment conclusion |
| --- | --- | --- | --- |
| PRD | `present_current` | Protected product scope plus explicitly labeled planned work | Users, buyer jobs, deterministic authoring/conversion, accessibility, standalone/MSA behavior, host ownership, non-goals, and acceptance are reconstructable. |
| TRD | `present_current` | Protected runtime and package authority | Validation, evidence, packaging, browser, Office, failure, security, and release semantics are reconstructable. |
| Root Architecture | `present_current` | `implemented_on_protected_main` for current bounded contexts | Standalone operation, naruon/CWL composition, host-owned transport/persistence/tenancy, trust boundaries, and deployment responsibilities are explicit. |
| Contracts | `present_current` | Protected public package/API/schema/plugin/collaboration contracts | Consumers do not need implementation archaeology to identify public authority or degraded behavior. |
| ADR graph | `present_current` after this reconciliation | Accepted decisions through ADR 0026 are protected | Alternatives, consequences, compatibility, failure/recovery, security, verification, rollback, and supersession are reconstructable without leaving the merged hyperlink capability marked Proposed. |
| UML | `present_current` | Protected components, sequences, states, deployments, and authority flows | Current runtime/control/evidence interactions are diagrammed as code; a new diagram is not required for the bounded run-level hyperlink extension. |
| DATA_MODEL / conceptual ERD | `present_current` | Current logical document/evidence/conversion/release values plus explicit host-owned entities | The logical model is sufficient for Inkspan-owned state and evidence. |
| Physical relational ERD | `not_applicable` | `out_of_scope` while Inkspan owns no application database | Creating tables merely to satisfy an ERD checklist would falsify the product boundary. A physical ERD becomes mandatory only if an accepted decision moves persistence into Inkspan. |
| Security / Threat Model | `present_current` | Protected disclosure and runtime/supply-chain boundaries | Private reporting, bounded diagnostics, untrusted input, host authority, Office, browser, collaboration, package, and release threats are reconstructable. |
| Test Strategy | `present_current` | Protected deterministic, package, browser, Office, security, accessibility, and exact-coverage evidence | Evidence classes and claim limits remain separate from badges or model prose. |
| Operability / release / rollback | `present_current` | Protected release source path plus live operational prerequisites | Failure ownership, partial publication, rollback, and protected-main acceptance are documented. |
| Traceability / doctoring | `present_current` after this reconciliation | Protected standards-to-decision-to-test mapping | Current primary technical and standards bases are discoverable with bounded claim language. |
| Autonomous maintenance governance | `present_current` after this reconciliation | `out_of_scope` as Inkspan runtime behavior | Repository guidance now treats user-reported premature stopping as a scheduler-control incident, gives prompt/document-only work zero completion credit, requires continued repository execution, and keeps cadence authority external. |

## Material findings and GitHub remediation

### 1. Premature stopping was a control-plane defect, not repository completion

The repeated user correction that work remained is evidence that prior invocation exit selection was defective. A prompt edit or documentation assessment was being treated too much like a terminal artifact even though another safe repository lane existed.

The exact provider-side cause of each generic scheduled-task error is not observable from repository state, so this assessment does **not** invent a prompt-size, provider, permission, or runtime root cause. The repository-owned correction is narrower and testable:

- `AGENTS.md` and `CLAUDE.md` classify user-reported early termination as a `scheduler-control incident`;
- prompt edits, inventories, documentation-only changes, PR creation, review requests, queued checks, and local artifacts receive zero completion credit;
- when safe work exists after a redirection, the invocation completes at least two materially distinct executable repository actions, or executes the sole safe action and proves the remainder non-actionable through a fresh queue rebuild;
- either exit sweep finding work resets the two-sweep count; and
- repeated generic scheduler errors require a thinner external prompt whose durable product detail is delegated to this canonical GitHub graph.

The external scheduler still owns cadence and invocation execution. These repository instructions do not claim that scheduling is an Inkspan runtime feature.

### 2. The source-level stable-version mismatch is resolved; registry acceptance is not

The protected manifests agree at `0.6.0` through PR #135. The former npm `0.5.29` versus Office `0.1.0` source mismatch is therefore no longer an open design or source-preparation defect.

Registry operational acceptance remains open under issue #118. Source integration does not prove that `v0.6.0` exists, that GitHub Release publication succeeded, that npm and PyPI Trusted Publishers are configured, that both registries published the exact release artifacts, or that public artifact digests match release evidence. Those checks remain operational release evidence, not documentation or source-readiness evidence.

### 3. DOCX external hyperlinks are protected behavior and the decision record was stale

Protected `main` implements bounded external HTTP(S) hyperlinks for DOCX rich-text runs through PR #137. The merged contract preserves visible Unicode text and existing bold/italic/underline formatting under a relationship-backed `w:hyperlink`, accepts only a bounded printable-ASCII absolute HTTP(S) target subset, performs no network access, and leaves destination authorization, phishing policy, internationalized URI preparation, tenant policy, and distribution to hosts.

The implementation reached protected `main` while ADR 0026 and its index remained Proposed and described #137 as active. This reconciliation changes only documentation maturity and release notes; it does not broaden URI vocabulary or runtime authority. ADR 0026 becomes Accepted, the protected evidence is added to fitness and traceability, and the 0.6.0 source-candidate changelog records the feature.

## Whole-conversation coverage decision

The canonical graph covers the durable Inkspan decisions established through this project:

- Markdown/HTML WYSIWYG authoring and deterministic conversion;
- strict link, image, clipboard, document-envelope, revision, selection, and transition evidence boundaries;
- offline/local assets and font licensing;
- framework-neutral Markdown, autosave, revision, selector, and converter package surfaces;
- deterministic email and Office rendering;
- bounded DOCX figures, rich runs, paragraph alignment, heading alignment, and external hyperlinks;
- provider-neutral Yjs collaboration with host-owned provider, room, persistence, authorization, and awareness policy;
- SSR/native-form behavior and accessible editor/toolbar/placeholder/print semantics;
- naruon/CWL modular composition without a required runtime dependency;
- model assistance as an untrusted proposal;
- exact-head/live-base/check/review/release evidence separation;
- OIDC npm/PyPI release-source authority and partial-publication recovery; and
- work-conserving external autonomous maintenance without representing the scheduler as product runtime.

No material protected product-architecture decision identified by this reassessment remains only in chat. Registry publication and post-publication verification under issue #118 remain intentionally separate from protected-main source truth.

## Sufficiency decision

The ADR, PRD, TRD, Architecture, Contracts, UML, conceptual ERD/data model, Security, Threat Model, Test Strategy, Operability, release/rollback guidance, Traceability, contributor guidance, and APA-7 doctoring are **sufficient for acquisition reconstruction under the current Inkspan ownership boundary**.

This is not a claim that Inkspan is commercially complete, that 0.6.0 has been publicly released, that external scheduler failures are resolved, or that current protected source can reuse historical release evidence. Exact protected-main validation, registry operational acceptance, artifact provenance, buyer workflows, and future documentation reconciliation remain independent executable gates.

## Reassessment trigger

Repeat this assessment when any of the following changes materially:

- Inkspan assumes application-database, tenant, transport, credential, durable-audit, or collaboration-provider authority;
- a public document/evidence/package schema changes;
- an Office fidelity contract integrates or is superseded;
- the supported browser/runtime/release line changes;
- 0.6.0 is publicly published or partially published;
- the external autonomous-maintenance control contract changes; or
- a protected implementation contradicts a current canonical document.
