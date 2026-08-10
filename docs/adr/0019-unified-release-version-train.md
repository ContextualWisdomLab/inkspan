# ADR 0019: Unified npm and Office release version train

Status: Proposed

## Context

Inkspan's tag-triggered release workflow already treats the JavaScript editor tarball and `inkspan-office` wheel as one release artifact set: one semantic-version tag builds both, one checksum manifest covers both, one GitHub Release publishes both, and the release is accepted or rejected as one protected-source event.

Until registry publication is enabled, the two package manifests have independent historical versions: the JavaScript package has advanced through the Inkspan release line while `office/pyproject.toml` remains at its earlier package version. That is harmless for GitHub Release attachment names, but it becomes an operational defect once every accepted **stable registry release** is expected to publish both artifacts to immutable registries. PyPI will not accept a second distribution for an already published version, and permissively skipping an existing version would let a later Inkspan release appear complete without proving that its Office artifact is the registry artifact buyers receive.

A second compatibility constraint is that SemVer and PEP 440 spell many prerelease versions differently. Requiring byte-identical version strings for arbitrary prereleases would either reject otherwise valid package versions or silently introduce an undocumented cross-ecosystem mapping.

The architectural decision is therefore whether the monorepo keeps one product release train, introduces independent tag/release workflows, conditionally infers whether one package changed, or limits the first trusted-publishing train to stable versions where the same `MAJOR.MINOR.PATCH` string is valid in both ecosystems.

## Alternatives considered

### Independent package tags and release workflows

Use `vX.Y.Z` for npm and a separate Office tag namespace/workflow for PyPI. Rejected for the current product boundary because the protected release contract, checksum manifest, browser/package evidence and GitHub Release already define the two distributables as one buyer-reviewable Inkspan release. Splitting tags now would duplicate release authority and make one source generation carry multiple partially overlapping release identities.

### Conditional PyPI publication based on registry existence

Publish the wheel when its version is absent and treat an existing version as success. Rejected because registry existence alone does not prove that the existing immutable wheel was built from the current protected source. It can also hide a source change made without a version bump.

### Conditional publication based on source-diff inference

Infer whether `office/` changed since a previous tag and publish only then. Rejected for the first trusted-publishing baseline because release acceptance would depend on historical tag discovery and change classification in addition to exact current-source evidence. It also preserves two version timelines inside one GitHub Release identity.

### Map arbitrary SemVer prereleases into PEP 440

Translate values such as SemVer `-beta.1` to a PEP 440 spelling such as `b1`. Deferred. A cross-ecosystem prerelease mapping is a public compatibility contract with edge cases around identifiers, ordering and canonicalization. It is not needed to establish a production stable-release path and should not be improvised inside a credential-bearing workflow.

### Unified stable release version train

For registry publication, require the root JavaScript package version and Office package version to equal the stable semantic version in the release tag. Keep prerelease tags eligible for the existing GitHub Release path but do not send them to npm/PyPI until a later accepted prerelease-mapping contract exists. Selected because it matches the repository's existing single-tag/single-artifact-set release authority, preserves current GitHub prerelease behavior, and makes every **stable registry release** self-describing across GitHub, npm and PyPI.

## Decision

Inkspan uses one stable product release version for the JavaScript and Office registry artifacts. For a stable `vMAJOR.MINOR.PATCH` release to enter npm/PyPI publication:

1. the tag equals the version in root `package.json`;
2. the Office version in `office/pyproject.toml` equals the same `MAJOR.MINOR.PATCH` value;
3. `CHANGELOG.md` contains the corresponding Inkspan release section;
4. the tag points to the exact current protected-main tip under the release authority contract; and
5. the existing package, browser, Office, checksum, attestation and immutable GitHub Release gates succeed.

Registry publishing consumes the exact tarball and wheel created by that accepted release. It does not independently bump, rewrite, rebuild, infer or normalize a package version.

