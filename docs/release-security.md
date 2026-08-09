# Release security and provenance contract

Inkspan release artifacts are part of the product boundary. Buyers and CWL/naruon integrators must be able to determine which source revision produced an npm tarball or Office wheel, verify that the artifact was not substituted, and reproduce the repository's release gates without trusting a long-lived publication secret.

## Release trigger and identity

A release starts only from a pushed semantic-version tag in the canonical `ContextualWisdomLab/inkspan` repository. The workflow rejects a tag unless all of the following are true:

- the tag has the form `vMAJOR.MINOR.PATCH`, with an optional semantic-version prerelease suffix;
- the tag exactly matches the JavaScript package version in `package.json`;
- `CHANGELOG.md` contains a release section for that version;
- package metadata still identifies the canonical public repository;
- the tagged commit is already reachable from the canonical `main` branch.

The main-ancestry gate prevents an unmerged or otherwise unreviewed commit from becoming an official release merely because a matching tag was created.

## Privilege-separated release design

Release execution is divided into two jobs with a one-way artifact boundary:

1. `build-release-artifacts` has read-only repository access. It checks identity and ancestry, installs dependencies, runs all quality gates, builds both distributions, and creates checksums.
2. `publish-release` receives only the validated files through GitHub's workflow artifact service. This smaller job alone receives `contents: write`, `id-token: write`, and `attestations: write`.

The build job cannot modify releases or request an OpenID Connect signing identity. The publish job does not check out or execute repository source, install package dependencies, run package scripts, or rebuild artifacts. This reduces the amount of third-party and repository-controlled code exposed to publication credentials.

The transferred workflow artifact is retained for one day and stored without redundant compression. Its SHA-256 manifest is checked again after download before attestation or publication.

## Release gates

The release workflow repeats the merge gates against the tagged source rather than reusing untrusted or stale build output:

1. complete-history checkout and canonical-main ancestry verification;
2. frozen JavaScript dependency installation;
3. TypeScript type checking;
4. repository-required 100% TypeScript coverage;
5. all production library builds;
6. packed-package consumer verification for ESM, CommonJS, declarations, CSS, fonts, collaboration, and converter surfaces;
7. demo build;
8. hash-locked Office dependency installation on Python 3.14;
9. Office dependency consistency, 100% shipped-symbol docstring coverage, and 100% branch coverage;
10. Office wheel construction and inspection for the bundled schema and license;
11. SHA-256 checksum generation for every distributable artifact;
12. checksum verification after the privilege boundary; and
13. exact draft asset inventory and digest verification before publication.

No release draft is created or modified unless every build gate succeeds on the tagged commit.

## Immutable publication

Immutable releases must be enabled for the canonical repository before a release tag is pushed. Reading or changing that repository setting requires Administration permission, which the release workflow intentionally does not receive. Instead, the workflow verifies the immutable state of the published release through the ordinary release API available to its narrowly scoped contents token.

Publication follows GitHub's immutable-release sequence:

1. reject an existing published release rather than replacing its assets;
2. create or resume a draft release;
3. attach the complete attested artifact set while the release is still mutable;
4. verify the exact draft asset inventory and GitHub-reported digests;
5. publish the draft;
6. require GitHub to report `isImmutable: true` for the published release;
7. verify the release attestation and every expected uploaded asset through GitHub CLI.

### Exact draft asset inventory

A resumed draft is not assumed to contain only artifacts from the current workflow attempt. `gh release upload --clobber` replaces an existing asset with the same name, but an unexpected stale asset with a different name can otherwise remain attached to the draft. Once an immutable release is published, every attached asset is frozen with that release identity.

Immediately after upload and before the draft is published, the workflow therefore fails closed unless all of these conditions hold:

- the local release directory contains exactly one npm `*.tgz`, one Office `*.whl`, and `SHA256SUMS`;
- the canonical GitHub Releases API still reports the release as a draft;
- the sorted remote asset-name set exactly equals the sorted local artifact-name set;
- every remote asset reports the `uploaded` state; and
- every GitHub release-asset `sha256:` digest exactly equals a newly computed SHA-256 digest of the corresponding transferred local file.

The draft lookup deliberately uses the authenticated, paginated **List releases** REST endpoint and filters its complete result for the exact tag. GitHub documents that authenticated callers with repository push access receive draft releases from this endpoint. The `Get a release by tag name` endpoint is documented for a **published** release, so it is not used as evidence for this pre-publication gate. The publish job fails unless the paginated listing contains exactly one release matching the tag and that object still reports `draft: true`.

