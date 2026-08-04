# Hourly NVIDIA NIM OpenCode Development Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a pull-request-first hourly GitHub Actions workflow that uses a pinned OpenCode agent through `NVIDIA_NIM_API_KEY` to propose one bounded Inkspan product increment without merging, publishing, or changing review-agent credentials.

**Architecture:** A read-only development job runs OpenCode in a disposable, credential-isolated workspace through a loopback NVIDIA NIM broker and emits a bounded patch artifact. A separate write-capable proposal job verifies and applies the artifact, runs the complete repository gates, and opens one PR for central governance.

**Tech Stack:** GitHub Actions, OpenCode 1.17.13, NVIDIA NIM OpenAI-compatible API, Python 3.13 standard library, Node.js 22, pnpm 11, Vitest 3, `node:test`, SHA-256 artifact verification.

## Global Constraints

- The workflow runs only in `ContextualWisdomLab/inkspan` and only when no open PR exists.
- The coding agent uses `secrets.NVIDIA_NIM_API_KEY`; no Copilot API, Copilot credential, or review-agent credential is introduced or modified.
- OpenCode is pinned by version and SHA-256 archive digest.
- The agent receives no GitHub token, OIDC token, `.git` directory, or real NIM credential.
- The proposal job receives no NIM credential and executes no model-generated shell command.
- No merge, release, tag, npm publication, PyPI publication, or branch-protection bypass occurs.
- Product LLM paths must use or improve `ContextualWisdomLab/contextual-orchestrator`.
- Maintain 100% production TypeScript statement, branch, function, and line coverage and existing Office 100% branch/docstring gates.
- Added Python public callables require complete beginner-readable docstrings and 100% statement/branch coverage.
- Database objects, if unavoidable, use descriptive two-word-or-longer names and default to `snake_case`.
- Standards and research references use APA 7th edition in `docs/doctoring/`.

---

### Task 1: Workflow contract tests

