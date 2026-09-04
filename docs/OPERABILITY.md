# Inkspan Operability and Recovery

Status: Protected-main canonical baseline

## Operational model

Inkspan is a library/product module, not a host control plane. It owns deterministic editor, conversion, evidence, local autosave ordering, package, and provider-neutral adapter behavior. A host owns network transport, authentication, authorization, tenant isolation, persistence, credentials, migrations, retention, deployment, durable audit storage, collaboration-provider lifecycle, and model-use policy.

This distinction controls incident ownership: an Inkspan incident is a deterministic package/editor/conversion/evidence defect or a violated public boundary. A host outage, database failure, provider outage, tenant authorization failure, or model-provider failure is a host incident unless Inkspan caused or amplified it through an explicit adapter contract.

Protected `main` is the shipped implementation authority. Open PRs are not operational authority until protected integration.

## Health and evidence

Inkspan itself does not expose a network health endpoint. Operational health is proven through exact-head CI and package-consumer evidence, deterministic runtime outcomes, bounded public errors, security scans, package/release verification, and host-observable local state.

Hosts may derive UI or private local observability from bounded lifecycle/snapshot state, but complete document bodies, revision/entity tags, durable validators, provider metadata, awareness state, tenant identifiers, schema identity, browser evidence, prompts, model outputs, or comparable tenant-confidential/release-sensitive values must never become public high-cardinality metric labels or unauthenticated logs. Any separate sharing is authenticated, purpose-bound, minimum-disclosure, and host-authorized; that separate channel does not redefine public telemetry as safe.

## Autosave operations

The local autosave queue is single-flight with bounded pending work. Durable sessions use a host/server-selected strong HTTP entity tag for compare-and-swap. A local SHA-256 document revision is not a durable validator.

Operational states are `idle`, `saving`, `blocked`, `closing`, and `closed`. Blocked conflict or ambiguous failure requires explicit recovery. No-op lifecycle operations do not manufacture synthetic state changes. Observer exceptions are presentation/telemetry failures and must not change persistence ordering. The explicit in-process `getSnapshot()` coordination surface may contain bounded active/pending/last-saved validator fields; operators must classify those values as confidential local concurrency metadata rather than generic diagnostics.

Host operators should treat:

- conflict as a durable concurrency event requiring authenticated compare/merge/fork/reload policy;
- ambiguous transport failure as unknown durable state until the host proves the result;
- malformed or missing strong validators as a fail-closed host integration defect;
- repeated blocked state as a host-visible error requiring user/operator recovery rather than automatic silent retries.

## Collaboration operations

The host creates, authorizes, monitors, and destroys the Yjs-compatible provider. Inkspan must not own provider credentials, reconnect policy, room authorization, awareness retention, tenant admission, or durable update storage. When the provider is unavailable, the embedding host decides whether local editing remains available, becomes read-only, or blocks. Inkspan does not invent durable collaboration success.

## Deterministic conversion operations

Markdown/HTML/editor conversion and Office rendering are deterministic local operations. Office rendering runs without model, external network, macro, or Desktop Office authority. Inputs are bounded and validated before publication. On validation or publication failure, the operation fails with bounded diagnostics; operators must not reuse a partial artifact as successful output.

File publication must follow the documented atomic/non-overwrite behavior. A caller-requested overwrite remains explicit. A failed write or validation does not authorize cleanup of unrelated host files.

## Cross-engine clipboard assurance operations

SafeClipboard and the browser-realistic release assurance are shipped on protected `main`. The protected gate uses dependency-locked **Playwright 1.62.0** Chromium, Firefox, and WebKit projects and binds every result to one **exact source head**, one browser-test lock digest, one committed synthetic corpus version, and one **fresh run identity**. On the tag release path it additionally tests the exact **packed npm artifact** produced by the release build and records the artifact's byte-derived **SHA-256**.

A tagged release candidate is eligible only when the tag commit **exactly equals the current protected `main` integration tip** used as release authority. Reachability is not equivalence: a tag on an older commit that is merely an ancestor of current `main`, or on a feature branch, is stale release evidence even if every test on that commit is green. Operators must record and compare the fetched protected-main tip SHA and the tag event `GITHUB_SHA` before treating the browser evidence as release-candidate evidence.

The protected workflow enforces this exact-tip policy by fetching `origin/main`, resolving the fetched tip SHA, and requiring the tag event `GITHUB_SHA` to equal it before build or publication continues. The permanent release contract rejects a merely reachable predecessor and a non-main tag source; predecessor-head workflow evidence does not transfer after protected `main` moves.

Treat missing, skipped, cancelled, provisioning-failed, incomplete, stale-run, stale-lock, package-mismatched, stale-tag, or semantically divergent browser evidence as a **fail closed** release condition. Do not silently drop one engine or substitute predecessor-head results. The first response to divergence is to determine whether the difference is a sanitizer/integration defect, a standards-permitted serialization difference, or a test/environment defect. Unsafe behavior is repaired at the runtime boundary test-first. A safe difference is admitted only with focused regression evidence, current authoritative **standards** basis, threat analysis, exact affected engine/version evidence, canonical interpretation, compatibility impact, and explicit **rollback**.

