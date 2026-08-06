# Doctoring record: exact-head CI evidence

- **Status:** Accepted
- **Decision date:** 2026-08-06
- **Scope:** Repository-owned `CI` workflow only
- **Runtime change:** None; this changes verification source and runner controls

## Problem

GitHub's `pull_request` event exposes a synthetic pull-request merge ref as the
default checkout target. The prior Inkspan workflow used checkout defaults, so a
reported CI success described GitHub's temporary merge commit rather than the
immutable contributor head named in the pull request. The checkout action also
persisted its GitHub token into local Git configuration by default.

A synthetic merge test can be useful compatibility evidence, but it is not exact
source identity evidence. Treating it as the pull-request head can make reviews,
coverage reports, packages, and release claims appear bound to a commit that the
contributor branch never contained. Persisting credentials is also unnecessary
for a read-only build and enlarges the impact of untrusted build or test code.

## Decision

The repository-owned `CI` workflow checks out:

```yaml
ref: ${{ github.event.pull_request.head.sha || github.sha }}
persist-credentials: false
```

For a pull request, this selects the immutable contributor head. For a protected
branch push, it selects the event commit through `github.sha`. Both jobs use the
fixed `ubuntu-24.04` runner label and the immutable `actions/checkout` v7.0.1
commit. Workflow permissions remain `contents: read`, and no write permission,
secret-bearing model call, release publication, approval, or branch update is
introduced.

`FORCE_JAVASCRIPT_ACTIONS_TO_NODE24` is declared at workflow scope so the pinned
actions run under the repository's reviewed current JavaScript action runtime
rather than a deprecated implicit runtime.

## Evidence boundary

A successful run under this contract is exact-head CI evidence for the selected
source commit. It is not merge-result compatibility evidence. Branch protection,
a merge queue, or a separately reviewed integration test may still require a
fresh synthetic or protected-base integration result before merge.

The workflow result also does not replace Security Scan, Semgrep, CodeQL,
independent review, release provenance, package publication, or deployment
acceptance. Each required surface must bind its own result to the intended source
identity. In particular, an organization-required workflow that still checks a
synthetic merge ref must not be described as exact-head evidence merely because
its check appears on the pull request.

Local-versus-shareable evidence remains explicit. Checkout logs and exact source
SHAs are shareable release evidence. Repository tokens, runner credentials,
customer content, tenant identifiers, private callback output, and dependency
registry credentials are not.

## Security consequences

The contributor head is untrusted input. Disabling credential persistence keeps
the workflow token out of the checked-out repository's ordinary Git
configuration after checkout. The action still receives the job token long
enough to fetch the exact source, and the job retains only read permissions.

This is defense in depth rather than a sandbox claim. Test processes can still
read files and use the network permitted by the hosted runner. Secrets must not
be attached to this untrusted pull-request job, and a future write-capable step
must use a separate trusted workflow boundary rather than broadening this one.

Fixed runner labels reduce silent environment movement but do not make the hosted
image immutable. The exact image version remains visible in every job log.
Third-party actions are pinned to full commit identities, and the contract test
rejects mutable tags.

## Test-first evidence

Commit `14096f37f1aa47fb7f6661fea3b505193680aaf8` added the first workflow
contract before production changes. Commit
`e68781a8a2c96d5b103900e2622bf7de59925706` added this doctoring and changelog
contract before either record existed.

Pull-request CI run `31066658465` produced the intended red result: all 550 other
JavaScript tests and both Office Python matrix jobs passed, while the three new
contracts failed for `ubuntu-latest`, the missing Node 24 action-runtime policy,
and the absent doctoring record. Its checkout log also showed
`persist-credentials: true` and the synthetic `refs/pull/64/merge` source. That
run is historical TDD evidence, not success evidence.

Commit `bf348d6d2ad00589a990bc447f90548709533b4c` applied the workflow repair.
The final head must prove from its own checkout log that the exact contributor
head was selected and `persist-credentials: false` was effective before this
record can support merge readiness.

## Rejected alternatives

### Keep the default checkout ref and rename the claim

Rejected because the product and acquisition contract requires exact-head
coverage, packaging, and review evidence. A merge-only result cannot substitute
for the reviewed source identity.

### Use `pull_request_target`

Rejected because that event's privileged base-repository context is unsafe for
executing untrusted pull-request code. This read-only workflow needs no privileged
context.

### Keep persisted credentials for convenience

Rejected because no workflow step commits, pushes, tags, opens a pull request,
or publishes a release. Retaining the credential has no product benefit.

### Use mutable action tags or `ubuntu-latest`

Rejected because both silently change the verification implementation. Full
action commits and a fixed runner family make changes reviewable and reproducible
enough for this hosted-runner boundary.

## Rollback

Rollback restores the prior workflow and removes this record and its contract.
That rollback must also remove every exact-head claim because the default
pull-request checkout returns to a synthetic merge source and persisted Git
credentials. It does not provide a safe emergency path for publication or
approval.

No package version, database object, migration, runtime dependency, provider,
credential, scheduler, model call, or release is introduced.

## APA 7 references

GitHub, Inc. (n.d.). *Events that trigger workflows*. GitHub Docs. Retrieved
August 6, 2026, from
https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows

GitHub, Inc. (n.d.). *Workflow syntax for GitHub Actions*. GitHub Docs.
Retrieved August 6, 2026, from
https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax

GitHub, Inc. (n.d.). *actions/checkout*. GitHub. Retrieved August 6, 2026, from
https://github.com/actions/checkout
