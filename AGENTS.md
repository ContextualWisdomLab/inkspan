# AGENTS.md

## Canonical product and architecture authority

Protected `main` is Inkspan's implementation authority. Before changing product behavior, public contracts, architecture, security boundaries, tests, release behavior, or integration guidance, start from `docs/README.md` and keep `docs/PRD.md`, `docs/TRD.md`, and `docs/CONTRACTS.md` aligned with the current implementation and accepted ADRs.

Inkspan owns deterministic editor/conversion behavior, versioned document/evidence contracts, local autosave coordination, accessibility metadata, package behavior, and provider-neutral adapters. Hosts retain transport, authentication, authorization, tenant isolation, durable persistence, credentials, migration execution, retention, deployment, durable audit, collaboration-provider authority, and model-use policy unless an accepted versioned contract explicitly changes that boundary.

Do not infer shipped behavior from conversation history, PR bodies, model output, or predecessor-head evidence. Keep Proposed/Active-PR behavior distinct from implementation on Protected `main`, preserve fail-closed security and deterministic conversion boundaries, and update the smallest affected canonical documents plus tests when a durable contract changes.

## Autonomous maintenance execution discipline

When an external scheduler or autonomous maintainer is operating on Inkspan, repository work is **work-conserving**: after every mutation, proof, merge, closure, review/check observation, or defer decision, select the next highest-value safe Inkspan action while practical execution budget remains. A blocked PR blocks only that lane; queued CI, reviewer latency, provider cooldown, a read-only dependency, or missing approval must not freeze unrelated work.

A status report, prompt update, documentation assessment, green check, PR creation, review request, or one completed product slice is an intermediate result rather than repository completion while another safe action exists. Before ending an autonomous run, perform two fresh whole-repository sweeps across open PRs/issues, protected `main`, changed branches, reviews/checks/security findings, documentation fitness, release evidence, and buyer-visible gaps. If either sweep finds an executable item, execute it and reset the two-sweep count.

### User-redirection and scheduler-control incident rule

If the user says that work stopped early, that other work remained, or that the prompt must be updated because execution ended prematurely, treat that statement as a **scheduler-control incident** rather than a request for another status recap. A prompt edit, inventory, documentation-only change, PR creation, review request, queued check, or local artifact receives zero completion credit.

After repairing the control instruction when needed, immediately rebuild the live Inkspan queue and continue repository execution in the same invocation. When safe work exists, complete at least **two materially distinct executable repository actions** before considering termination. If exactly one safe action exists, execute it and then prove through a fresh queue rebuild that every other lane is currently non-actionable under the writer lease, dependency order, repository policy, and safety constraints.

When a generic scheduled-task error or repeated missed run suggests prompt-size or control-plane fragility, keep detailed product truth in the canonical GitHub documentation graph and simplify the external prompt instead of appending historical snapshots. Scheduler failure is local operational debt; it is never evidence that Inkspan product work is complete.

The external scheduler remains the execution authority for cadence and run continuation. These repository instructions define Inkspan-specific writer, evidence, product, and safety discipline only; they do not make scheduling or autonomous orchestration an Inkspan runtime capability.

## Code-owner review gates — disabled (on hold)

As of 2026-08-04, code-owner review requirements (`require_code_owner_reviews` in branch
protection, `require_code_owner_review` in rulesets) are disabled across the ContextualWisdomLab
org: there is a single maintainer (solo developer), so a code-owner approval gate can never be
satisfied. This is ON HOLD until the org has multiple maintainers — do NOT re-enable these
settings or add CODEOWNERS-based merge gates before then.
