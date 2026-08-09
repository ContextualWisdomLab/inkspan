# ADR 0010: Release evidence authority

Status: Proposed

## Context

Inkspan releases combine JavaScript/TypeScript packages, Office Python artifacts, checksums, SBOM/provenance, exact-head CI/security evidence, and repository review/protection state. Stale draft assets or predecessor-head checks can look healthy while referring to different source.

## Alternatives considered

- Publish best-effort artifacts whenever local builds appear green. Rejected because local or predecessor evidence can refer to a different source generation and does not prove remote artifact integrity or repository-policy acceptance.
- Reuse or repair mutable draft-release assets opportunistically. Rejected because stale/unexpected assets and digest drift can be mistaken for the intended exact-source release.
- Bind publication to one exact integrated protected head and fail closed on evidence or inventory ambiguity. Selected because source, review, provenance, and artifact authority remain reconstructable for operators and buyers.

## Decision

Release authority exists only for one exact integrated protected head. The release process verifies the expected local and remote artifact inventory and digests, package-consumer evidence, supported runtime matrix, applicable security/coverage/accessibility gates, SBOM/provenance, unresolved review findings, formal review requirements, and repository protection. Stale, unexpected, incomplete, or digest-mismatched draft assets fail closed and are not silently deleted or reused. Comments, model prose, status-only signals, predecessor evidence, or author assertions are not substitutes for formal approval where policy requires it.

## Consequences

Publication is slower than a best-effort upload but produces acquisition-reviewable evidence tied to exact source. Re-running after a head change is intentional. Historical releases and failed drafts remain auditable instead of being rewritten to produce a cleaner story.

## Failure and recovery

If artifact inventory, digest, provenance, review, or exact-head evidence is ambiguous, stop publication. Repair the source or release workflow, regenerate evidence from the exact head, and resume only through a contract that proves the existing remote draft is exactly expected. A bad published release is corrected through a new verified release or supported withdrawal/yank process.

## Security and privacy impact

Release credentials remain least-privilege workflow authority and are not product runtime credentials. Artifact integrity, provenance, and exact-source binding reduce supply-chain substitution risk. Release logs, SBOM/provenance records, and packaged artifacts must not accidentally include tenant documents, prompts/model outputs, host credentials, private validators, or unrelated secrets. Review or approval authority is never synthesized from a bot comment, author identity, or status-only signal.

## Compatibility and migration

A release contract binds one package/version and artifact inventory to one exact protected source generation. Evidence from an older head, merge result, or draft cannot transfer after source or expected assets change. A future release service or artifact layout requires explicit compatibility and migration rules for package consumers, provenance, draft-state recovery, and rollback while preserving historical immutable evidence rather than rewriting it.

## Verification

Use release-workflow regressions, expected-asset/digest tests, package and wheel consumers, reproducibility checks, security/coverage gates, SBOM/provenance/attestation checks where configured, formal review inspection, and post-publication artifact/checksum smoke verification.

## Rollback or supersession

Rollback never falsifies or deletes historical evidence to imply the failed publication did not occur. Supersession requires a versioned release contract with at least equivalent exact-source binding, artifact integrity, provenance, review, and recovery guarantees.