**Files:**
- Create: `scripts/hourly-product-development-contract.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: the future `.github/workflows/hourly-product-development.yml` text.
- Produces: `pnpm test:hourly-development-contract`, a fail-closed static governance gate.

- [ ] **Step 1: Write the failing workflow contract test**

Create a `node:test` suite that reads the workflow and asserts:

```js
assert.match(workflow, /schedule:\s*\n\s*- cron: "[0-9]+ \* \* \* \*"/);
assert.match(workflow, /secrets\.NVIDIA_NIM_API_KEY/);
assert.doesNotMatch(workflow, /copilot/i);
assert.match(workflow, /permissions:\s*\n\s*contents: read/);
assert.match(workflow, /contents: write/);
assert.match(workflow, /pull-requests: write/);
assert.match(workflow, /OpenCode/);
assert.match(workflow, /sha256sum -c/);
assert.match(workflow, /gh pr list/);
assert.match(workflow, /PR governance owns/);
assert.doesNotMatch(workflow, /gh pr merge|npm publish|twine upload/);
```

Also assert that model execution explicitly unsets `GH_TOKEN`, `GITHUB_TOKEN`,
`REPOSITORY_TOKEN`, `ACTIONS_ID_TOKEN_REQUEST_TOKEN`, and
`ACTIONS_ID_TOKEN_REQUEST_URL`, and that development and proposal are separate
jobs connected by a SHA-256-verified artifact.

- [ ] **Step 2: Verify RED**

Run: `node --test scripts/hourly-product-development-contract.test.mjs`  
Expected: FAIL because `.github/workflows/hourly-product-development.yml` does not exist.

- [ ] **Step 3: Add the package script**

Add:

```json
"test:hourly-development-contract": "node --test ./scripts/hourly-product-development-contract.test.mjs"
```

Prepend it to `verify:package` so the release gate cannot omit workflow governance.

- [ ] **Step 4: Commit the RED contract**

```bash
git add scripts/hourly-product-development-contract.test.mjs package.json
git commit -m "test: specify hourly OpenCode development governance"
```

---

### Task 2: Loopback NVIDIA NIM credential broker

**Files:**
- Create: `scripts/ci/nim_proxy.py`
- Create: `tests/test_nim_proxy.py`
- Modify: `office/requirements-ci.txt` only if the existing coverage tool cannot include the repository-level script; do not add a runtime dependency.

**Interfaces:**
- Produces: `create_server(api_key, *, host="127.0.0.1", port=8765, max_concurrency=4) -> NimProxyServer` and `main(argv=None) -> int`.
- Consumes: `NIM_UPSTREAM_API_KEY` only in the broker process.

- [ ] **Step 1: Write failing broker boundary tests**

Cover real standard-library request handling for:

```python
def test_create_server_rejects_non_loopback_bind(): ...
def test_client_replaces_caller_authorization(): ...
def test_proxy_rejects_dot_segments_and_encoded_separators(): ...
def test_proxy_rejects_oversized_and_chunked_bodies(): ...
def test_proxy_rejects_unsupported_methods(): ...
def test_proxy_bounds_concurrency(): ...
def test_proxy_never_logs_request_content(): ...
def test_main_check_validates_without_serving(): ...
```

Use an injected fake `http.client.HTTPSConnection` and assert the forwarded host
is exactly `integrate.api.nvidia.com`, the path stays under `/v1`, and the only
upstream authorization is `Bearer <broker-secret>`.

- [ ] **Step 2: Verify RED**

Run: `PYTHONPATH=. coverage run --branch -m pytest tests/test_nim_proxy.py -q`  
Expected: FAIL because `scripts.ci.nim_proxy` does not exist.

- [ ] **Step 3: Implement the minimal broker**

Implement:

```python
UPSTREAM_HOST = "integrate.api.nvidia.com"
DEFAULT_HOST = "127.0.0.1"
MAX_REQUEST_BYTES = 16 * 1024 * 1024
MAX_RESPONSE_BYTES = 32 * 1024 * 1024
```

Use `ThreadingHTTPServer`, a bounded semaphore, TLS 1.2 minimum, strict visible
ASCII response headers, non-chunked request framing, no-store responses, and
content-free logging. Accept only GET, POST, HEAD `/healthz`, and unambiguous
`/v1` paths.

- [ ] **Step 4: Verify GREEN and coverage**

Run:

```bash
PYTHONPATH=. coverage run --branch -m pytest tests/test_nim_proxy.py -q
coverage report --fail-under=100
python scripts/ci/nim_proxy.py --check
```

Expected: all tests pass, 100% statement and branch coverage, broker check exits 0 with a test secret.

- [ ] **Step 5: Commit**

```bash
git add scripts/ci/nim_proxy.py tests/test_nim_proxy.py
git commit -m "feat: broker NVIDIA NIM credentials over loopback"
```

---

### Task 3: Bounded patch capture and promotion guard

**Files:**
- Create: `scripts/ci/hourly_product_guard.py`
- Create: `tests/test_hourly_product_guard.py`

**Interfaces:**
- Produces CLI commands:
  - `capture --workspace <path> --baseline <path> --output <path> --base-sha <sha>`
  - `verify --artifact <path> --expected-sha256 <digest> --base-sha <sha>`
- Produces artifact files `product_change.patch`, `product_change.json`, and `PR_MESSAGE.md`.

- [ ] **Step 1: Write failing adversarial guard tests**

Create temporary baseline/workspace trees and test:

```python
def test_capture_round_trips_allowed_source_change(): ...
def test_capture_rejects_workflow_or_git_changes(): ...
def test_capture_rejects_dependency_and_lockfile_changes(): ...
def test_capture_rejects_symlink_binary_and_oversized_change(): ...
def test_capture_rejects_secret_material(): ...
def test_capture_rejects_skipped_or_weakened_tests(): ...
def test_capture_requires_bounded_pr_message(): ...
def test_verify_rejects_digest_and_base_sha_mismatch(): ...
def test_verify_rejects_path_traversal_in_patch(): ...
```

The allowlist is limited to `src/**`, `demo/**`, `office/src/**`, `office/tests/**`,
`tests/**`, `docs/**`, `README.md`, `CHANGELOG.md`, and package metadata already
present in the repository. `.github/**`, `scripts/**`, lockfiles, credentials,
generated output, and binaries are forbidden model outputs.

- [ ] **Step 2: Verify RED**

Run: `PYTHONPATH=. coverage run --branch -m pytest tests/test_hourly_product_guard.py -q`  
Expected: FAIL because the guard module does not exist.

- [ ] **Step 3: Implement deterministic capture and verify commands**

Use `pathlib`, `difflib`, `hashlib`, `json`, and `subprocess` only. Reject more
than 12 changed files or 1,500 changed lines. Write the manifest with sorted keys,
UTF-8, and an exact base SHA. Compute SHA-256 over a deterministic concatenation
of artifact files. Diagnostics must report categories and paths without source
content or candidate secrets.

- [ ] **Step 4: Verify GREEN and coverage**

Run:

```bash
PYTHONPATH=. coverage run --branch -m pytest tests/test_hourly_product_guard.py -q
coverage report --fail-under=100
```

Expected: all realistic and adversarial cases pass at 100% statement and branch coverage.

- [ ] **Step 5: Commit**

```bash
git add scripts/ci/hourly_product_guard.py tests/test_hourly_product_guard.py
git commit -m "feat: bound autonomous product patches"
```

---

### Task 4: Hourly OpenCode workflow

**Files:**
- Create: `.github/workflows/hourly-product-development.yml`
- Modify: `scripts/hourly-product-development-contract.test.mjs` only when the implemented names require exact contract alignment.

**Interfaces:**
- Consumes: `secrets.NVIDIA_NIM_API_KEY`, GitHub's scoped runner token, Task 2 broker, and Task 3 guard.
- Produces: zero or one bounded pull request against `main`.

- [ ] **Step 1: Implement the read-only development job**

Use:

```yaml
on:
  workflow_dispatch:
    inputs:
      dry_run:
        type: boolean
        default: false
  schedule:
    - cron: "53 * * * *"

concurrency:
  group: hourly-product-development-${{ github.repository }}
  cancel-in-progress: false

permissions:
  contents: read
```

Add repository identity, NIM secret, and open-PR gates. Pin every action to a full
commit SHA. Use `ubuntu-24.04`, Node 22, Python 3.13, pnpm from `packageManager`,
and OpenCode 1.17.13 with archive SHA-256
`157afa289d1a8d9372de0ce19ac726119b937a1f6b201808d46f06e4e59bb348`.

Build a disposable workspace without `.git`; run OpenCode as UID 65532 with an
empty environment, placeholder `NVIDIA_API_KEY`, disabled external-directory,
web-fetch, web-search, task, and LSP permissions, and a model fallback pool of:

```text
nvidia-nim/nvidia/llama-3.3-nemotron-super-49b-v1.5
nvidia-nim/nvidia/nemotron-3-super-120b-a12b
nvidia-nim/deepseek-ai/deepseek-v4-pro
```

Use Task 2 as the loopback broker and Task 3 to capture the patch artifact.

- [ ] **Step 2: Implement the privileged proposal job**

Give only this job:

```yaml
permissions:
  contents: write
  pull-requests: write
```

Do not pass the NIM secret. Download the artifact, verify SHA-256 and base SHA,
ensure the default branch has not moved, apply the patch, run:

```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm coverage
pnpm build
pnpm verify:package
pnpm build:demo
cd office
python scripts/check_docstrings.py
coverage run -m pytest
coverage report
python -m pip check
python -m pip wheel . --no-deps --no-build-isolation --wheel-dir dist
```

Then create `nim-agent/product-dev-${GITHUB_RUN_ID}` and one PR. Before pushing,
recheck that no other open PR appeared. Never call a merge or release command.

- [ ] **Step 3: Verify the workflow contract**

Run: `pnpm test:hourly-development-contract`  
Expected: PASS with every credential, provider, job-separation, patch, and no-merge assertion satisfied.

- [ ] **Step 4: Verify YAML and shell syntax**

Run an available workflow linter and `bash -n` against extracted multiline shell
steps. Expected: no YAML, expression, shell, or quoting error.

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/hourly-product-development.yml scripts/hourly-product-development-contract.test.mjs
git commit -m "feat: schedule bounded NVIDIA NIM product development"
```

---

### Task 5: Operations, doctoring, release metadata, and complete verification

**Files:**
- Create: `docs/operations/hourly-product-development.md`
- Create: `docs/doctoring/hourly-opencode-development.md`
- Modify: `README.md`
- Modify: `CHANGELOG.md`
- Modify: `package.json`

**Interfaces:**
- Produces: operator runbook, audit trace, 0.5.27 release candidate metadata.

- [ ] **Step 1: Document operations**

Document the hourly and dry-run triggers, open-PR gate, NIM secret contract,
model fallback, broker, disposable workspace, allowed paths, artifact handoff,
verification commands, failure categories, rerun procedure, cost/timeout ceiling,
and central `.github` ownership.

- [ ] **Step 2: Write the doctoring record**

Record the product gap, selected two-job architecture, rejected Copilot and
single-trust-domain alternatives, realistic/adversarial evidence, limitations,
MSA ownership, and APA 7th references to GitHub Actions, GitHub security/secrets,
OpenCode configuration/permissions/providers, and NVIDIA NIM API documentation.

- [ ] **Step 3: Update release metadata**

Add a 0.5.27 CHANGELOG section covering automation, security, tests,
documentation, and residual boundaries. Change `package.json` to 0.5.27 only when
the complete integrated tree is release-ready.

- [ ] **Step 4: Run complete verification**

Run the complete TypeScript, package, demo, Office Python 3.11/3.14, broker,
guard, workflow contract, docstring, SAST, dependency, and secret-scan gates.
Expected: zero skipped release gates and 100% required coverage/docstrings.

- [ ] **Step 5: Create the PR**

Open one PR against `main` only after the prior PR queue is empty. Request
CodeRabbit and central review, address every actionable finding, revalidate the
exact head, enable auto-merge only when policy permits, and let the protected
branch perform the merge.
