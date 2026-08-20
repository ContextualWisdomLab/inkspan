# Inkspan product-technical gap baseline

Status: Dated operational baseline — 2026-08-20; live snapshot refetched at `2026-08-20T11:38:14Z`

This record turns the current protected-main product boundary, live pull-request
queue, release evidence, and buyer-visible gaps into an executable maintenance
queue. It is a snapshot, not a substitute for refetching GitHub state before a
merge, release, or governance decision. Protected `main` remains the
implementation authority; an active PR is not a shipped capability.

## Source of truth and observed baseline

| Fact | Current evidence | Meaning |
| --- | --- | --- |
| Protected source | `main@3b38ead2d00f44eb578d0689087b9293b3dabe1e` | The only source head used for shipped-product claims. |
| Repository state | `ContextualWisdomLab/inkspan`, default branch `main` | This is the correct repository for Inkspan-owned editor, conversion, evidence, accessibility, package, and provider-neutral adapter work. |
| Open PR queue | 59 open PRs from the REST pull-request endpoint; 3 Ready and 56 Draft at the refetch above | The queue is active work, not protected implementation. |
| Current source versions | npm `0.6.0`; Office manifest `0.6.0` | Version alignment exists in source, but it does not prove registry publication. |
| Public release evidence | Latest GitHub release is `v0.3.1`; no `v0.6.0` release is present; public npm lookup for `@contextualwisdomlab/cwl-editor` returns `404` | Stable `0.6.0` publication remains an operational gap. |
| Protected governance | Active `CWL Central required workflows` ruleset; one approval, last-push approval, resolved review threads, and required workflows | No self-approval or governance bypass is valid. Code-owner review is disabled by policy. |
| Main checks | Latest protected-main CI run `31996429786` is terminal success: `build-and-test`, Office Python 3.11, and Chromium/Firefox/WebKit evidence all completed successfully | This does not transfer to active PR heads or prove release publication. |
| Protected-main dependency alerts | Four Dependabot alerts remain open for `fast-uri` and `postcss`; PR #373 targets the patched floors and also repairs the audited `nanoid` tree | Security status remains open until the exact PR is reviewed, checks pass, and the protected merge is verified. |

The queue count and status must be refreshed with:

```bash
gh api --paginate \
  'repos/ContextualWisdomLab/inkspan/pulls?state=open&per_page=100' \
  --jq '.[] | [.number,.title,.draft,.head.ref,.base.ref,.updated_at] | @tsv'
gh api --paginate \
  'repos/ContextualWisdomLab/inkspan/pulls?state=open&per_page=100' \
  --jq '[.[] | {draft}] | {open:length,ready:(map(select(.draft == false)) | length),draft:(map(select(.draft == true)) | length)}'
```

The mutable values in the table were refetched with these bounded queries
(`main` and the ruleset query use immutable identifiers in the result):

```bash
gh api repos/ContextualWisdomLab/inkspan/branches/main --jq '.commit.sha'
gh api repos/ContextualWisdomLab/inkspan/rulesets/18156473 \
  --jq '{id,name,enforcement,target}'
gh api 'repos/ContextualWisdomLab/inkspan/commits/3b38ead2d00f44eb578d0689087b9293b3dabe1e/check-runs?per_page=100' \
  --jq '.check_runs[] | select(.name == "build-and-test" or .name == "Office / Python 3.11" or .name == "Cross-engine Clipboard / Playwright 1.62.0") | [.name,.status,.conclusion,.completed_at] | @tsv'
gh release list --repo ContextualWisdomLab/inkspan --limit 1
jq -r '.version' package.json
rg -n '^version\s*=' office/pyproject.toml
npm view @contextualwisdomlab/cwl-editor version || true
gh api repos/ContextualWisdomLab/inkspan/dependabot/alerts \
  --jq '.[] | select(.state == "open") | [.number,.dependency.package.name,.security_advisory.severity,.security_vulnerability.first_patched_version.identifier] | @tsv'
for pr_number in 285 290 299 362 372 373; do
  gh api "repos/ContextualWisdomLab/inkspan/pulls/$pr_number" \
    --jq '[.number,.draft,.head.sha,.base.sha,.head.ref,.base.ref,.updated_at] | @tsv'
done
```

## Product and ownership boundary

