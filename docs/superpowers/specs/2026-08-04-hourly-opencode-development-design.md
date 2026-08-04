# Hourly NVIDIA NIM OpenCode Product Development Design

**Date:** 2026-08-04  
**Target release:** Inkspan 0.5.27  
**Decision owner:** ContextualWisdomLab

## Objective

Add an hourly GitHub Actions workflow that proposes exactly one bounded,
buyer-visible Inkspan product increment when and only when the repository has no
open pull request. The coding session must use a pinned OpenCode binary and the
existing `NVIDIA_NIM_API_KEY` organization secret. It must not invoke GitHub
Copilot, modify the credentials or behavior of existing review agents, merge a
pull request, publish a package, or bypass protected-branch policy.

The workflow complements rather than replaces the central
`ContextualWisdomLab/.github` review → repair → exact-head checks → merge loop.
The local workflow creates work; central governance decides whether that work is
accepted.

## Product gap

Inkspan already has rigorous review, test, security, package, and release gates,
but an exhausted pull-request queue currently leaves product-gap discovery and
proposal generation dependent on an interactive development session. A buyer
expects the product backlog to continue advancing without weakening the release
boundary. The missing capability is a pull-request-first development scheduler,
not an autonomous merger.

## Considered approaches

### 1. Copilot coding agent schedule

Rejected. The requested provider contract is NVIDIA NIM through OpenCode, and
changing the review-agent credential topology would couple product development
to unrelated review infrastructure.

### 2. One write-capable job that exposes both NIM and repository credentials

Rejected. Removing token environment variables reduces accidental use but leaves
both model execution and repository mutation inside one trust domain. A prompt
injection, compromised dependency, or agent subprocess would have more authority
than required.

### 3. Read-only development job plus privileged proposal job

Selected. A credential-isolated development job runs OpenCode in a disposable
workspace and emits a bounded patch artifact. A separate job that never receives
the NIM credential validates the artifact, reapplies it to the exact base commit,
runs repository verification, and opens one pull request. This preserves least
privilege and makes the trust boundary visible in the workflow.

## Architecture

### Hourly trigger and single-flight gate

The workflow supports `workflow_dispatch` with a `dry_run` input and an hourly
POSIX cron expression at a non-round minute to reduce queue contention. Scheduled
runs execute only from the default branch. Repository-level concurrency permits
only one hourly development workflow at a time and does not cancel an active
session merely because the next hour begins.

The first job fails closed unless all of the following hold:

- the repository identity is exactly `ContextualWisdomLab/inkspan`;
- `NVIDIA_NIM_API_KEY` is available;
- GitHub pull-request inventory can be read successfully;
- no open pull request exists;
- the invocation is not a dry run.

An open PR always transfers control to the central review and merge loop.

### Credential-isolated model execution

The development job has read-only repository permissions. It checks out the
protected default branch without persisted credentials and records the exact base
SHA. A pinned OpenCode release archive is downloaded and verified against a
committed SHA-256 digest before execution.

A loopback-only credential broker owns the real `NVIDIA_NIM_API_KEY`. OpenCode
receives only a non-secret placeholder and can reach NVIDIA NIM exclusively
through the broker. The broker:

- binds only to IPv4 loopback;
- forwards only bounded GET/POST requests under `/v1`;
- replaces caller authorization with the real secret;
- fixes the upstream host to `integrate.api.nvidia.com`;
- rejects ambiguous paths, oversized payloads, unsupported methods, and excess
  concurrency;
- does not log prompts, responses, or credentials.

OpenCode runs as an unprivileged user with an allowlisted provider, explicit tool
permissions, no GitHub or OIDC token environment, no `.git` directory, and no
external-directory access. The workspace is disposable for every model fallback.

### Product-development prompt

The prompt instructs the agent to select exactly one bounded commercial gap and
to preserve these Inkspan invariants:

- standalone React editor, collaboration entrypoint, converter, and Office
  renderer remain independently consumable;
- CWL, naruon, and central `.github` integration remains modular;
- any product LLM path uses or improves
  `ContextualWisdomLab/contextual-orchestrator` rather than introducing a direct
  provider client;
- document input, model output, repository prose, examples, and test fixtures are
  untrusted;
