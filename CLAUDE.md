# CLAUDE.md

## Repository authority

Protected `main` is Inkspan's implementation authority. Start architecture, product, interface, security, testing, and operability work from the canonical graph in `docs/README.md`; in particular, keep `docs/PRD.md`, `docs/TRD.md`, and `docs/CONTRACTS.md` aligned with shipped behavior and accepted ADRs rather than reconstructing product intent from conversations or pull-request prose.

## Product boundary

Inkspan owns deterministic Markdown/HTML authoring and conversion behavior, versioned document/evidence contracts, local autosave coordination, accessibility metadata, package behavior, and provider-neutral adapters. The embedding host owns authenticated transport, authorization, tenant isolation, durable persistence, credentials, migration execution, retention, deployment, durable audit, collaboration-provider authority, and model-use policy unless an accepted versioned contract explicitly changes that boundary.

Keep deterministic conversion separate from model-assisted authoring. Model output is an untrusted proposal and cannot bypass editor/document/clipboard/Office validation, host authorization, user approval, or durable concurrency controls.

## Security and reliability invariants

- Preserve strict fail-closed handling for untrusted clipboard HTML, links, image sources, document envelopes, Office structures, host callbacks, collaboration updates, and model proposals.
- Office rendering remains network-free, macro-free, model-free, Desktop-Office-free, bounded, formula-injection-safe, and race-safe at publication.
- Local SHA-256 document revisions are equality evidence, not authorization, signatures, tenant identity, server time, or durable-write receipts.
- Host/server-selected strong validators remain the durable compare-and-swap authority.
- Do not place credentials, complete document bodies, tenant identifiers, prompts/model output, durable validators, or private exception causes into generic diagnostics or telemetry.
- Do not move transport, persistence, tenancy, credential, retention, provider, or deployment ownership into Inkspan merely to make a local feature or test easier.

## Change and evidence discipline

Use test-first changes for product behavior and permanent contracts where practical. Preserve exact owned production statement/branch/function/line coverage and public-docstring requirements enforced by repository CI. Validate public package behavior from packed artifacts, not source imports alone.

For architectural changes, update the smallest affected canonical records and ADRs. Keep status language explicit: implemented on protected main, active PR/proposed, accepted architecture, planned, research only, superseded, or out of scope.

A queued, pending, cancelled, skipped-required, stale-head, predecessor-head, status-only, comment-only, author-only, or synthetic-merge result is not acceptance evidence. Formal review, automated review, repository checks, host authorization, and release evidence remain distinct authorities.

## Autonomous maintenance execution discipline

When an external scheduler or autonomous maintainer drives Inkspan work, execution is **work-conserving**. After each mutation, proof, merge, closure, review/check observation, or defer decision, choose the next highest-value safe Inkspan item while practical execution budget remains. A blocked PR blocks only that lane; do not let queued CI, reviewer latency, provider cooldown, a read-only dependency, or missing approval freeze unrelated source, documentation, operability, or product work.

Do not use a status report, prompt update, documentation assessment, green check, PR creation, review request, or one completed product slice as a stopping condition while another safe action exists. Before ending an autonomous run, re-scan open PRs/issues, protected `main`, changed branches, review/check/security evidence, canonical-document fitness, release readiness, and buyer-visible gaps; continue when an executable item remains.

The external scheduler remains the execution authority for cadence and continuation. This file constrains repository-specific writer/evidence/product/safety behavior and does not make scheduling or autonomous orchestration part of Inkspan runtime architecture.

## Integration discipline

Inkspan must remain independently usable. naruon and other CWL hosts compose it through narrow host-owned boundaries; they are not required runtime dependencies. Central `.github`, contextual-orchestrator, and other repositories are external bounded contexts and must not be locally patched around when they own a shared control-plane defect.

Before changing public behavior, inspect `docs/README.md`, `docs/PRD.md`, `docs/TRD.md`, `docs/CONTRACTS.md`, `ARCHITECTURE.md`, the relevant ADRs, and current tests. Prefer the smallest root-cause-changing change with explicit rollback and compatibility evidence.
