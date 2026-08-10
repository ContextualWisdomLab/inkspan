# npm and PyPI trusted publishing — release doctoring

Status: Implemented on active PR

## Purpose

Inkspan already produces an exact npm tarball, `inkspan-office` wheel and `SHA256SUMS`, verifies them across the privilege boundary, creates GitHub artifact attestations, validates the draft GitHub Release inventory/digests, and publishes an immutable GitHub Release. This record defines the additional package-registry trust boundary needed for buyers to install the same reviewed **stable** release through npm and PyPI without storing long-lived registry write credentials in GitHub Secrets.

Registry publishing is release control-plane behavior. It does not change Inkspan runtime transport, authentication, authorization, tenant isolation, persistence, collaboration, model, or document authority.

## npm Trusted Publishing

npm's current Trusted Publishing documentation defines an OIDC-based publication path for GitHub Actions that removes long-lived npm publish tokens. For GitHub Actions, the trusted publisher configuration binds the npm package to the GitHub organization/user, repository, workflow filename, optional GitHub Environment, and allowed publish action.

The current documented runtime floor is **npm CLI 11.5.1** and **Node.js 22.14.0**. npm documents GitHub-hosted runners as supported for this feature and requires the publishing job to request `id-token: write`. For public packages published through Trusted Publishing from a public GitHub repository, npm automatically generates provenance. npm also requires `package.json.repository.url` to identify the GitHub repository correctly.

Inkspan therefore uses a GitHub-hosted `ubuntu-24.04` registry job, Node 24, a runtime npm-version floor check, job-local `id-token: write`, and direct publication of the exact transferred `.tgz`. It does not set `NODE_AUTH_TOKEN`, `NPM_TOKEN`, or a long-lived npm automation secret.

The external npm prerequisite cannot be created by repository code: package `@contextualwisdomlab/cwl-editor` must be configured on npmjs.com to trust `ContextualWisdomLab/inkspan`, workflow `release.yml`, **environment `npm`**, and the applicable publish action. Repository CI must never claim that trust relationship exists merely because the workflow syntax is correct.

## PyPI Trusted Publishing

PyPI's Trusted Publisher model similarly uses GitHub Actions OIDC identity to mint a short-lived upload token. PyPI binds a publisher to the project, GitHub owner, repository, workflow filename and optional environment. GitHub and PyPI documentation require `id-token: write` on the publishing job; username/password inputs are omitted when using the Trusted Publisher flow.

The official PyPA GitHub Action is the supported publication adapter. The published `v1.14.2` tag resolves to immutable commit `dc37677b2e1c63e2034f94d8a5b11f265b73ba33`; Inkspan pins that complete commit rather than a moving tag. The job receives an isolated directory containing exactly the already validated Office wheel and does not rebuild Python code under OIDC authority. PyPI's Trusted Publishing flow also produces publish attestations by default through the official action.

The external PyPI prerequisite likewise cannot be fabricated by code: project `inkspan-office` must trust `ContextualWisdomLab/inkspan`, workflow `release.yml`, and **environment `pypi`** before a live production release can succeed.

## Artifact and privilege boundary

The read-oriented release build remains responsible for source checkout, dependency installation, tests, coverage, JavaScript packaging, Office wheel construction, checksums and the exact package identity. Browser assurance tests the exact transferred npm tarball. The existing source-free GitHub publication job attests and publishes the same artifact set.

Registry jobs run only after that GitHub publication boundary succeeds. They download the same workflow artifact by its tag-scoped name, re-run `SHA256SUMS`, require exactly one relevant distributable, and publish that exact file. They do not check out source, install repository dependencies, run package scripts, rebuild either artifact, or receive repository write permission.

OIDC authority is job-local. Workflow-global and build-job permissions remain read-only. This preserves least privilege and makes the registry identity a short-lived release capability rather than a reusable secret.

## Unified stable release version identity

The current repository publishes the npm tarball and Office wheel in one semantic-tagged GitHub Release. Registry publication makes historical independent package version numbers operationally ambiguous because PyPI versions are immutable and a later stable Inkspan release cannot safely pretend an old Office version is newly published from a new protected source.

