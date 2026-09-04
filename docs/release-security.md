# Release security and provenance contract

Inkspan release artifacts are part of the product boundary. Buyers and CWL/naruon integrators must be able to determine which source revision produced an npm tarball or Office wheel, inspect the release SBOM, verify that no artifact was substituted, and reproduce the repository's release gates without trusting a long-lived publication secret.

## Release trigger and identity

A release starts only from a pushed semantic-version tag in the canonical `ContextualWisdomLab/inkspan` repository. The workflow rejects a tag unless all of the following are true:

- the tag has the form `vMAJOR.MINOR.PATCH`, with an optional semantic-version prerelease suffix;
- the tag exactly matches the JavaScript package version in `package.json`;
- `CHANGELOG.md` contains a release section for that version;
- package metadata still identifies the canonical public repository; and
- the tagged commit is already reachable from the canonical `main` branch and is the exact current protected-main tip required by the release workflow.

The protected-main identity gate prevents an unmerged, stale, or otherwise unreviewed commit from becoming an official release merely because a matching tag was created.

For stable registry releases, the root and Office package versions must both equal the stable release tag. Prerelease tags remain GitHub-Release-only until an explicit cross-ecosystem prerelease mapping is accepted.

## Privilege-separated release design

The GitHub Release path has a source-bearing build stage followed by a source-free publication stage, and external registry publication is downstream of that validated artifact boundary:

1. `build-release-artifacts` has read-only repository access. It checks identity, installs dependencies, runs all quality gates, builds both distributions, generates one SPDX 2.3 SBOM per exact package with signature-verified Syft, validates both SBOMs, and creates checksums for the complete release set.
2. `publish-release` receives only the validated files through GitHub's workflow artifact service. This smaller job alone receives the GitHub release, OpenID Connect, and attestation authority needed to create the immutable GitHub Release.
3. `publish-npm` and `publish-pypi` consume the same validated npm tarball and Office wheel after the GitHub Release boundary. They receive OIDC only inside their protected registry environments and do not rebuild the packages.
4. `verify-registry-publication` has no publishing credential. It performs post-publication digest verification against the public npm and PyPI registry identities and the exact validated local artifacts.

The build job cannot modify releases or request an OpenID Connect signing identity. Registry publishing jobs do not check out or execute repository source under publication credentials. The verification job does not receive `id-token: write`. This limits the amount of repository-controlled or third-party code exposed to publication authority.

The transferred workflow artifact is retained for one day and stored without redundant compression. Its SHA-256 manifest is checked again after download before attestation or publication.

## Release gates

The release workflow repeats merge and product gates against the tagged source rather than reusing untrusted or stale build output:

1. complete-history checkout and exact current protected-main-tip verification;
2. frozen JavaScript dependency installation;
3. TypeScript type checking;
4. repository-required 100% TypeScript coverage;
5. all production library builds;
6. packed-package consumer verification for ESM, CommonJS, declarations, CSS, fonts, collaboration, converter, and headless package surfaces;
7. demo build;
8. stable root/Office/tag version equality before registry publication;
9. hash-locked Office dependency installation on Python 3.14 for the release build;
10. Office dependency consistency, 100% shipped-symbol docstring coverage, and 100% branch coverage;
11. Office wheel construction and inspection for the bundled schema and license;
12. installation of the exact Syft v1.50.0 release through its commit-pinned installer with Cosign verification enabled, so the signed checksum material is verified before the Syft binary is accepted;
13. deterministic SPDX 2.3 SBOM generation and validation for each exact npm and Office package;
14. SHA-256 checksum generation for the npm tarball, Office wheel, both package SBOMs, and checksum manifest boundary;
15. checksum verification after the privilege boundary;
16. exact draft asset inventory and digest verification before GitHub publication; and
17. public npm and PyPI post-publication digest verification for stable registry releases.

No release draft is created or modified unless every source-bearing build gate succeeds on the tagged commit. A stable release is not treated as registry-complete until both registry publication jobs and the downstream public digest verification succeed.

## SBOM generator trust boundary

