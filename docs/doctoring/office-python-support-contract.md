# Doctoring record: Inkspan Office Python support contract

Decision date: 2026-08-09

## Problem

Protected `main` advertised Inkspan Office as compatible with Python 3.11, 3.12,
3.13, and 3.14 through package classifiers while `requires-python = ">=3.11"`
left every future Python version installable by metadata. The repository CI only
executed the Office suite on Python 3.11 and 3.14. The same hash-locked dependency
file described an `ubuntu-latest` runner even though pull-request CI already ran
on Ubuntu 24.04, and the release workflow still consumed that lock on
`ubuntu-latest`.

Those facts created three separate assurance gaps: 3.12/3.13 were advertised but
not directly exercised; future Python versions were installable before support
was demonstrated; and release verification could move to a different runner
image than the environment named by the lock contract.

## Decision

Inkspan Office uses one explicit support set for the current release line:
Python 3.11, 3.12, 3.13, and 3.14 on GitHub-hosted Ubuntu 24.04 x64 CI/release
jobs.

- `office/pyproject.toml` bounds `requires-python` to `>=3.11,<3.15` and retains
  classifiers for exactly those four supported minor releases.
- `.github/workflows/ci.yml` executes the complete Office verification job on
  every supported minor rather than inferring intermediate compatibility from
  endpoint testing.
- `office/requirements-ci.txt` describes the same fixed Ubuntu 24.04 environment.
- `.github/workflows/release.yml` uses Ubuntu 24.04 for both artifact creation and
  publication, preventing the release path from silently drifting with the
  `ubuntu-latest` alias.
- Root and Office README verification language names the complete tested Python
  matrix.

This is a support/evidence correction only. It does not change the renderer's
runtime behavior, dependency set, network boundary, Office contract, host
ownership, credentials, model use, persistence, or publication authority.

## Alternatives considered

### Keep endpoint-only testing

Testing only Python 3.11 and 3.14 is cheaper, but it leaves 3.12 and 3.13 as
metadata claims without direct package, dependency, wheel, docstring, and
100%-coverage evidence. Rejected for a commercial package whose classifiers
explicitly advertise those versions.

### Keep `requires-python = ">=3.11"`

This avoids a future metadata edit, but installation tools may treat future
Python versions as compatible before Inkspan has run its release-quality suite
there. Rejected in favor of fail-closed compatibility metadata.

### Keep `ubuntu-latest`

The alias is convenient but intentionally moves as GitHub changes its latest
stable image. Because Inkspan's hash-locked Office dependencies and release
verification are part of acquisition/reproducibility evidence, a fixed supported
runner label is preferable. Ubuntu 24.04 is an explicitly supported
GitHub-hosted runner label as of this decision date.

## Failure and recovery

If one supported Python minor cannot install the hash-locked wheel set or fails
Office tests, that minor remains unsupported for merge/release purposes until the
root cause is corrected. Do not delete a classifier, relax a hash, or skip a
matrix entry merely to obtain green CI without a compatibility decision.

When Python 3.15 is deliberately adopted, update the upper bound, classifier,
CI matrix, hash-locked wheel inventory, README statements, and this decision
record together. Prove the new exact-head matrix before release.

If Ubuntu 24.04 is retired, select a stable supported replacement, regenerate or
revalidate platform-specific hashes where necessary, and update CI, release,
lockfile guidance, tests, and documentation in one reviewed change.

## Security and supply-chain impact

Bounding Python compatibility prevents unverified interpreter versions from
being presented as supported package installs. Testing every advertised minor
also exercises the exact hash-locked dependencies, package build, schema/license
contents, public-docstring gate, and 100% branch-coverage suite on each runtime.
Pinning the runner label removes one avoidable moving-environment dimension from
release evidence while preserving immutable action SHAs and hash verification.

No credential, permission, network endpoint, or release authority is broadened.

## Verification

`office/tests/test_python_support_contract.py` machine-checks:

1. bounded `requires-python` metadata;
2. exact classifier/runtime correspondence;
3. CI coverage of all four supported Python minors;
4. fixed Ubuntu 24.04 lockfile guidance;
5. root and Office README runtime statements; and
6. fixed Ubuntu 24.04 release jobs.

The normal Office CI matrix then installs the hash-locked dependencies, runs
`pip check`, enforces shipped-symbol docstrings, executes the complete test suite
at 100% branch coverage, builds the wheel, and inspects packaged schema/license
contents on each supported minor.

## Rollback and supersession

Rollback is a normal revert only if the previous broader support claims are also
restored deliberately and their reduced evidence is acceptable. A future Python
support decision supersedes this record only when metadata, CI, release runner,
lockfile evidence, and buyer documentation remain internally consistent.

## APA 7 references

GitHub. (n.d.). *GitHub-hosted runners reference*. GitHub Docs. Retrieved August
9, 2026, from https://docs.github.com/en/actions/reference/runners/github-hosted-runners

Python Packaging Authority. (n.d.). *Core metadata specifications: Requires-Python*.
Python Packaging User Guide. Retrieved August 9, 2026, from
https://packaging.python.org/en/latest/specifications/core-metadata/#requires-python

Python Packaging Authority. (n.d.). *pyproject.toml specification*. Python
Packaging User Guide. Retrieved August 9, 2026, from
https://packaging.python.org/en/latest/specifications/pyproject-toml/
