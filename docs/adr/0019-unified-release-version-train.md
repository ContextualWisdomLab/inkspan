# ADR 0019: Unified npm and Office release version train

Status: Proposed

## Context

Inkspan's tag-triggered release workflow already treats the JavaScript editor tarball and `inkspan-office` wheel as one release artifact set: one semantic-version tag builds both, one checksum manifest covers both, one GitHub Release publishes both, and the release is accepted or rejected as one protected-source event.

Until registry publication is enabled, the two package manifests have independent historical versions: the JavaScript package has advanced through the Inkspan release line while `office/pyproject.toml` remains at its earlier package version. That is harmless for GitHub Release attachment names, but it becomes an operational defect once every accepted Inkspan tag is expected to publish both artifacts to immutable registries. PyPI will not accept a second distribution for an already published version, and permissively skipping an existing version would let a later Inkspan release appear complete without proving that its Office artifact is the registry artifact buyers receive.

The architectural decision is therefore whether the monorepo keeps one product release train, introduces independent tag/release workflows, or makes registry publication conditionally infer whether one package changed.

## Alternatives considered

### Independent package tags and release workflows

Use `vX.Y.Z` for npm and a separate Office tag namespace/workflow for PyPI. Rejected for the current product boundary because the protected release contract, checksum manifest, browser/package evidence and GitHub Release already define the two distributables as one buyer-reviewable Inkspan release. Splitting tags now would duplicate release authority and make one source generation carry multiple partially overlapping release identities.

### Conditional PyPI publication based on registry existence

Publish the wheel when its version is absent and treat an existing version as success. Rejected because registry existence alone does not prove that the existing immutable wheel was built from the current protected source. It can also hide a source change made without a version bump.

### Conditional publication based on source-diff inference

Infer whether `office/` changed since a previous tag and publish only then. Rejected for the first trusted-publishing baseline because release acceptance would depend on historical tag discovery and change classification in addition to exact current-source evidence. It also preserves two version timelines inside one GitHub Release identity.

### Unified release version train

Require the root JavaScript package version and the Office package version to equal the semantic version in the release tag before either registry publication is possible. Selected because it matches the repository's existing single-tag/single-artifact-set release authority and makes every accepted release self-describing across GitHub, npm and PyPI.

## Decision

Inkspan uses one semantic product release version for the JavaScript package and the Office package. A `vMAJOR.MINOR.PATCH[-prerelease]` release tag is valid only when:

1. it equals the version in root `package.json`;
2. it equals the PEP 440-compatible Office version in `office/pyproject.toml` for release versions representable in both ecosystems;
3. `CHANGELOG.md` contains the corresponding Inkspan release section; and
4. the tag points to the exact current protected-main tip under the release authority contract.

Registry publishing consumes the exact tarball and wheel created by that accepted release. It does not independently bump, rewrite, rebuild, or infer a package version.

The next production release that enables registry publication must therefore reconcile the historical Office version to the selected Inkspan release version as part of ordinary release preparation. This ADR does **not** bump a version by itself.

## Consequences

- npm, PyPI, GitHub Release and the protected source generation share one human-readable release identity.
- An Inkspan patch release produces a correspondingly versioned Office wheel even when the Office implementation did not change. This is deliberate release-train versioning rather than a claim that every package changed semantically.
- Registry duplicate-version failures become actionable release-preparation defects instead of conditions hidden by `skip-existing`.
- Buyers can correlate a tarball and wheel from the same release without consulting a cross-version matrix.
- The repository gives up independent Office semantic-version cadence while both artifacts remain part of one release train.

## Failure and recovery

A tag whose root and Office versions differ fails before registry OIDC publication. Operators must not retag an already published version, mutate a published registry artifact, enable `skip-existing`, or use a long-lived token to bypass the mismatch.

Before any registry publication has occurred for the attempted version, recovery is to update the package versions and CHANGELOG on protected main through normal review, then create the new exact-tip release tag.

If one registry has already accepted a release and another registry fails, the release is a partial-publication incident. Immutable published package versions are not replaced. Recovery uses the registry's supported deprecation/yank controls where appropriate plus a new corrective Inkspan version, preserving provenance for the partial release.

## Security and privacy impact

Version equality is release metadata only. It introduces no runtime credential, tenant data, document content, model data, network dependency, authorization claim, or persistence authority.

The rule reduces dependency-confusion and provenance ambiguity by preventing one GitHub release from claiming a new protected source while silently reusing an old-version Office registry identity.

## Compatibility and migration

Current source consumers are unaffected. The change becomes externally visible only when registry publication is enabled and the next release preparation aligns both package manifests.

Existing historical GitHub Release examples or package versions are not rewritten. Documentation must distinguish historical independent Office versions from the unified train adopted for trusted registry publication.

If future product strategy requires independent Office releases, supersede this ADR with separate tag namespaces, artifact/provenance authorities, registry workflows, changelogs, rollback procedures, and buyer compatibility rules rather than silently weakening the equality gate.

## Verification and acceptance evidence

Before this decision becomes Accepted:

- a permanent workflow contract must require root/Office/tag version equality;
- release identity must still require the exact current protected-main tip;
- npm and PyPI jobs must consume the exact validated transferred artifacts;
- no permissive duplicate-version skipping is allowed;
- the release doctoring must record external Trusted Publisher prerequisites and non-atomic recovery; and
- exact-head CI, security, review and protected integration must pass.

A live registry release remains separate operational acceptance evidence. An implemented workflow cannot prove that npmjs.com or PyPI has been configured to trust it.

## Rollback or supersession

Before a live trusted-publishing release, rollback removes the proposed registry jobs and equality gate while retaining GitHub Release as the distribution channel. After live publication under this train, independent package cadence requires a superseding ADR and explicit release-contract migration; it is not a one-line workflow relaxation.