The release path does not delegate Syft installation to an action that can retrieve a mutable installer from another branch. It installs Cosign from a full-commit-pinned `sigstore/cosign-installer` action, downloads Syft's installer from the exact commit behind the annotated `v1.50.0` tag, disables installer-script redirection with `DOWNLOAD_TAG_INSTALL_SCRIPT=false`, and invokes the installer with `-v`. The Syft installer therefore verifies the release checksum signature and certificate before accepting the downloaded Syft binary, then still verifies the binary checksum.

Only that signature-verified Syft executable is added to the workflow `PATH`. It scans the exact npm tarball into `release/editor-package.spdx.json` and the exact Office wheel into `release/office-package.spdx.json`. The workflow then validates each SPDX version, matching package identity, and bounded attestation-input size before either SBOM can cross the build/publication privilege boundary.

This controls the generator bootstrap path; it does not assert that an SBOM is a vulnerability scan or license-policy decision. Consumers and release operators must interpret the inventory separately from provenance and security-scan results.

## Immutable GitHub publication

Immutable releases must be enabled for the canonical repository before a release tag is pushed. Reading or changing that repository setting requires Administration permission, which the release workflow intentionally does not receive. Instead, the workflow verifies the immutable state of the published release through the ordinary release API available to its narrowly scoped contents token.

Publication follows GitHub's immutable-release sequence:

1. reject an existing published release rather than replacing its assets;
2. create or resume a draft release;
3. attach the complete attested artifact set while the release is still mutable;
4. verify the exact draft asset inventory and GitHub-reported digests;
5. publish the draft;
6. require GitHub to report `isImmutable: true` for the published release; and
7. verify the release attestation and every expected uploaded asset through GitHub CLI.

### Exact draft asset inventory

A resumed draft is not assumed to contain only artifacts from the current workflow attempt. `gh release upload --clobber` replaces an existing asset with the same name, but an unexpected stale asset with a different name can otherwise remain attached to the draft. Once an immutable release is published, every attached asset is frozen with that release identity.

Immediately after upload and before the draft is published, the workflow therefore fails closed unless all of these conditions hold:

- the local release directory contains exactly one npm `*.tgz`, one Office `*.whl`, `editor-package.spdx.json`, `office-package.spdx.json`, and `SHA256SUMS`;
- `SHA256SUMS` binds the npm tarball, Office wheel, and both SBOM digests to the transferred local release set;
- the canonical GitHub Releases API still reports the release as a draft;
- the sorted remote asset-name set exactly equals the sorted local artifact-name set;
- every remote asset reports the `uploaded` state; and
- every GitHub release-asset `sha256:` digest, including both SBOM digests and the checksum-manifest digest, exactly equals a newly computed SHA-256 digest of the corresponding transferred local file.

The draft lookup deliberately uses the authenticated, paginated **List releases** REST endpoint and filters its complete result for the exact tag. GitHub documents that authenticated callers with repository push access receive draft releases from this endpoint. The `Get a release by tag name` endpoint is documented for a **published** release, so it is not used as evidence for this pre-publication gate. The publish job fails unless the paginated listing contains exactly one release matching the tag and that object still reports `draft: true`.

An unexpected stale asset is not deleted automatically. The workflow stops before the draft is published and directs an operator to remove the stale draft or unexpected asset, then rerun from the reviewed tag. This avoids silently deleting an operator-created draft artifact while ensuring that unrelated content cannot become part of an immutable Inkspan release by persistence across retries.

The exact-inventory comparison names only public release artifacts and does not expose source files, credentials, tenant data, document content, or local absolute paths. The gate also does not claim to prevent a repository administrator from deliberately mutating a draft in the narrow interval between validation and publication; repository administration remains a higher authority boundary. Tag-scoped workflow concurrency prevents competing release-workflow runs for the same tag.

If GitHub reports that the newly published release is mutable, the workflow immediately deletes that release and fails. This rollback leaves the tag available for a retry after an administrator enables release immutability; it does not treat a mutable publication as a successful product release. If rollback itself fails, the workflow emits an explicit high-severity error and remains failed for operator intervention.

