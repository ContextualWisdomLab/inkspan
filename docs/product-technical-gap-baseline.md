# Inkspan product-technical gap baseline

Status: Dated operational baseline — 2026-08-21; live snapshot refetched after `2026-08-21T03:19:27Z`

This record turns the current protected-main product boundary, live pull-request
queue, release evidence, and buyer-visible gaps into an executable maintenance
queue. It is a snapshot, not a substitute for refetching GitHub state before a
merge, release, or governance decision. Protected `main` remains the
implementation authority; an active PR or Issue is not a shipped capability.

The research basis for the buyer-gap additions is
[`docs/doctoring/editor-product-completion-research.md`](doctoring/editor-product-completion-research.md).
It distinguishes protected evidence, active-PR evidence, standards, and vendor
market evidence and includes APA 7th references.

## Source of truth and observed baseline

| Fact | Current evidence | Meaning |
| --- | --- | --- |
| Protected source | `main@3b38ead2d00f44eb578d0689087b9293b3dabe1e` | The only source head used for shipped-product claims. |
| Repository state | `ContextualWisdomLab/inkspan`, default branch `main` | This is the correct repository for Inkspan-owned editor, conversion, evidence, accessibility, package, and provider-neutral adapter work. |
| Open PR queue | Complete bounded inventory: 64 open PRs, 3 Ready and 61 Draft; 10 target non-main stack bases | The queue is active work, not protected implementation. Refetch immediately before lifecycle action. |
| Current source versions | npm `0.6.0`; Office manifest `0.6.0` | Version alignment exists in source, but it does not prove registry publication. |
| Public release evidence | The last observed GitHub release was `v0.3.1`; no protected `v0.6.0` publication/digest acceptance was established; the live npm probe returned registry `E404` and the PyPI probe returned no matching `inkspan-office` distribution | Stable `0.6.0` publication remains an operational gap until freshly reverified. |
| Protected governance | Active central required-workflow policy and review requirements were observed in the release baseline | No self-approval, predecessor-evidence transfer, or governance bypass is valid. Live rules and permissions must be refetched. |
| Main checks | The current exact protected-main `build-and-test`, Office Python 3.11, and Chromium/Firefox/WebKit checks are terminal success | Protected-main checks do not transfer to active PR heads or prove registry publication. |
| Protected-main dependency alerts | Five Dependabot alerts are open across `brace-expansion`, `postcss`, and `fast-uri`; PR #373 targets the relevant patched floors and the audited `nanoid` tree | The alert state is not closed until the exact PR is reviewed, integrated, and rechecked on protected `main`. |

The queue, release, registry, alert, and governance values are mutable. Refresh
with bounded queries instead of copying this snapshot into a lifecycle decision:

