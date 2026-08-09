# ADR 0010: Release evidence authority

Status: Proposed

## Context

Inkspan releases combine JavaScript/TypeScript packages, Office Python artifacts, checksums, SBOM/provenance, exact-head CI/security evidence, and repository review/protection state. Stale draft assets or predecessor-head checks can look healthy while referring to different source.

## Decision

Release authority exists only for one exact integrated protected head. The release process verifies the expected local and remote artifact inventory and digests, package-consumer evidence, supported runtime matrix, applicable security/coverage/accessibility gates, SBOM/provenance, unresolved review findings, formal review requirements, and repository protection. Stale, unexpected, incomplete, or digest-mismatched draft assets fail closed and are not silently deleted or reused. Comments, model prose, status-only signals, predecessor evidence, or author assertions are not substitutes for formal approval where policy requires it.

## Consequences

Publication is slower than a best-effort upload but produces acquisition-reviewable evidence tied to exact source. Re-running after a head change is intentional. Historical releases and failed drafts remain auditable instead of being rewritten to produce a cleaner story.

## Failure and recovery

If artifact inventory, digest, provenance, review, or exact-head evidence is ambiguous, stop publication. Repair the source or release workflow, regenerate evidence from the exact head, and resume only through a contract that proves the existing remote draft is exactly expected. A bad published release is corrected through a new verified release or supported withdrawal/yank process.

## Verification

Use release-workflow regressions, expected-asset/digest tests, package and wheel consumers, reproducibility checks, security/coverage gates, SBOM/provenance/attestation checks where configured, formal review inspection, and post-publication artifact/checksum smoke verification.

## Rollback or supersession

Rollback never falsifies or deletes historical evidence to imply the failed publication did not occur. Supersession requires a versioned release contract with at least equivalent exact-source binding, artifact integrity, provenance, review, and recovery guarantees.