A failed rerun may repair same-name assets in an existing draft with `--clobber`, but it can never overwrite a published release. A new successful release identity therefore requires a new reviewed version and tag unless the previous attempt ended only as a deleted mutable release or an unpublished draft. Any unrelated asset left in that unpublished draft is a hard pre-publication failure rather than silently retained content.

Enabling immutable releases is an administrative repository control. Repository owners can enable it in GitHub settings or with the immutable-releases repository API using a credential with repository Administration write permission. The release workflow cannot weaken or silently enable the policy.

## Published artifacts

Each successful GitHub release contains exactly five files:

- the exact npm tarball produced by `npm pack`;
- the `inkspan-office` wheel built from `office/`;
- `editor-package.spdx.json` and `office-package.spdx.json`, the validated SPDX 2.3 SBOMs generated from their matching packages by signature-verified Syft; and
- `SHA256SUMS` covering the npm tarball, Office wheel, and both SBOMs.

The workflow does not rebuild artifacts after the read-only build job. The same transferred files are checksum-verified, attested, uploaded, inventory-checked against the draft, and published to GitHub; on stable releases, the npm tarball and Office wheel are then forwarded unchanged to npm and PyPI.

## Provenance and verification

The isolated GitHub publication job requests a short-lived OpenID Connect identity and uses GitHub artifact attestations to create signed SLSA provenance for the npm tarball, Office wheel, both package SBOMs, and checksum manifest. It creates separate SPDX attestations that bind each package only to its matching SBOM predicate. The repository is public, so the attestation is backed by the public Sigstore transparency infrastructure used by GitHub.

Consumers should verify release-level and file-level provenance, both package-specific SBOM predicates, and checksums, using the actual version and filenames from the selected release:

```bash
VERSION=0.6.0

gh release verify "v${VERSION}" --repo ContextualWisdomLab/inkspan

gh release verify-asset "v${VERSION}" "contextualwisdomlab-cwl-editor-${VERSION}.tgz" \
  --repo ContextualWisdomLab/inkspan

gh release verify-asset "v${VERSION}" "editor-package.spdx.json" \
  --repo ContextualWisdomLab/inkspan
gh release verify-asset "v${VERSION}" "office-package.spdx.json" \
  --repo ContextualWisdomLab/inkspan

gh attestation verify "inkspan_office-${VERSION}-py3-none-any.whl" \
  --repo ContextualWisdomLab/inkspan

gh attestation verify "contextualwisdomlab-cwl-editor-${VERSION}.tgz" \
  --repo ContextualWisdomLab/inkspan \
  --predicate-type https://spdx.dev/Document/v2.3

sha256sum --check SHA256SUMS
```

A successful attestation proves which repository, workflow, event, and commit built an artifact; it does not by itself prove that the source code is defect-free. Consumers must still apply their own vulnerability, license, policy, and deployment review.

## External registries

Stable npm and PyPI publication is implemented on protected `main` through OIDC Trusted Publishing. The protected `publish-npm` job uses environment `npm`; the protected `publish-pypi` job uses environment `pypi`. Registry owners must configure those environments and registry-side Trusted Publisher identities for the canonical repository and `.github/workflows/release.yml`. No long-lived npm or PyPI publishing token is part of the supported path.

The registry jobs consume the same validated npm tarball and Office wheel that passed the GitHub Release artifact boundary. They do not rebuild, rewrite, normalize, or infer package versions while publication authority is present. Stable registry publication requires the root and Office package versions to equal the stable release tag. Under ADR 0019, prerelease tags remain GitHub-Release-only until a separately reviewed SemVer/PEP 440 prerelease mapping exists.

Public registry identity is verified after publication. `verify-registry-publication` compares the public npm tarball and PyPI wheel digest evidence against the exact validated local artifacts and fails closed if publication does not converge. A source merge, tag, GitHub Release, successful npm job, or successful PyPI job alone is not post-publication digest verification.

