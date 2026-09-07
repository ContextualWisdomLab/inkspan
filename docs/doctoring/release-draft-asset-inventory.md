# Doctoring record: exact draft release asset inventory

**Decision date:** 2026-08-07  
**Current contract correction:** 2026-08-18  
**Scope:** GitHub Release publication only; no Inkspan runtime, editor, persistence, collaboration, provider, tenant, credential, or database behavior changes.

## Problem

Inkspan's release workflow intentionally supports retrying an unpublished GitHub Release draft. The upload command uses `--clobber`, which replaces same-name release assets. A prior failed attempt or operator action can nevertheless leave a differently named asset in the draft. Publishing that draft while immutable releases are enabled would freeze the extra asset into the official release identity.

This is a provenance-completeness problem rather than a checksum-collision problem. The current protected release workflow produces four reviewed top-level assets: one npm tarball, one Inkspan Office wheel, `inkspan.spdx.json`, and `SHA256SUMS`. All four can be correctly generated while an unrelated fifth asset remains attached to the draft. Verifying only the expected local artifacts therefore does not prove that the complete release asset set is the reviewed set.

A second local-boundary failure mode exists before upload. Counting only top-level regular files does not prove that the transfer directory has exactly four entries: an unexpected directory, symlink, socket, or other non-regular top-level entry could coexist with the four expected files. The shell upload glob can expand such an entry even though a `find ... -type f` count ignores it. The local release boundary therefore has to bind both the complete top-level entry set and the regular-file subset before attestation or upload.

The original 2026-08-07 record described a three-file inventory because the release workflow at that stage did not yet publish the SPDX SBOM as a top-level release asset. Protected release source and executable contract tests now require `inkspan.spdx.json` as the fourth asset. This record supersedes that stale cardinality while retaining the original threat model and provenance rationale.

## Primary evidence

GitHub documents that immutable-release protection begins after publication and that draft releases remain mutable beforehand. GitHub also recommends attaching all intended assets to the draft before publishing it. The GitHub CLI documents `gh release upload --clobber` as deleting and re-uploading an existing asset of the same name; it does not define `--clobber` as pruning differently named assets. The current Releases REST representation exposes each asset's `name`, `state`, and content `digest`, including SHA-256 digests.

Draft retrieval has an important API distinction. GitHub documents **List releases** as returning draft releases to authenticated callers with repository push access, while **Get a release by tag name** is documented for a published release. A pre-publication control must therefore not rely on the by-tag endpoint for draft evidence. Inkspan uses the paginated authenticated release listing, selects the exact tag, requires exactly one match, and then validates that match as a draft.

These properties make the pre-publication draft the last safe point at which Inkspan can verify both set completeness and byte identity without trying to repair an already immutable release.

## Decision

After the expected files cross the workflow-artifact privilege boundary and before attestation or upload, and again after upload before `gh release edit ... --draft=false`, the release workflow must:

1. Require the local transfer directory to contain exactly four top-level entries and require all four to be regular files: one `*.tgz`, one `*.whl`, `inkspan.spdx.json`, and `SHA256SUMS`. Any extra directory, symlink, socket, device, regular file, or other top-level entry fails closed.
2. Paginate the authenticated GitHub **List releases** REST endpoint and select the exact release tag; require exactly one matching release object.
3. Require the selected remote object to remain a draft.
4. Compare the sorted local and remote asset-name sets for exact equality.
5. Require every remote asset to be in the `uploaded` state.
6. Compute a fresh local SHA-256 for each transferred file and require the corresponding GitHub asset `sha256:` digest to match exactly.
7. Fail closed before publication if any local entry type, tag match, draft state, name, state, count, or digest differs.

The workflow does not automatically delete an unexpected stale asset. Automatic deletion would turn a provenance gate into an unreviewed cleanup authority and could destroy a deliberately attached operator artifact. The failure message instead directs the operator to remove the stale draft or unexpected asset and rerun the reviewed tag.

## Threat and failure analysis

### Covered