```bash
gh api --paginate \
  'repos/ContextualWisdomLab/inkspan/pulls?state=open&per_page=100' \
  --jq '.[] | [.number,.title,.draft,.head.ref,.base.ref,.updated_at] | @tsv'
gh api --paginate \
  'repos/ContextualWisdomLab/inkspan/pulls?state=open&per_page=100' \
  --jq '[.[] | {draft}] | {open:length,ready:(map(select(.draft == false)) | length),draft:(map(select(.draft == true)) | length)}'
gh api repos/ContextualWisdomLab/inkspan/branches/main --jq '.commit.sha'
gh release list --repo ContextualWisdomLab/inkspan --limit 5
registry_npm_output="$(npm view @contextualwisdomlab/cwl-editor version 2>&1)"
registry_npm_status=$?
if [ "$registry_npm_status" -eq 0 ]; then
  printf '%s\n' "$registry_npm_output"
elif printf '%s\n' "$registry_npm_output" | grep -q 'E404\|404 Not Found'; then
  printf '%s\n' "$registry_npm_output"
else
  printf '%s\n' "$registry_npm_output" >&2
  exit "$registry_npm_status"
fi
registry_pypi_output="$(python3 -m pip index versions inkspan-office 2>&1)"
registry_pypi_status=$?
if [ "$registry_pypi_status" -eq 0 ]; then
  printf '%s\n' "$registry_pypi_output"
elif printf '%s\n' "$registry_pypi_output" | grep -q 'No matching distribution'; then
  printf '%s\n' "$registry_pypi_output"
else
  printf '%s\n' "$registry_pypi_output" >&2
  exit "$registry_pypi_status"
fi
gh api repos/ContextualWisdomLab/inkspan/dependabot/alerts \
  --jq '.[] | select(.state == "open") | [.number,.dependency.package.name,.security_advisory.severity,.security_vulnerability.first_patched_version.identifier] | @tsv'

candidate_prs=(362 372 373 318 320 378 379 380 381 382)
for pr_number in "${candidate_prs[@]}"; do
  pr_json="$(gh api "repos/ContextualWisdomLab/inkspan/pulls/$pr_number")"
  head_sha="$(printf '%s\n' "$pr_json" | jq -r '.head.sha')"
  printf '%s\n' "PR #$pr_number head=$(printf '%s\n' "$pr_json" | jq -r '.head.sha') base=$(printf '%s\n' "$pr_json" | jq -r '.base.sha')"
  gh api "repos/ContextualWisdomLab/inkspan/pulls/$pr_number/files?per_page=100" \
    --jq '.[].filename'
  gh api "repos/ContextualWisdomLab/inkspan/pulls/$pr_number/reviews?per_page=100" \
    --jq '.[] | [.state,.user.login,.submitted_at] | @tsv'
  gh api "repos/ContextualWisdomLab/inkspan/commits/$head_sha/check-runs?per_page=100" \
    --jq '.check_runs[] | [.name,.status,.conclusion] | @tsv'
  gh api graphql \
    -f query='query($owner:String!, $name:String!, $number:Int!) { repository(owner:$owner, name:$name) { pullRequest(number:$number) { reviewThreads(first:100) { nodes { isResolved path line } } } } }' \
    -F owner=ContextualWisdomLab -F name=inkspan -F number="$pr_number" \
    --jq '.data.repository.pullRequest.reviewThreads.nodes[] | [.isResolved,.path,.line] | @tsv'
done
gh api repos/ContextualWisdomLab/inkspan/rulesets --paginate \
  --jq '.[] | [.id,.name,.enforcement,.target] | @tsv'
```

For every candidate PR, independently refetch its exact head/base, changed
paths, formal reviews, unresolved threads, current-head workflows, and then-live
organization rules. A PR body is not authority for those mutable facts.

## Product and ownership boundary

Inkspan currently owns deterministic Markdown/HTML authoring, bounded document
and evidence contracts, local autosave coordination, accessibility metadata,
safe conversion, the standalone package boundary, and provider-neutral
adapters. The embedding host owns authenticated transport, authentication and
authorization, tenant isolation, durable persistence, credentials, migrations,
retention, deployment, durable audit, collaboration-provider authority, and
model-use policy. This boundary is implemented in the canonical PRD, TRD,
contracts, architecture, threat model, and data model.

The following are deliberate non-gaps, not reasons to add speculative runtime
surface:

- Inkspan owns no application database, so a physical ERD, database migrations,
  third-normal-form tables, and hot-partition policy remain host deliverables.
  If persistence authority moves into Inkspan, add a versioned ADR, logical and
  physical ERD, migration/rollback evidence, and a partitioning test before
  implementation.
- Inkspan is not a psychometrics, mathematical-science, or model-orchestration
  runtime. Rust/GPU execution, multi-level or longitudinal estimation, and
  contextual-orchestrator model routing are not valid gap closures for this
  product boundary. Add them only after a buyer requirement and a measured
  Inkspan-owned computation boundary exist.
- PII handling remains a host-governed privacy and authorization decision.
  Moving credentials, tenant identifiers, authored content, comment bodies, or
  model prompts into public editor evidence would violate the existing security
  boundary rather than close a product gap.
- Accepted ADR 0021 deliberately limits protected Inkspan to its CSS paged-media
  and print-fidelity boundary. A durable PDF service is not a gap unless a
  separate buyer requirement and superseding ADR establish that authority.
