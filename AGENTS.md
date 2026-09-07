# AGENTS.md

## Package manager

- Use the checked-in pnpm version and lock: `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm coverage`, `pnpm build`, `pnpm verify:package`.
- Keep browser dependencies under their separate `tests/browser` lock; do not substitute another Playwright version during evidence collection.

## Commit attribution

- Preserve normal signed-off history and include accurate `Co-Authored-By` attribution for the assisting agent. Never invent a human reviewer or another agent's contribution.

## Maintainer field notes

- Update this file when completed work establishes a reusable repository-specific lesson. Keep rules concise; link detailed experiments from the existing owner PR and canonical documentation graph. Do not accumulate transient SHAs, run IDs, test counts, credentials, or scheduler snapshots here.
- Freeze source, dependency locks and commit identity during each acceptance acquisition. Record the exact head, packed artifact digest, command, configuration and terminal result; a new head needs new applicable evidence even when archive bytes match.
- Preserve failed attempts and distinguish focused diagnostics from full acceptance. A command after a failed `&&` stage did not run. Recover an expired process handle from logs without inventing an exit code. Under host contention, serialize this maintainer's heavy builds/tests; do not stop other owners' jobs or relax fixtures, deadlines or thresholds.
- Inspect the actual packed editor in its host composition, not only isolated controls. Open screenshots directly across the affected widths, browser engines and editable/read-only/forced-color states; check clipping, focus and document preservation. Geometry assertions alone do not establish visual, touch, IME, translation or full accessibility acceptance.
- Route a shared defect to its existing source owner before changing callers. Keep inherited stack repairs and previous evidence; do not duplicate a toolbar, clipboard, autosave or browser-teardown fix in another lane.
- Scope external agent scratch-registry ignores to the checkout root; verify both root exclusion and nested source/fixture visibility with `git check-ignore --no-index` before claiming the ignore boundary is correct.
- For intermittent browser teardown failures, capture request-start/finish/failure counts and outstanding requests before closing the page. Zero outstanding public requests does not prove internal network-idle state; do not blame open HMR sockets or remove the external-request guard without causal evidence.
- Before attributing browser failures to a modified installation, compare the pinned installed module with the exact registry artifact and upstream tag. Keep private state probes diagnostic-only; a reproduced state transition does not prove the original failing event sequence.
- Follow [release acceptance](https://github.com/ContextualWisdomLab/inkspan/issues/118) and the exact protected release workflow before automatic publication. Registered keys do not satisfy release gates. Inspect secret names and access metadata only; a denied organization-secret listing is not proof of absence. Preserve existing trusted-publishing/provenance policy rather than adding a token fallback, new registry or package solely because a key exists. Verify public artifact digests after publication.

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