Inkspan currently owns deterministic Markdown/HTML authoring, bounded document
and evidence contracts, local autosave coordination, accessibility metadata,
safe conversion, the standalone package boundary, and provider-neutral adapters.
The embedding host owns authenticated transport, authentication and
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
- PII handling must remain a host-governed privacy and authorization decision;
  removing masking or moving credentials/tenant identifiers into public editor
  evidence would violate the existing security boundary rather than close a
  product gap.

## Current PR and release lanes

| Lane | Current authority | Buyer impact | Gate / next action |
| --- | --- | --- | --- |
| [PR #362](https://github.com/ContextualWisdomLab/inkspan/pull/362) — editor contrast and keyboard focus | Ready active PR; exact head `11d5cfecdcc0949ec98e6ca110d482124bff00c4` | Shipped dark active-toolbar text is below the WCAG normal-text target, and the editable surface lacks a replacement focus indicator. | Inkspan CI `32344528267`, Security Scan `32344528097`, and SAST Semgrep `32344528210` are terminal-success on the exact head; package, Office, browser, and 100% aggregate coverage evidence are included in CI. Current-head OpenCode receipt/formal review and a qualifying independent approval remain absent. Keep the release lane blocked and refetch all organization-required workflows before lifecycle action; do not duplicate requests or self-approve. |
| [PR #373](https://github.com/ContextualWisdomLab/inkspan/pull/373) — patched transitive dependency floors | Ready active PR; exact head `724b45b8d824be9581f0f29cc6eb07e6aeceb70f` | Buyers need a clean, reproducible dependency audit without moving transport, credential, or runtime authority into Inkspan. | Exact-head CI `32361611250` is terminal-success, including 144 files / 829 tests, 100% aggregate coverage, package verification, Office jobs, and Chromium/Firefox/WebKit. Required OpenCode `32361611601`, Noema `32361611265`, Strix `32361611211`, Security Scan `32361611225`, SAST `32361611212`, and scheduler/close-empty evidence are queued/non-passing; no formal current-head review exists. Do not merge or rerun around the queue. |
| [PR #372](https://github.com/ContextualWisdomLab/inkspan/pull/372) — product-technical gap baseline | Ready active PR; exact head `d7fbbcdbf9d687249600b5f1ddb3493b0ce161fa` | Buyers and maintainers need one current, evidence-backed view of shipped boundaries, release readiness, and the next credible gap closures. | CI `32362859087` is terminal-success; required OpenCode, Noema, scheduler, Strix, security, SAST, and close-empty workflows remain queued, and no qualifying current-head approval exists. Keep the snapshot dated, refetch mutable evidence before governance decisions, and merge only after the protected exact-head gate is satisfied. |
| [Issue #118](https://github.com/ContextualWisdomLab/inkspan/issues/118) — stable release acceptance | Open release issue | Buyers cannot install a verified protected `0.6.0` artifact through the promised release path. | Integrate #362 and its named release-workflow writer [PR #285](https://github.com/ContextualWisdomLab/inkspan/pull/285), then refetch exact protected evidence, create the supported release identity, and verify public npm/PyPI digests. |
| [PR #285](https://github.com/ContextualWisdomLab/inkspan/pull/285) — hostile-input/browser assurance | Draft, stacked on `feat/writing-diagnostics-package`; branch is currently dirty relative to its base | Release browser evidence has a known 30-minute admission ceiling and the active branch proposes a five-file SBOM inventory. | Do not duplicate `.github/workflows/release.yml` ownership. Advance its stack only after the exact-head CI lane is executable; treat its five-file inventory as Proposed until protected. |
| [PR #299](https://github.com/ContextualWisdomLab/inkspan/pull/299) — exact-head gates for stacked PRs | Draft, targets protected `main` | Stacked work can otherwise receive checks that do not prove the contributor head. | Resolve its own current-head workflow evidence and review gates; do not transfer predecessor checks. |
| [PR #323](https://github.com/ContextualWisdomLab/inkspan/pull/323), [#320](https://github.com/ContextualWisdomLab/inkspan/pull/320), [#318](https://github.com/ContextualWisdomLab/inkspan/pull/318) — Office imports | Draft feature lanes | Word, HWP/HWPX, and spreadsheet import broaden buyer workflows but are not shipped. | Review each against bounded deterministic conversion, realistic Office fixtures, privacy-safe diagnostics, and exact-head package evidence before making any lane Ready. |

The remaining open PRs are mostly independent reliability, security,
accessibility, documentation, and diagnostics lanes. They must be processed by
their existing source ownership and dependency order; a Draft label is not a
reason to merge, and a blocked lane is not a reason to stop unrelated safe work.

## Gap register

| ID | Buyer-visible gap | Protected-main status | Smallest credible closure |
| --- | --- | --- | --- |
| G-01 | Default editor accessibility release blocker | `planned` / active PR #362 | Obtain fresh same-head governance evidence, an eligible approval, and terminal required workflows; merge only with the current head and then regenerate release evidence. |
| G-02 | Stable registry publication and public artifact verification | `planned`, tracked by #118 | Use the protected release workflow and OIDC Trusted Publishing; verify exact npm/PyPI bytes and provenance after publication. |
| G-03 | Release browser admission reliability | `implemented_on_active_pr` in #285 | Keep browser evidence mandatory while increasing only the bounded job ceiling through its owning stack; verify the exact packed artifact across Chromium, Firefox, and WebKit. |
| G-04 | Stacked-PR exact-head governance | `implemented_on_active_pr` in #299 | Make workflow dispatch and checks prove the contributor head/base pair, then refetch current runs and review evidence. |
| G-05 | Design-system discovery for repeating editor chrome | `implemented_on_active_pr` in #362 / ADR 0031 | Integrate the typed token catalog and Storybook inventory only after their accessibility, package, and documentation checks pass. The protected main currently has no Storybook inventory. |
| G-06 | Broader deterministic Office import | `planned` / Draft PRs #323, #320, #318 | Close one bounded format contract at a time with realistic fixtures, fail-closed limits, package consumers, and Python support evidence. |
| G-07 | Acquisition evidence freshness | `partial` | Refresh this dated baseline and the canonical doctoring records after every protected merge, release decision, or external control-plane change; never encode stale run IDs as timeless architecture. |
| G-08 | Patched transitive development-tool dependency floor | `implemented_on_active_pr` in #373 | Preserve the narrow workspace overrides and realpath containment fix, then require terminal exact-head security/SAST/review/governance evidence before integration; do not treat queued required workflows as passing. |

### Figma and Storybook boundary

The active design-token ADR explicitly rejects Figma Variables synchronization
as Inkspan runtime or credential authority and keeps CSS as the runtime source
of truth. Therefore this baseline does not invent a Figma file or claim a Figma
integration. If a future buyer-facing design artifact becomes a required
deliverable, use Figma for that design work and record the resulting Figma File
ID in the accepting ADR before calling the design contract complete. Storybook
remains a local preview/evidence surface, not a production transport or source
of document authority.

## Autonomous execution loop

At each external scheduler interval:

1. Refetch protected `main`, the full open-PR/issue queue, exact heads and
   bases, review threads, required workflows, security findings, release/tag
   state, documentation fitness, and buyer-visible gaps.
2. For each actionable PR, inspect current review findings, apply the smallest
   root-cause fix in its owned branch, rerun the applicable checks, and merge
   only after current governance authorizes it. Keep review latency and queued
   checks local to that lane.
3. If the queue has no actionable PR, execute the highest-value unclaimed gap
   above, with a real test or runtime proof and the smallest canonical-document
   update that the durable contract requires.
4. Run two fresh whole-repository sweeps before stopping. A newly executable
   item resets the sweep count. A prompt update, status report, documentation
   assessment, or queued check is intermediate work, not completion.

This loop is control-plane governance, not an Inkspan runtime feature. The
external scheduler owns cadence; Inkspan owns only the product and evidence
boundaries documented in the canonical graph.

## Verification limits

The snapshot above is evidence for queue selection on 2026-08-20 only. Before
any merge or release, re-read `docs/README.md`, `docs/PRD.md`, `docs/TRD.md`,
`docs/CONTRACTS.md`, `ARCHITECTURE.md`, the relevant ADRs, current source/tests,
exact GitHub heads/checks/reviews, and live governance. Cite new standards and
research in the existing APA 7th `docs/doctoring/` and `docs/TRACEABILITY.md`
surfaces; do not use a model response, PR prose, predecessor evidence, or local
green tests as a substitute for protected-main proof.