ADR 0019 therefore adopts **one release version train** for stable trusted publication. For `vMAJOR.MINOR.PATCH`, the release tag, root npm package version, and Office package version must agree before registry publication. The historical Office `0.1.0` line is not rewritten; release preparation for the first stable trusted-publishing release must explicitly align the Office manifest to the selected Inkspan version through normal reviewed version/changelog work.

SemVer and PEP 440 do not spell all prerelease versions identically. The first trusted-publishing baseline therefore leaves tags with a SemVer prerelease suffix on the existing GitHub Release path and does not run the npm/PyPI registry jobs for them. This preserves current prerelease distribution without inventing a hidden version mapping inside the OIDC workflow. Registry prereleases require a later accepted mapping/versioning contract.

This decision intentionally prefers a simple acquisition/release identity for stable artifacts over an independently incremented Office version cadence. A future independent Office release train or registry prerelease mapping requires a superseding ADR and separate tag/provenance/rollback authority.

## Failure and non-atomic recovery

Publishing to GitHub, npm and PyPI cannot be made globally atomic: each service owns an independent immutable or partially immutable publication transaction. A registry outage or external trust misconfiguration can therefore occur after GitHub Release publication or after one package registry has accepted its artifact.

Inkspan treats this as an explicit **non-atomic** release incident. The workflow does not use permissive `skip-existing`, does not overwrite an already published package version, and does not substitute a long-lived token when OIDC fails. Operators preserve the partial publication evidence, use registry-supported deprecation/yank controls only when appropriate, repair the external Trusted Publisher/environment configuration, and issue a new reviewed **corrective release** when an immutable version cannot be completed consistently.

A rerun of the same stable tag is acceptable only while the target registry version has not been published and all repository/GitHub release identity gates still hold. If a package version already exists, the release lane requires operator reconciliation rather than silently treating an upload skip as evidence that the current protected artifact reached that registry.

A GitHub-only prerelease is not a registry failure under this baseline; its registry jobs are intentionally absent. Operators must not manually publish that prerelease with a token to circumvent the documented scope.

## GitHub Environment governance

The stable release workflow names environments `npm` and `pypi`. Environment configuration is external governance, not source code. Repository owners should restrict those environments to protected release tags as supported, configure any required reviewers/separation of duties, and ensure the exact environment names match the npm/PyPI Trusted Publisher registrations.

A missing environment or required environment approval is not a reason to weaken registry security. It blocks that release lane while unrelated Inkspan work continues.

## Verification and claim limits

Repository-level acceptance verifies:

- current npm/Node minimums are represented;
- no long-lived npm/PyPI publish token is referenced;
- job-local OIDC permission is present and build/global OIDC permission is absent;
- the official PyPA action is immutably pinned;
- exact artifact download/checksum/isolation occurs without source rebuild;
- duplicate-version permissiveness is absent;
- stable package/tag release identity is enforced;
- prerelease tags remain GitHub-only until a later version-mapping decision; and
- non-atomic recovery and external prerequisites are documented.

These checks do **not** prove that npmjs.com or PyPI has accepted the Trusted Publisher configuration, that a GitHub Environment reviewer approved a live deployment, or that a package has been published. Those are live release-acceptance facts and must be verified from the registry after the actual exact-tip stable release run.

## References — APA 7th

GitHub. (2026). *Configuring OpenID Connect in PyPI*. GitHub Docs. Retrieved August 10, 2026, from https://docs.github.com/en/actions/how-tos/secure-your-work/security-harden-deployments/oidc-in-pypi

npm, Inc. (2026). *Trusted publishing for npm packages*. npm Docs. Retrieved August 10, 2026, from https://docs.npmjs.com/trusted-publishers/

Python Packaging Authority. (2026). *Publish Python distributions to PyPI*. GitHub Marketplace. Retrieved August 10, 2026, from https://github.com/marketplace/actions/pypi-publish

Python Package Index. (2026). *Trusted publishers*. PyPI Docs. Retrieved August 10, 2026, from https://docs.pypi.org/trusted-publishers/

Python Package Index. (2026). *Using a trusted publisher*. PyPI Docs. Retrieved August 10, 2026, from https://docs.pypi.org/trusted-publishers/using-a-publisher/