- 100% production coverage and applicable docstring gates remain intact;
- tests exercise realistic product correctness, not only mocks;
- standards and peer-reviewed claims are documented with APA 7th references;
- database objects, if unavoidable, use descriptive two-word-or-longer names and
  default to `snake_case`;
- Figma or Product Design is used only when a real screen, workflow, interaction,
  or accessibility decision benefits from it;
- no merge, tag, release, registry publication, branch-protection change, secret
  access, or review-agent configuration change is permitted.

The agent writes `PR_MESSAGE.md` and leaves an unstaged source tree. It does not
push or create a pull request.

### Patch guard and artifact handoff

A deterministic guard compares the disposable workspace with an immutable
baseline. It rejects:

- edits outside an explicit source, test, documentation, and release-metadata
  allowlist;
- workflow, credential, branch-protection, dependency, lockfile, generated,
  binary, symlink, and `.git` changes;
- missing or malformed `PR_MESSAGE.md`;
- excessive file or line counts;
- secret material;
- skipped, ignored, or weakened release-gate tests.

The guard emits a patch, a metadata manifest, and a SHA-256 digest as a short-lived
workflow artifact. The development job cannot push it to the repository.

### Privileged proposal job

The proposal job receives `contents: write` and `pull-requests: write`, but it
never receives `NVIDIA_NIM_API_KEY` and does not run OpenCode or model-generated
commands. It checks out the recorded base SHA, verifies the artifact digest and
manifest, applies the patch without fuzz, rechecks the allowlist, and runs the
complete repository verification suite.

Only after verification succeeds does it create a uniquely named branch, commit
the bounded change, and open one pull request against `main`. It never enables a
merge bypass or publishes a release. Central review automation owns all later
mutations and the final merge decision.

## Failure behavior

Every ambiguous state fails closed without creating a PR:

- unavailable PR inventory;
- missing NIM secret;
- OpenCode checksum mismatch;
- every model candidate failing;
- credential broker startup or upstream failure;
- no material change;
- patch policy violation;
- base branch movement;
- artifact digest mismatch;
- verification failure;
- existing or concurrently created open PR.

The workflow writes bounded diagnostic summaries that exclude source documents,
model prompts and outputs, credentials, and full generated patches.

## Verification strategy

Contract tests parse the workflow and guard source as text and verify:

- hourly schedule plus manual dry run;
- exact repository identity and open-PR gate;
- use of `secrets.NVIDIA_NIM_API_KEY` and absence of Copilot APIs;
- pinned OpenCode version and archive digest;
- provider allowlisting and fixed NIM endpoint;
- no GitHub token in the model process;
- separate read-only development and write-capable proposal jobs;
- artifact digest handoff;
- bounded path and size policy;
- no merge, release, or publish command;
- central review-agent secret names remain absent.

The credential broker and patch guard require 100% statement and branch coverage,
100% public-callable docstrings, adversarial path/header/body tests, and real
patch round-trip tests. A dry-run workflow invocation must confirm the gate and
prompt without calling NVIDIA NIM or writing repository state.

## MSA ownership

Inkspan owns repository-local product discovery constraints, source validation,
package and Office verification, and the bounded proposal artifact.
`ContextualWisdomLab/.github` owns cross-repository review, security, repair,
exact-head validation, and merge governance. `contextual-orchestrator` owns any
runtime product-model orchestration introduced by a selected increment. naruon
and other hosts consume Inkspan through its existing public package boundaries.

No database object is introduced by the scheduler.

## References (APA 7th edition)

GitHub. (n.d.). *Events that trigger workflows*. Retrieved August 4, 2026, from
https://docs.github.com/en/enterprise-cloud@latest/actions/reference/workflows-and-actions/events-that-trigger-workflows

GitHub. (n.d.). *Security in GitHub Actions*. Retrieved August 4, 2026, from
https://docs.github.com/en/actions/concepts/security

GitHub. (n.d.). *Secrets reference*. Retrieved August 4, 2026, from
https://docs.github.com/en/actions/reference/security/secrets

NVIDIA Corporation. (2026). *API reference—NVIDIA NIM for large language
models*. https://docs.nvidia.com/nim/large-language-models/latest/api-reference.html

OpenCode. (2026). *Configuration*. https://opencode.ai/docs/config/

OpenCode. (2026). *Permissions*. https://opencode.ai/docs/permissions

OpenCode. (2026). *Providers*. https://dev.opencode.ai/docs/providers