- A failed prior attempt leaves an obsolete wheel, tarball, SBOM, checksum file, or other differently named asset in the draft.
- A same-name remote asset contains bytes different from the transferred local file.
- An upload is incomplete or an asset does not report the `uploaded` state.
- The local artifact directory unexpectedly contains multiple npm tarballs, multiple wheels, a missing or duplicate `inkspan.spdx.json`, missing checksums, another regular file, or any additional non-regular top-level entry.
- A symlink or directory replaces one of the expected regular files.
- The release stops being a draft before the inventory check.
- The draft cannot be uniquely identified in the complete authenticated release listing.
- A future refactor accidentally replaces draft-aware list evidence with the published-only by-tag route.

### Deliberately outside this gate

A repository administrator remains a higher authority and can intentionally mutate a draft after this verification and before publication. Tag-scoped workflow concurrency prevents another release-workflow run for the same tag, but it cannot remove GitHub administrator authority. This residual boundary is documented rather than represented as impossible.

The gate also does not claim byte-for-byte reproducibility across independent package rebuilds. It proves that the exact transferred artifacts selected by the reviewed tagged build are the complete files attached to the draft at the verification point.

## Privacy and observability

The comparison uses only public release filenames, asset states, tag identity, file-entry type, and cryptographic digests. It does not emit source content, document bodies, tenant identifiers, credentials, local absolute paths, or package internals. SHA-256 digests here are artifact equality evidence, not authorization or confidentiality controls.

## Rollback

This change is release-contract documentation and workflow assurance; it does not change package APIs or stored data. If GitHub changes draft visibility, release asset representation, pagination, or the digest contract, publication must remain fail-closed until the workflow and deterministic repository contract are updated against the new official API. Operators must not bypass the gate by weakening the expected artifact count or entry-type boundary, accepting ambiguous release matches, or accepting missing digest evidence.

## Verification

`src/releaseDraftAssetInventory.test.ts` is the executable protected release authority for the inventory. It requires the exact-inventory check to occur after upload and before publication, requires `expected_asset_count=4`, requires one npm tarball, one Office wheel, `inkspan.spdx.json`, and `SHA256SUMS`, uses paginated draft-aware list evidence rather than a published-only by-tag route, and requires state and digest validation plus explicit fail-closed diagnostics. On Linux, which is the release-runner class, the same test extracts and executes the reviewed shell body with a local fake `gh api` response and the runner's real Bash, `jq`, `find`, `diff`, and `sha256sum`.

`src/releaseDraftAssetEntryType.test.ts` separately exercises the pre-attestation local entry-type boundary. Historical RED `0d905d9b244d36d55317de2237e3e3480c7ece5f` proved that a regular-file-only count could admit an unexpected top-level directory under the then-current inventory. The current contract generalizes that invariant to the exact four-file set: complete top-level cardinality and regular-file cardinality must both match before attestation or upload.

`src/releaseContractCanonicalConsistency.test.ts` rejects stale three-file wording across `docs/CONTRACTS.md`, `docs/TEST_STRATEGY.md`, `docs/OPERABILITY.md`, and this doctoring record while requiring all canonical documents to name the protected four-file SBOM-inclusive inventory. This prevents documentation from drifting behind executable release behavior again.

Exact-current-head CI, security, automated review, independent review, and branch protection remain authoritative. Predecessor-head, queued, cancelled, skipped, status-only, or synthetic-merge evidence is not completion evidence.

## References

GitHub. (n.d.-a). *Immutable releases*. GitHub Docs. Retrieved August 7, 2026, from https://docs.github.com/en/enterprise-cloud@latest/code-security/concepts/supply-chain-security/immutable-releases

GitHub. (n.d.-b). *Managing releases in a repository*. GitHub Docs. Retrieved August 7, 2026, from https://docs.github.com/en/repositories/releasing-projects-on-github/managing-releases-in-a-repository

GitHub. (n.d.-c). *List releases*. GitHub Docs. Retrieved August 7, 2026, from https://docs.github.com/en/rest/releases/releases?apiVersion=2026-03-10#list-releases

GitHub. (n.d.-d). *Get a release by tag name*. GitHub Docs. Retrieved August 7, 2026, from https://docs.github.com/en/rest/releases/releases?apiVersion=2026-03-10#get-a-release-by-tag-name

GitHub CLI. (n.d.). *gh release upload*. GitHub CLI manual. Retrieved August 7, 2026, from https://cli.github.com/manual/gh_release_upload