A tag containing a SemVer prerelease suffix remains eligible for the pre-existing GitHub Release workflow when its root package/tag contract is otherwise valid, but the npm/PyPI trusted-publishing jobs do not run for that tag under this ADR. A future prerelease registry path requires an accepted mapping/versioning decision rather than an implicit string transformation.

The next **stable** production release that enables registry publication must therefore reconcile the historical Office version to the selected Inkspan release version as part of ordinary release preparation. This ADR does **not** bump a version by itself.

## Consequences

- Stable npm, PyPI, GitHub Release and protected source generation share one human-readable release identity.
- An Inkspan stable patch release produces a correspondingly versioned Office wheel even when the Office implementation did not change. This is deliberate release-train versioning rather than a claim that every package changed semantically.
- GitHub-only prereleases remain possible without inventing a SemVer/PEP 440 registry mapping.
- Registry duplicate-version failures become actionable release-preparation defects instead of conditions hidden by `skip-existing`.
- Buyers can correlate stable tarball and wheel versions without consulting a cross-version matrix.
- The repository gives up independent Office semantic-version cadence for stable releases while both artifacts remain part of one release train.

## Failure and recovery

A stable tag whose root and Office versions differ fails before registry OIDC publication. Operators must not retag an already published version, mutate a published registry artifact, enable `skip-existing`, or use a long-lived token to bypass the mismatch.

A prerelease tag does not enter the registry jobs. It is not treated as a registry publication failure because trusted registry publication is deliberately out of scope for prereleases under this decision; GitHub Release remains its distribution path.

Before any registry publication has occurred for the attempted stable version, recovery is to update the package versions and CHANGELOG on protected main through normal review, then create the new exact-tip release tag.

If one registry has already accepted a stable release and another registry fails, the release is a partial-publication incident. Immutable published package versions are not replaced. Recovery uses the registry's supported deprecation/yank controls where appropriate plus a new corrective Inkspan version, preserving provenance for the partial release.

## Security and privacy impact

Version equality is release metadata only. It introduces no runtime credential, tenant data, document content, model data, network dependency, authorization claim, or persistence authority.

The rule reduces dependency-confusion and provenance ambiguity by preventing one stable GitHub release from claiming a new protected source while silently reusing an old-version Office registry identity. Keeping prerelease mapping out of the credential-bearing path also avoids a hidden version-normalization authority.

## Compatibility and migration

Current source consumers and GitHub-only prereleases are unaffected. The stable equality rule becomes externally visible only when registry publication is enabled and the next stable release preparation aligns both package manifests.

Existing historical GitHub Release examples or package versions are not rewritten. Documentation must distinguish historical independent Office versions from the unified stable train adopted for trusted registry publication.

If future product strategy requires independent Office releases or registry prereleases, supersede this ADR with explicit tag namespaces or a cross-ecosystem prerelease mapping, artifact/provenance authorities, registry workflows, changelogs, rollback procedures, and buyer compatibility rules rather than silently weakening the stable equality gate.

## Verification and acceptance evidence

Before this decision becomes Accepted:

- a permanent workflow contract must require stable root/Office/tag version equality before registry publication;
- registry jobs must be explicitly excluded for prerelease tags under this baseline;
- release identity must still require the exact current protected-main tip;
- npm and PyPI jobs must consume the exact validated transferred artifacts;
- no permissive duplicate-version skipping is allowed;
- the release doctoring must record external Trusted Publisher prerequisites and non-atomic recovery; and
- exact-head CI, security, review and protected integration must pass.

A live registry release remains separate operational acceptance evidence. An implemented workflow cannot prove that npmjs.com or PyPI has been configured to trust it.

## Rollback or supersession

Before a live trusted-publishing release, rollback removes the proposed registry jobs and stable equality gate while retaining GitHub Release as the distribution channel. After live publication under this train, independent package cadence or registry prereleases require a superseding ADR and explicit release-contract migration; they are not one-line workflow relaxations.