- Existing active owners already cover DOCX, HWP/HWPX, spreadsheet import,
  writing diagnostics, release workflow, and stacked-PR CI. Duplicate Issues or
  PRs for those source boundaries would increase conflict rather than completion.

## Current PR and release lanes

| Lane | Current authority | Buyer impact | Gate / next action |
| --- | --- | --- | --- |
| [PR #362](https://github.com/ContextualWisdomLab/inkspan/pull/362) — editor contrast and keyboard focus | Ready active PR; exact head `11d5cfecdcc0949ec98e6ca110d482124bff00c4` at the latest refetch | Protected dark active-toolbar text is below the intended WCAG normal-text target, and the editable surface lacks a replacement focus indicator. | Current exact-head checks have 22 successful completions and a failed `strix` gate. Qualifying independent approval and applicable formal/central review evidence also remain absent. Do not dismiss the security finding, duplicate review requests, or self-approve. |
| [PR #373](https://github.com/ContextualWisdomLab/inkspan/pull/373) — patched transitive dependency floors | Ready active PR; exact head `41f978853629c3bed8ef5393f685053b24322490` at the latest refetch | Buyers need a clean, reproducible dependency audit without moving transport, credential, or runtime authority into Inkspan. | Current exact-head checks have 22 successful completions and `opencode-review` pending, with no completed failure observed in the check-run set. No qualifying current-head approval was observed; queued evidence is not passing evidence. Refetch all then-live central/review gates before integration. |
| [PR #372](https://github.com/ContextualWisdomLab/inkspan/pull/372) — product-technical gap baseline | Ready active documentation PR | Buyers and maintainers need one evidence-backed view of shipped boundaries, release readiness, and the next credible product closures. | This document is its own writer, so an embedded current-head SHA or workflow run would become stale on every update. Evaluate only the live PR head returned by GitHub after the final commit, then require exact-head checks, formal review, and live governance. Predecessor #372 checks do not transfer after this update. |
| [Issue #118](https://github.com/ContextualWisdomLab/inkspan/issues/118) — stable release acceptance | Open release issue | Buyers cannot install and verify the protected `0.6.0` artifact through the promised release path. | Integrate the release-blocking product and workflow owners in dependency order, regenerate exact protected evidence, create the supported release identity, and verify public npm/PyPI bytes and provenance. |
| [PR #285](https://github.com/ContextualWisdomLab/inkspan/pull/285) — hostile-input/browser/release assurance | Draft, stacked on writing diagnostics | Release browser evidence has a known finite-time admission defect and the branch proposes a package-specific SBOM inventory. | Do not duplicate `.github/workflows/release.yml` ownership. Advance its stack only through exact-head evidence; treat its proposed inventory as non-authoritative until protected. |
| [PR #299](https://github.com/ContextualWisdomLab/inkspan/pull/299) — exact-head gates for stacked PRs | Draft, targets protected `main` | Stacked work can otherwise receive no repository PR generation or evidence that proves the contributor head. | Resolve its current-head workflow and review gates, then require each child stack head to obtain its own exact evidence. |
| [PR #323](https://github.com/ContextualWisdomLab/inkspan/pull/323), [#320](https://github.com/ContextualWisdomLab/inkspan/pull/320), [#318](https://github.com/ContextualWisdomLab/inkspan/pull/318) — Office imports | Draft feature lanes | Word, HWP/HWPX, and spreadsheet import broaden buyer workflows but are not shipped. | Keep one format/source owner at a time; require bounded deterministic conversion, realistic fixtures, privacy-safe diagnostics, and exact packed-package evidence before Ready. |
| [PR #378](https://github.com/ContextualWisdomLab/inkspan/pull/378) / [#382](https://github.com/ContextualWisdomLab/inkspan/pull/382) — review contract and controlled UI | Draft owners for Issue #374; latest observed heads `670356c80820ddedce22cabd22332bab22524045` and `b121431e00cd429e02cacdd0a966135c11451faa` | Buyers need provider-neutral review targets/proposals and an accessible host-controlled presentation without moving annotation identity, persistence, or model authority into Inkspan. | Keep the React-free package contract and controlled UI as separate owned lanes; require exact-head package, accessibility, browser, review, and governance evidence before lifecycle changes. |
| [PR #379](https://github.com/ContextualWisdomLab/inkspan/pull/379), [#380](https://github.com/ContextualWisdomLab/inkspan/pull/380), [#381](https://github.com/ContextualWisdomLab/inkspan/pull/381) — performance, CJK/mobile, and reference host | Draft owners for Issues #375–#377; latest observed heads `a838dbefb3a410d9899985ae1f011e71af3a9c3d`, `c56ce124ea8522e442a9251986c4ffe8028712b8`, and `4b211fedd5086a749d03a0413604f94819903a95` | Buyers need measurable large-document behavior, truthful multilingual/mobile input assurance, and a packed-artifact integration path that preserves host ownership. | Keep each evidence lane independent; do not infer support, mobile, or production integration from synthetic fixtures or a Draft branch. Require the acceptance matrices and exact-head checks named by each Issue. |
| [Issues #374](https://github.com/ContextualWisdomLab/inkspan/issues/374), [#375](https://github.com/ContextualWisdomLab/inkspan/issues/375), [#376](https://github.com/ContextualWisdomLab/inkspan/issues/376), [#377](https://github.com/ContextualWisdomLab/inkspan/issues/377) — new buyer completion verticals | Open Issues; no implementation PR is claimed | Review workflow, large-document support, CJK/mobile input assurance, and a reference host are missing from protected product evidence. | Execute only after confirming no current source owner conflicts. Each Issue defines its ownership boundary, acceptance evidence, and relationship to the P0 release lane. This documentation PR does not close them. |

The remaining open PRs are mostly independent reliability, security,
accessibility, documentation, import, and diagnostics lanes. They must be
processed by existing source ownership and dependency order. A Draft label is
not a reason to merge, and a blocked lane is not a reason to stop unrelated safe
work.

## Research-backed prioritization

The detailed comparison and APA 7th references are in
[`docs/doctoring/editor-product-completion-research.md`](doctoring/editor-product-completion-research.md).
The resulting order is:

1. **P0 — make the current product safely installable:** #118, #362, #373, the
   existing release-workflow owner, and exact-head stacked-PR governance.
2. **P1 — complete the buyer workflow:** #374 review/comments/suggestions,
   #375 performance envelope, #376 CJK/IME/mobile assurance, and #377 an
   executable packed-package reference host.
3. **P2 — broaden formats and optional product surfaces:** existing Office
   imports and the existing writing-diagnostics stack, dependency-first and
   without duplicating authority.

The P1 Issues are deliberately separate because they can be reviewed and
measured independently. They should stack only where a real public contract or
source dependency requires it.

## Gap register

| ID | Buyer-visible gap | Protected-main status | Smallest credible closure |
| --- | --- | --- | --- |
| G-01 | Default editor accessibility release blocker | `planned` / active PR #362 | Obtain fresh same-head governance evidence, an eligible approval, and terminal required workflows; integrate only the current head and regenerate protected release evidence. |
| G-02 | Stable registry publication and public artifact verification | `planned`, tracked by #118 | Use the protected release workflow and OIDC Trusted Publishing; verify exact npm/PyPI bytes and provenance after publication. |
| G-03 | Release browser admission reliability | `implemented_on_active_pr` in #285 | Keep browser evidence mandatory while increasing only the bounded job ceiling through its owning stack; verify the exact packed artifact across Chromium, Firefox, and WebKit. |
| G-04 | Stacked-PR exact-head governance | `implemented_on_active_pr` in #299 | Make workflow dispatch and checks prove the contributor head/base pair, then refetch current runs and review evidence for each child. |
| G-05 | Design-system discovery for repeating editor chrome | `implemented_on_active_pr` in #362 / ADR 0031 | Integrate the typed token catalog and Storybook inventory only after accessibility, package, and documentation checks pass. Protected main currently has no Storybook inventory. |
| G-06 | Broader deterministic Office import | `planned` / Draft PRs #323, #320, #318 | Close one bounded format contract at a time with realistic fixtures, fail-closed limits, package consumers, and supported-runtime evidence. |
| G-07 | Acquisition evidence freshness | `partial` | Refresh this dated baseline and canonical doctoring after every protected merge, release decision, or external control-plane change; never encode mutable run IDs as timeless architecture. |
| G-08 | Patched transitive development-tool dependency floor | `implemented_on_active_pr` in #373 | Preserve the narrow overrides and realpath containment fix, obtain qualifying review/live gates, integrate, then verify alerts are closed on protected main. |
| G-09 | Provider-neutral review, comments, suggestions, and revision comparison | `missing`, tracked by [#374](https://github.com/ContextualWisdomLab/inkspan/issues/374) | Add a React-free bounded review contract plus accessible host-controlled presentation and deterministic revision-bound accept/reject; do not acquire annotation persistence or identity authority. |
| G-10 | Large-document latency, memory, and graceful-rejection support envelope | `missing`, tracked by [#375](https://github.com/ContextualWisdomLab/inkspan/issues/375) | Build deterministic multilingual/Office fixtures, measure trusted operations, accept budgets by ADR, and gate material regressions without exposing document content. |
| G-11 | CJK IME, touch, and mobile editing assurance | `missing`, tracked by [#376](https://github.com/ContextualWisdomLab/inkspan/issues/376) | Specify composition semantics; test Korean/Japanese/Chinese/Vietnamese and collaboration/autosave interactions across engines; add periodic real-device evidence and a truthful support matrix. |
| G-12 | Executable production-shaped reference integration | `missing`, tracked by [#377](https://github.com/ContextualWisdomLab/inkspan/issues/377) | Install the packed artifact into a Next.js reference host and prove SSR/hydration, native forms, strong-validator autosave, conflict recovery, Yjs lifecycle, stale proposals, CSS/fonts, and teardown without claiming host services. |

## Figma and Storybook boundary

The active design-token ADR rejects Figma Variables synchronization as Inkspan
runtime or credential authority and keeps CSS as the runtime source of truth.
This baseline therefore does not invent a Figma file or claim a Figma
integration. If an accepted buyer-facing design artifact becomes required, use
Figma for that design work and record the actual Figma File ID in the accepting
ADR before calling the design contract complete.

Storybook remains a local component-preview and executable-evidence surface, not
a production transport or source of document authority. The review, mobile, and
reference-host Issues require Storybook or equivalent executable states only
where those states improve reviewability and accessibility evidence.

## Autonomous execution loop

At each external scheduler interval:

1. Refetch protected `main`, the full open-PR/Issue queue, exact heads and bases,
   changed paths, reviews, unresolved threads, required workflows, security
   findings, release/tag/registry state, documentation fitness, and buyer gaps.
2. For each actionable PR, inspect current findings, apply the smallest
   root-cause fix in its owned branch, rerun applicable checks, and merge only
   after current governance authorizes it. Keep review latency and queued checks
   local to that lane.
3. If the queue has no actionable PR, execute the highest-value unclaimed Gap
   above with a real test/runtime proof and the smallest canonical-document
   update required by the durable contract.
4. Run two fresh whole-repository sweeps before stopping. A newly executable
   item resets the sweep count. A prompt update, status report, documentation
   assessment, or queued check is intermediate work, not completion.

This loop is control-plane governance, not an Inkspan runtime feature. The
external scheduler owns cadence; Inkspan owns only the product and evidence
boundaries documented in the canonical graph.

## Verification limits

This snapshot supports queue selection on 2026-08-21 only. Before any merge or
release, re-read `docs/README.md`, `docs/PRD.md`, `docs/TRD.md`,
`docs/CONTRACTS.md`, `ARCHITECTURE.md`, relevant ADRs, current source/tests, the
research doctoring record, exact GitHub heads/checks/reviews, and live
governance. Cite new standards and research in the existing APA 7th doctoring
and traceability surfaces. Never use a model response, PR prose, predecessor
checks, a queued workflow, or local green tests as a substitute for exact
protected-main proof.