npm and PyPI are independent immutable publication domains. If one registry accepts a stable version and the other registry or downstream verification fails, the release is a partial-publication incident rather than a success that can be repaired by overwriting the accepted version. Recovery preserves evidence, uses registry-supported deprecation or yank controls when appropriate, and prepares a new corrective Inkspan version. `skip-existing`, retagging an immutable version, or long-lived token fallback are not supported recovery mechanisms.

## Workflow security properties

- Every third-party GitHub Action is pinned to a complete commit SHA.
- Syft is installed from the exact commit behind v1.50.0 with signed-checksum verification enabled; a mutable branch installer is not part of the supported generator path.
- Only the signature-verified Syft binary generates the release SBOM.
- The default and source-bearing build-job workflow tokens are read-only.
- GitHub release, OpenID Connect, and attestation permissions are scoped to the source-free jobs that actually require them.
- Release tags must identify the exact current protected-main tip.
- Stable root, Office, and tag versions must match before registry publication.
- The local and draft release contract is exactly one npm tarball, one Office wheel, `editor-package.spdx.json`, `office-package.spdx.json`, and `SHA256SUMS`.
- The draft asset set and every GitHub-reported SHA-256 asset digest must exactly match the transferred local release set before GitHub publication.
- Both SBOM digests are covered by `SHA256SUMS`, remote release-asset digest verification, and release provenance; each package attestation binds one distributable only to its matching SPDX predicate.
- The published GitHub release must report an immutable state; a mutable outcome is deleted and rejected.
- Existing published assets are never refreshed, replaced, or deleted by a successful workflow path.
- Stable npm and PyPI publication uses protected OIDC environments rather than long-lived registry secrets.
- Public registry artifacts are compared against the exact validated local artifacts after publication.
- No issue, pull-request body, comment, branch name, or other untrusted free text is interpolated into executable release commands.
- Publication is restricted to the canonical repository and tag-push event.
- Concurrency is scoped to the release tag and does not cancel an in-progress publication.

## MSA and interoperability boundary

The release pipeline does not add runtime coupling. The npm package remains a host-embedded module, the collaboration surface remains provider-neutral, and Inkspan Office remains a separate deterministic service/library boundary. CWL infrastructure and naruon can independently consume, mirror, attest, scan, or promote either artifact by digest.

## Primary references

- GitHub immutable releases and draft-first publication: <https://docs.github.com/en/repositories/releasing-projects-on-github/managing-releases-in-a-repository>
- GitHub immutable-release repository API and required permissions: <https://docs.github.com/en/rest/repos/repos?apiVersion=2026-03-10#check-if-immutable-releases-are-enabled-for-a-repository>
- GitHub List releases behavior, including authenticated draft visibility, release objects, asset `digest`, and immutable state: <https://docs.github.com/en/rest/releases/releases?apiVersion=2026-03-10#list-releases>
- GitHub Get a release by tag name published-release contract: <https://docs.github.com/en/rest/releases/releases?apiVersion=2026-03-10#get-a-release-by-tag-name>
- GitHub CLI release upload and same-name `--clobber` behavior: <https://cli.github.com/manual/gh_release_upload>
- GitHub release attestation verification: <https://cli.github.com/manual/gh_release_verify>
- GitHub artifact attestations: <https://docs.github.com/en/actions/how-tos/secure-your-work/use-artifact-attestations/use-artifact-attestations>
- GitHub artifact-attestation concepts: <https://docs.github.com/en/actions/concepts/security/artifact-attestations>
- Syft signed-release installer verification: <https://github.com/anchore/syft/blob/v1.50.0/install.sh>
- Sigstore Cosign installer: <https://github.com/sigstore/cosign-installer>
- npm Trusted Publishing and automatic provenance: <https://docs.npmjs.com/trusted-publishers/>
- PyPI Trusted Publishing: <https://docs.pypi.org/trusted-publishers/>
- PyPI Trusted Publishing security model: <https://docs.pypi.org/trusted-publishers/security-model/>
- SLSA specification: <https://slsa.dev/spec/>