An unexpected stale asset is not deleted automatically. The workflow stops before the draft is published and directs an operator to remove the stale draft or unexpected asset, then rerun from the reviewed tag. This avoids silently deleting an operator-created draft artifact while ensuring that unrelated content cannot become part of an immutable Inkspan release by persistence across retries.

The exact-inventory comparison names only public release artifacts and does not expose source files, credentials, tenant data, document content, or local absolute paths. The gate also does not claim to prevent a repository administrator from deliberately mutating a draft in the narrow interval between validation and publication; repository administration remains a higher authority boundary. Tag-scoped workflow concurrency prevents competing release-workflow runs for the same tag.

If GitHub reports that the newly published release is mutable, the workflow immediately deletes that release and fails. This rollback leaves the tag available for a retry after an administrator enables release immutability; it does not treat a mutable publication as a successful product release. If rollback itself fails, the workflow emits an explicit high-severity error and remains failed for operator intervention.

A failed rerun may repair same-name assets in an existing draft with `--clobber`, but it can never overwrite a published release. A new successful release identity therefore requires a new reviewed version and tag unless the previous attempt ended only as a deleted mutable release or an unpublished draft. Any unrelated asset left in that unpublished draft is a hard pre-publication failure rather than silently retained content.

Enabling immutable releases is an administrative repository control. Repository owners can enable it in GitHub settings or with the `PUT /repos/ContextualWisdomLab/inkspan/immutable-releases` endpoint using a credential with repository Administration write permission. The release workflow cannot weaken or silently enable the policy.

## Published artifacts

Each successful GitHub release contains:

- the exact npm tarball produced by `npm pack`;
- the `inkspan-office` wheel built from `office/`;
- `SHA256SUMS` covering both distributable artifacts.

The workflow does not rebuild artifacts after the read-only build job. The same transferred files are checksum-verified, attested, uploaded, inventory-checked against the draft, and then published.

## Provenance and verification

The isolated publish job requests a short-lived OpenID Connect identity and uses GitHub artifact attestations to create signed SLSA provenance for the npm tarball, Office wheel, and checksum manifest. The repository is public, so the attestation is backed by the public Sigstore transparency infrastructure used by GitHub.

Consumers should verify release-level and file-level provenance as well as checksums:

```bash
gh release verify v0.4.2 --repo ContextualWisdomLab/inkspan

gh release verify-asset v0.4.2 contextualwisdomlab-cwl-editor-0.4.2.tgz \
  --repo ContextualWisdomLab/inkspan

gh attestation verify inkspan_office-0.1.0-py3-none-any.whl \
  --repo ContextualWisdomLab/inkspan

sha256sum --check SHA256SUMS
```

Use the actual version and filenames from the selected release. A successful attestation proves which repository, workflow, event, and commit built an artifact; it does not by itself prove that the source code is defect-free. Consumers must still apply their own vulnerability, license, policy, and deployment review.

## Workflow security properties

- Every third-party GitHub Action is pinned to a complete commit SHA.
- The default and build-job workflow tokens are read-only.
- Write, OpenID Connect, and attestation permissions exist only in the source-free publish job.
- Release tags must identify a commit already merged into `main`.
- The draft asset set and every GitHub-reported SHA-256 asset digest must exactly match the transferred local release set before publication.
- The published release must report an immutable state; a mutable outcome is deleted and rejected.
- Existing published assets are never refreshed, replaced, or deleted by a successful workflow path.
- No issue, pull-request body, comment, branch name, or other untrusted free text is interpolated into executable release commands.
- Publication is restricted to the canonical repository and tag-push event.
- The workflow uses no long-lived npm, PyPI, cloud, or signing secret.
- Concurrency is scoped to the release tag and does not cancel an in-progress publication.

## External registries

GitHub releases are the initial authenticated distribution channel. npm and PyPI publication should use their respective Trusted Publishing mechanisms rather than repository secrets. Registry publication remains disabled until the package owners configure the canonical repository and release workflow as trusted publishers and establish the required protected environment approval policy.

Enabling registry publication is a separate, reviewed change because a publishing workflow is security-equivalent to a package registry credential. It must not be enabled speculatively or with a long-lived automation token. A registry publishing job should consume the same validated artifact boundary and must not rebuild packages under publication credentials.

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
- npm Trusted Publishing and automatic provenance: <https://docs.npmjs.com/trusted-publishers/>
- PyPI Trusted Publishing: <https://docs.pypi.org/trusted-publishers/>
- PyPI Trusted Publishing security model: <https://docs.pypi.org/trusted-publishers/security-model/>
- SLSA specification: <https://slsa.dev/spec/>
