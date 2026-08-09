# ADR 0017: Security disclosure lifecycle and coordinated vulnerability handling

Status: Proposed

## Context

Protected `main` now contains root `SECURITY.md` and its deterministic documentation contract from the independently reviewed security-disclosure line. Inkspan therefore has a shipped repository-native intake and coordinated-disclosure policy rather than an architecture target owned by a separate active PR. The canonical documentation graph must capture the durable decision without rewriting the security policy itself or confusing a protected-main process contract with certification, a bounty, a legal safe-harbor promise, or an operational response-time SLA.

The policy must remain consistent with Inkspan's product boundary: Inkspan owns its editor, deterministic conversion, package, and release surfaces, while embedding hosts retain their own transport, authentication, authorization, tenancy, durable persistence, credentials, deployment, retention, collaboration-provider authority, and model-use policy.

## Alternatives considered

### Keep disclosure guidance only in feature doctoring or PR history

Rejected. Security researchers and acquisition reviewers need a stable repository-root discovery path; PR bodies and conversation history are not durable product authority.

### Duplicate the full `SECURITY.md` policy into architecture documents

Rejected. Duplicated policy prose creates two security authorities that can drift. The root policy remains normative for reporting and supported release lines; this ADR records why that lifecycle and ownership boundary exist.

### Promise fixed response/remediation SLAs or a bounty as part of the baseline

Rejected. The repository does not have evidence or organizational authority to guarantee those commitments. Such promises require separately reviewed operational/legal authority and measurable support capacity.

### Public issue intake for vulnerability details

Rejected. Public issue content is unsuitable for undisclosed vulnerability details, proof-of-concept payloads, secrets, or customer data. Private GitHub Security Advisory reporting is preferred when available; the bounded public fallback may only request a private contact without vulnerability details.

## Decision

1. Root `SECURITY.md` is the canonical vulnerability-reporting and coordinated-disclosure policy for Inkspan.
2. Supported pre-1.0 release lines are derived from actual package manifests and kept under deterministic documentation tests rather than copied as unbound prose.
3. Reporters are directed to GitHub's private vulnerability-reporting / Security Advisory path when available. A public issue may only request a private reporting contact and must not contain vulnerability details, proof-of-concept payloads, secrets, or customer data.
4. Intake requests exact affected version, minimal synthetic reproduction, exploit prerequisites, and minimized evidence sufficient for reproduction.
5. Maintainer handling follows private intake -> exact-version reproduction -> root-cause regression -> bounded fix -> exact-head CI/security/coverage/package/provenance/review evidence -> advisory/CVE coordination when appropriate -> coordinated disclosure.
6. The policy does not claim a response-time SLA, bounty, legal safe harbor, certification, or complete framework conformance.
7. Inkspan's security policy covers Inkspan-owned product/package surfaces. Host-owned identity, transport, tenancy, persistence, deployment, retention, collaboration-provider, and model-policy incidents remain the embedding host's responsibility unless evidence shows an Inkspan defect contributes to the issue.
8. Final published standards remain normative where a newer revision is only draft; draft standards may be tracked as evidence inputs but do not silently replace the final baseline.

## Consequences

Security researchers have a stable private intake path and explicit evidence-minimization guidance. Acquisition reviewers can distinguish a documented disclosure process from unsupported certification or SLA claims. The canonical architecture remains single-source: `SECURITY.md` defines the operational reporting policy, this ADR defines the durable decision and boundaries, and doctoring records source/version evidence.

The repository assumes ongoing maintenance responsibility for keeping supported release rows, GitHub reporting mechanics, standards references, and release evidence synchronized with actual package and repository behavior.

## Failure and recovery

If private vulnerability reporting becomes unavailable, the public fallback remains limited to requesting a private contact; sensitive details are not moved into a public issue as a workaround. If package support lines change, deterministic tests must fail until `SECURITY.md` is updated to match the manifests. If GitHub changes the private-reporting workflow, the policy must fail safe toward private contact rather than inventing a nonexistent control.

If a security-policy change overstates organizational capability, certification, legal protection, or response guarantees, revert the unsupported claim and restore the last evidence-backed policy while a separately authorized decision is reviewed. Active vulnerability handling should not be blocked by documentation repair when a safe private channel exists.

## Security and privacy impact

The decision reduces accidental disclosure by preferring private intake and minimizing submitted evidence. Public issue fallback explicitly excludes vulnerability details, secrets, customer content, and proof-of-concept payloads. Reproduction should use synthetic/minimized data wherever possible, with exact affected versions and exploit prerequisites recorded separately from unnecessary tenant content.

The policy itself does not grant authorization to test third-party or customer systems and does not expand maintainer access to host-owned data or credentials.

## Compatibility and migration

This is a repository-process contract and does not change runtime APIs, stored document schemas, package formats, database objects, host integrations, or deployment topology. Existing users continue to consume the same product packages. Future security-policy changes remain backward-compatible when possible; any new support commitment or reporting mechanism requires synchronized documentation tests and, when material, a superseding ADR.

## Verification

Protected `main` contains root `SECURITY.md`, deterministic tests binding its supported release rows to package manifests, and doctoring that records ISO/IEC 29147:2018, ISO/IEC 30111:2019, NIST SP 800-218 SSDF Version 1.1, the draft-status boundary for the later SSDF revision, and GitHub private-reporting/coordinated-disclosure guidance. The protected merge of the security-disclosure line is implementation evidence; this documentation branch must not downgrade it to an active-PR claim.

Canonical documentation tests require this ADR, its index entry, and `docs/DOCUMENTATION_FITNESS.md` to classify the root security disclosure policy as `present_current` with `implemented_on_protected_main` maturity.

## Rollback or supersession

Rollback of this ADR does not remove protected `SECURITY.md`; the root policy remains authoritative until separately changed through normal protected review. A future ADR may supersede this decision if Inkspan adopts a materially different reporting platform, formal support SLA, bounty program, legal safe-harbor policy, or organization-wide security-response authority. Supersession must preserve a discoverable private vulnerability-reporting path during migration.

## References

International Organization for Standardization. (2018). *Information technology — Security techniques — Vulnerability disclosure* (ISO/IEC 29147:2018).

International Organization for Standardization. (2019). *Information technology — Security techniques — Vulnerability handling processes* (ISO/IEC 30111:2019).

Souppaya, M., Scarfone, K., & Dodson, D. (2022). *Secure Software Development Framework (SSDF) Version 1.1: Recommendations for Mitigating the Risk of Software Vulnerabilities* (NIST SP 800-218). National Institute of Standards and Technology. https://doi.org/10.6028/NIST.SP.800-218

GitHub. (n.d.). *About repository security advisories*. GitHub Docs.
