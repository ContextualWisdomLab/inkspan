# Release security and provenance contract

Inkspan release artifacts are part of the product boundary. Buyers and CWL/naruon integrators must be able to determine which source revision produced an npm tarball or Office wheel, verify that the artifact was not substituted, and reproduce the repository's release gates without trusting a long-lived publication secret.

## Release trigger and identity

A release starts only from a pushed semantic-version tag in the canonical `ContextualWisdomLab/inkspan` repository. The workflow rejects a tag unless all of the following are true:

- the tag has the form `vMAJOR.MINOR.PATCH`, with an optional semantic-version prerelease suffix;
- the tag exactly matches the JavaScript package version in `package.json`;
- `CHANGELOG.md` contains a release section for that version;
- package metadata still identifies the canonical public repository.

The tag points at the exact source revision that is checked out and built. A release rerun refreshes the assets attached to the same GitHub release instead of creating a second release identity.

## Release gates

The release workflow repeats the merge gates against the tagged source rather than reusing untrusted or stale build output:

1. frozen JavaScript dependency installation;
2. TypeScript type checking;
3. repository-required 100% TypeScript coverage;
4. all production library builds;
5. packed-package consumer verification for ESM, CommonJS, declarations, CSS, fonts, collaboration, and converter surfaces;
6. demo build;
7. hash-locked Office dependency installation on Python 3.14;
8. Office dependency consistency, 100% shipped-symbol docstring coverage, and 100% branch coverage;
9. wheel construction without dependency resolution or build isolation;
10. SHA-256 checksum generation for every distributable artifact.

The release job fails closed. No GitHub release asset is created or replaced unless every gate succeeds on the tagged commit.

## Published artifacts

Each GitHub release contains:

- the exact npm tarball produced by `npm pack`;
- the `inkspan-office` wheel built from `office/`;
- `SHA256SUMS` covering both distributable artifacts.

The workflow does not rebuild artifacts after attestation. The same files that are attested are uploaded to the release.

## Provenance and verification

GitHub Actions requests a short-lived OpenID Connect identity and uses GitHub artifact attestations to create signed SLSA provenance for the npm tarball, Office wheel, and checksum manifest. The repository is public, so the attestation is backed by the public Sigstore transparency infrastructure used by GitHub.

Consumers should verify both provenance and checksums:

```bash
gh attestation verify contextualwisdomlab-cwl-editor-0.4.1.tgz \
  --repo ContextualWisdomLab/inkspan

gh attestation verify inkspan_office-0.1.0-py3-none-any.whl \
  --repo ContextualWisdomLab/inkspan

sha256sum --check SHA256SUMS
```

Use the actual filenames from the selected release. A successful attestation proves which repository, workflow, event, and commit built an artifact; it does not by itself prove that the source code is defect-free. Consumers must still apply their own vulnerability, license, policy, and deployment review.

## Workflow security properties

- Every third-party GitHub Action is pinned to a complete commit SHA.
- The default workflow token is read-only; write permissions are granted only to the release job.
- The release job receives only `contents: write`, `id-token: write`, and `attestations: write`.
- No issue, pull-request body, comment, branch name, or other untrusted free text is interpolated into executable release commands.
- Publication is restricted to the canonical repository and tag-push event.
- The workflow uses no long-lived npm, PyPI, cloud, or signing secret.
- Concurrency is scoped to the release tag and does not cancel an in-progress publication.

## External registries

GitHub releases are the initial authenticated distribution channel. npm and PyPI publication should use their respective Trusted Publishing mechanisms rather than repository secrets. Registry publication remains disabled until the package owners configure the canonical repository and `release.yml` as trusted publishers and establish the required environment approval policy.

Enabling registry publication is a separate, reviewed change because a publishing workflow is security-equivalent to a package registry credential. It must not be enabled speculatively or with a long-lived automation token.

## MSA and interoperability boundary

The release pipeline does not add runtime coupling. The npm package remains a host-embedded module, the collaboration surface remains provider-neutral, and Inkspan Office remains a separate deterministic service/library boundary. CWL infrastructure and naruon can independently consume, mirror, attest, scan, or promote either artifact by digest.

## Primary references

- GitHub artifact attestations: <https://docs.github.com/en/actions/how-tos/secure-your-work/use-artifact-attestations/use-artifact-attestations>
- GitHub artifact-attestation concepts: <https://docs.github.com/en/actions/concepts/security/artifact-attestations>
- npm Trusted Publishing and automatic provenance: <https://docs.npmjs.com/trusted-publishers/>
- PyPI Trusted Publishing: <https://docs.pypi.org/trusted-publishers/>
- PyPI Trusted Publishing security model: <https://docs.pypi.org/trusted-publishers/security-model/>
- SLSA specification: <https://slsa.dev/spec/>
