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
12. checksum verification after the privilege boundary.

No release draft is created or modified unless every build gate succeeds on the tagged commit.

## Immutable publication

Immutable releases must be enabled for the canonical repository before a release tag is pushed. The publish job checks the GitHub repository setting through the current REST API and fails closed when the setting is disabled or cannot be verified.

Publication follows GitHub's immutable-release sequence:

1. reject an existing published release rather than replacing its assets;
2. create or resume a draft release;
3. attach the complete attested artifact set while the release is still mutable;
4. publish the draft, making the release assets and associated tag immutable;
5. verify the release attestation and every uploaded asset through GitHub CLI.

A failed rerun may repair an existing draft with `--clobber`, but it can never overwrite a published release. A new release identity therefore requires a new reviewed version and tag.

Enabling immutable releases is an administrative repository control. Repository owners can enable it in GitHub settings or with the `PUT /repos/ContextualWisdomLab/inkspan/immutable-releases` endpoint using a credential with repository Administration write permission. The release workflow itself intentionally lacks that permission and cannot weaken or silently enable the policy.

## Published artifacts

Each GitHub release contains:

- the exact npm tarball produced by `npm pack`;
- the `inkspan-office` wheel built from `office/`;
- `SHA256SUMS` covering both distributable artifacts.

The workflow does not rebuild artifacts after the read-only build job. The same transferred files are checksum-verified, attested, and uploaded to the release.

## Provenance and verification

The isolated publish job requests a short-lived OpenID Connect identity and uses GitHub artifact attestations to create signed SLSA provenance for the npm tarball, Office wheel, and checksum manifest. The repository is public, so the attestation is backed by the public Sigstore transparency infrastructure used by GitHub.

Consumers should verify release-level and file-level provenance as well as checksums:

```bash
gh release verify v0.4.1 --repo ContextualWisdomLab/inkspan

gh release verify-asset v0.4.1 contextualwisdomlab-cwl-editor-0.4.1.tgz \
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
- Immutable-release enforcement is verified before any release draft is created or modified.
- Published assets are never refreshed, replaced, or deleted by the workflow.
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
- GitHub immutable-release repository API: <https://docs.github.com/en/rest/repos/repos?apiVersion=2026-03-10#check-if-immutable-releases-are-enabled-for-a-repository>
- GitHub release attestation verification: <https://cli.github.com/manual/gh_release_verify>
- GitHub artifact attestations: <https://docs.github.com/en/actions/how-tos/secure-your-work/use-artifact-attestations/use-artifact-attestations>
- GitHub artifact-attestation concepts: <https://docs.github.com/en/actions/concepts/security/artifact-attestations>
- npm Trusted Publishing and automatic provenance: <https://docs.npmjs.com/trusted-publishers/>
- PyPI Trusted Publishing: <https://docs.pypi.org/trusted-publishers/>
- PyPI Trusted Publishing security model: <https://docs.pypi.org/trusted-publishers/security-model/>
- SLSA specification: <https://slsa.dev/spec/>