Browser evidence contains only committed synthetic fixtures and bounded version/hash/timing metadata; no tenant document, credential, model data, authorization context, or production clipboard payload belongs in the evidence bundle. The test scenario permits only loopback harness requests; browser installation happens before the scenario as a pinned build prerequisite. Release execution retains only the bounded `tests/browser/.browser-evidence/` directory, including its hidden run identity, as the reviewable browser evidence artifact. **Playwright screenshots**, traces, and the broader `test-results` directory are deliberately not retained by that release-evidence upload. Operators reviewing a release candidate must confirm that all three engine records share the current run identity, current lock SHA-256, exact source head, and exact packed npm artifact SHA-256 digest before treating the browser gate as satisfied.

A Playwright/browser revision upgrade is an operational compatibility event. Rebuild the browser evidence from the new immutable lock on one exact source head and rerun the complete corpus. If browser provisioning is unavailable, only the rich-clipboard release lane is blocked; unrelated Inkspan work continues. Rolling back the browser gate leaves the affected rich-clipboard publication claim unaccepted unless equivalent or stronger real-engine assurance replaces it.

## Release operations

Release publication occurs only from an exact integrated protected head. The release tag commit must equal the current fetched protected `main` tip; a reachable predecessor is not an exact integrated protected head. Release evidence includes package artifacts, deterministic checksums, CI/security/package/provenance results, required review, zero valid unresolved findings, and repository-policy acceptance. The normative inventory and digest rules are defined by the `docs/CONTRACTS.md` Release and rollback contract.

Before publication:

1. fetch the current protected `main` ref and require the release tag event commit SHA to equal that exact integration tip, not merely be an ancestor of it;
2. build exactly five regular top-level release files: exactly one npm tarball, exactly one Inkspan Office wheel, `editor-package.spdx.json`, `office-package.spdx.json`, and `SHA256SUMS`;
3. reject missing, duplicate, non-regular, stale, or unexpected local entries and verify the local digests;
4. after upload, query the authenticated paginated GitHub Releases API and require the resumed remote draft asset-name set to equal the local release directory exactly;
5. require every remote asset state to be uploaded and every GitHub-reported `sha256:` digest to equal the exact transferred local file digest;
6. fail closed on stale/unexpected/incomplete/digest-mismatched assets rather than deleting them automatically to manufacture a clean draft;
7. verify SBOM/provenance/signing or attestation gates where configured;
8. verify package/wheel consumers and the supported runtime matrix; and
9. publish only after exact-head required review and protection gates pass.

After publication, verify artifact availability, checksums/provenance, package metadata, install/consumer smoke evidence, and release notes. Rollback of a bad release uses a new reviewed corrective release or repository-supported withdrawal/yank policy; immutable published evidence is not rewritten to pretend the release never existed.

## Incident classes and first response

### Security input bypass

Stop publication of affected versions, reproduce on exact source, preserve a minimized synthetic regression, classify whether the defect is inside Inkspan or host policy, patch test-first, rerun security/package/release evidence, and follow the protected-main root `SECURITY.md` private-reporting and coordinated-disclosure lifecycle. Do not publish proof-of-concept customer data.

### Data-loss or false durable-success risk

Fail closed. Preserve the host's last known durable validator and local evidence. Do not mark an ambiguous write as saved. Require authenticated host reconciliation before resuming. Never substitute a content digest for server durable state.

### Package or conversion corruption

Do not publish or reuse the artifact. Rebuild from exact source with deterministic dependencies, verify the package tree and digest, and compare to the known-good contract. If a published artifact is affected, use the release recovery procedure rather than silently replacing immutable evidence.

### Browser/parser divergence

When a browser-specific clipboard/security difference is found, reproduce it in the dependency-locked cross-engine corpus on the exact affected source head and browser versions. Classify the semantic/security result before changing expectations. Accept a difference only with explicit standards basis, threat analysis, compatibility consequence, and rollback. Do not normalize a security-relevant difference away solely to regain parity, and never convert an unavailable required browser into a successful result.

### Dependency or workflow incident

Treat central `.github` or other dedicated-loop defects as read-only dependencies. Do not create an Inkspan workaround that weakens exact-head evidence, coverage, security, approval, or release policy. Continue independent Inkspan work that does not rely on the defective dependency.

## Backup, migration, and retention

Inkspan owns no application database on the current architecture, so database backup/restore and tenant retention are host responsibilities. Versioned document envelopes and public package schemas must remain backward/migration-aware; host migration implementation and schema registry remain host-owned. If Inkspan later owns durable persistence, that is a material architecture change requiring a physical ERD, migration/rollback design, backup/restore runbook, retention model, threat review, and ADR.

## Rollback

Rollback is boundary-specific:

- editor feature: remove or revert the feature while preserving canonical document readability;
- autosave/observer feature: fall back to explicit `getSnapshot()`/host coordination without rewriting durable state;
- collaboration adapter: detach the adapter without destroying the host provider or Yjs document;
- Office renderer change: revert the deterministic renderer behavior and rebuild artifacts; do not modify host files outside the explicit output target;
- browser assurance: revert the faulty gate only while keeping the affected rich-clipboard release claim unaccepted; never retain a release claim after removing its required engine evidence;
- documentation: supersede inaccurate decisions with an ADR and synchronized canonical docs rather than deleting history;
- release: issue a verified corrective release or supported withdrawal action; preserve provenance and incident evidence.

Every rollback requires fresh exact-head tests and must not weaken authorization, tenant isolation, release provenance, browser-security evidence, or host ownership boundaries.
