# Inkspan product-technical gap baseline

Status: Protected canonical operating baseline. Mutable lifecycle evidence must be
refetched at decision time; this document records durable product priorities and
ownership boundaries rather than a GitHub snapshot.

This baseline converts Inkspan's product boundary and acquisition-readiness
criteria into an executable maintenance queue. Protected `main` is the only
implementation authority for shipped-product claims. An open branch, pull
request, issue, workflow result, model output, or prose statement is evidence to
inspect, not proof that a capability shipped.

The research basis for buyer-gap prioritization remains
[`docs/doctoring/editor-product-completion-research.md`](doctoring/editor-product-completion-research.md).
Canonical product, technical, security, data, test, operability, and traceability
requirements remain in the documents indexed by [`docs/README.md`](README.md).

## Live-state rule

**Mutable GitHub state is intentionally not embedded** in this protected static
baseline. Exact branch SHAs, open/closed counts, PR draft/readiness state,
review verdicts, workflow run identifiers, dependency-alert counts, registry
versions, and current release identities can change without a documentation
commit. Copying them here as "current" truth creates an immediate stale-state
hazard after merge.

Before any merge, release, readiness, closure, or ownership decision, refetch at
least:

- the exact protected `main` tip and its independently resolved ancestry;
- all open pull requests and their exact heads and live bases;
- all open issues relevant to the candidate change;
- changed paths and active source writers;
- formal reviews and unresolved review threads;
- required status checks, workflow runs, workflow jobs and checkout SHAs;
- repository and organization rulesets plus applicable branch protection;
- dependency, security, SAST, coverage, browser, Office, package, SBOM,
  provenance, reproducibility, rollback, and operational evidence;
- tags and releases, followed by public registry state when publication is in
  scope.

Pending, queued, skipped, cancelled, absent, neutral, failed, stale,
predecessor, status-only, model-only, wrong-checkout, or synthetic-merge-only
evidence is non-passing. A successful aggregate status is not sufficient when
the underlying job consumed the wrong repository revision or skipped a required
path.

The preferred live inventory is bounded and machine-readable. For example:

```bash
set -euo pipefail

gh api repos/ContextualWisdomLab/inkspan/branches/main --jq '.commit.sha'
gh api --paginate \
  'repos/ContextualWisdomLab/inkspan/pulls?state=open&per_page=100' \
  --jq '.[] | [.number,.draft,.head.ref,.head.sha,.base.ref,.base.sha,.updated_at] | @tsv'
gh api --paginate \
  'search/issues?q=repo%3AContextualWisdomLab%2Finkspan+is%3Aissue+state%3Aopen&per_page=100' \
  --jq '.items[] | [.number,.title,.updated_at] | @tsv'
gh api repos/ContextualWisdomLab/inkspan/rulesets --paginate \
  --jq '.[] | [.id,.name,.enforcement,.target] | @tsv'
gh release list --repo ContextualWisdomLab/inkspan --limit 10
```

For each candidate pull request, separately resolve changed files, reviews,
review threads, current-head checks, workflow jobs, checkout SHAs, and the live
base. Do not infer those facts from this document or from a PR description.

## Durable product and ownership boundary

Inkspan owns standalone deterministic Markdown/HTML authoring plus its
document/Office component boundary. That includes document and revision
semantics, local evidence and autosave coordination, accessibility behavior,
package behavior, deterministic conversion and Office rendering,
provider-neutral adapters, and CSS/presentation behavior accepted by the
canonical contracts.

The embedding host owns authenticated transport, authentication and
authorization, tenant isolation, durable persistence, credentials, migrations,
retention, deployment, durable audit, Yjs/provider authority, model policy, and
durable PDF authority unless an accepted versioned contract explicitly moves a
boundary. Standalone Inkspan must require no service, database, network,
credential, or model. Model output is untrusted proposal data.

These are deliberate non-gaps unless a new buyer requirement and accepted
contract move ownership:

- application databases, tenant schemas, migrations, durable audit stores, and
  retention systems;
- credential stores, authentication systems, authorization policy engines, and
  transport services;
- collaboration-provider tenancy and durable Yjs authority;
- model routing, prompt policy, provider credentials, and model-side durable
  state;
- durable PDF services beyond the accepted CSS paged-media/print boundary;
- unrelated psychometrics, Rust/GPU, orchestration, or data-platform runtime
  concerns.

## Commercial and acquisition readiness priorities

### P0 — safely installable and releasable product

The stable-release lane remains the highest priority until one exact integrated
protected lineage proves the applicable release contract end to end. The live
owner issue and existing source writers must be refetched before action; this
baseline does not duplicate them.

Acceptance requires, on one unchanged protected tip:

- source version and release metadata alignment;
- deterministic editor and Office builds from immutable dependencies;
- 100% repository-required coverage and documentation gates;
- packed-package consumer verification rather than source-relative success;
- dependency-locked Chromium, Firefox, and WebKit evidence where applicable;
- accessibility and deterministic Office/fidelity evidence;
- security, SAST, dependency, package, SBOM, provenance, reproducibility,
  rollback, and operational gates required by then-live governance;
- qualifying formal independent review under then-live rules;
- release artifacts built only from that exact protected source;
- public registry bytes and digests matching the accepted release artifacts.

Never construct release identity from a branch ref, transfer predecessor checks,
or treat a registry/version string as proof of publication.

### P1 — buyer workflow completeness

After P0 blockers and independent non-conflicting lanes permit, prioritize:

1. provider-neutral comments, suggestions, review targets, and revision-scoped
   proposal acceptance without moving identity or persistence into Inkspan;
2. measured large-document latency/memory support envelopes with realistic
   fixtures and deterministic failure behavior;
3. CJK IME, touch, and mobile editing assurance with truthful real-device versus
   emulated support claims;
4. an executable packed-package reference host proving SSR/hydration, native
   forms, autosave conflict recovery, host-owned collaboration lifecycle,
   read-only transitions, delayed untrusted proposal handling, and teardown;
5. deterministic Office/import breadth only through existing format-specific
   owners and bounded parsing/rendering contracts.

Each capability remains unshipped until its source, tests, documentation, and
applicable exact-head governance evidence are integrated into protected `main`.

### P2 — acquisition evidence quality

Strengthen evidence that reduces buyer diligence risk without enlarging the
runtime boundary:

- executable traceability from PRD/TRD/contracts/ADRs to source and tests;
- explicit support matrices and known limitations;
- privacy-safe diagnostics and recovery behavior;
- package provenance, license/SBOM completeness, and reproducible artifacts;
- accessibility evidence across keyboard, forced-colors, print, narrow viewport,
  and real browser engines;
- clear rollback and incident paths for ambiguous publication or persistence
  outcomes.

## Source-writer discipline

Before every mutation, refetch the candidate head/base, changed paths, formal
reviews, unresolved threads, checks, and active writers. Prefer the existing
canonical PR/branch and earliest dependency-root owner. Never create a competing
source writer for an already-owned path.

If the first causal defect is owned by a foreign repository or central control
plane, do not patch around it in Inkspan. Advance the existing owner path with
exact affected SHAs/runs/jobs, a reproducible failure, falsifiable RCA, smallest
remedy, GREEN acceptance, and Inkspan-side revalidation. Waiting on that lane
does not block independent Inkspan work.

## Contradiction and failure handling

A known contradiction is actionable. Capture exact evidence, identify the first
causal boundary and conflicting propositions, formulate a falsifiable root-cause
hypothesis, compare materially distinct remedies, execute the smallest safe
causal action, establish RED/contract evidence, obtain focused and full GREEN,
then refetch the exact head and downstream state.

False-green states are defects at the owner that generated them. This includes
wrong checkout SHAs, stale-base assumptions, vacuous coverage, skipped required
paths, malformed dispatch, predecessor-run selection, synthetic source findings
caused by infrastructure/model failure, and contradictory scanner
classifications.

## Release and closure rule

Only then-live protected source and governance define release acceptance. Before
publication, refetch protected source, canonical release workflow, versions,
CHANGELOG, tags/releases, reviews/threads, every required workflow and job, and
all artifact/provenance evidence. If the supported release mutation authority is
not available, classify only that exact mutation as unavailable and continue
other safe work; never emulate a tag or release by moving a branch ref.

Issues close only when their acceptance criteria are proven against the relevant
protected source and public artifacts. Pull-request body text, local-only tests,
queued jobs, predecessor evidence, model verdicts, or synthetic merge results do
not satisfy that rule.
