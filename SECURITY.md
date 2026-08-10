# Security Policy

Inkspan treats vulnerability reporting and handling as part of the product contract. Please use a private channel for suspected security vulnerabilities so maintainers can reproduce, remediate, and coordinate disclosure before exploit details become public.

## Supported releases

Inkspan is still pre-1.0, so security support follows the newest released line rather than every historical minor release.

| Surface | Actively supported security line | Notes |
| --- | --- | --- |
| `@contextualwisdomlab/cwl-editor` | latest released `0.5.x` | Security fixes target the newest released editor line. Older pre-1.0 releases may be superseded rather than backported unless a coordinated advisory requires a bounded backport. |
| `inkspan-office` | latest released `0.1.x` | Security fixes target the newest released Office renderer line and its deterministic packaged artifacts. |

Package manifests and release-candidate changelog headings may move ahead of these public support lines during reviewed release preparation. Only successful public registry publication and its post-publication verification advance a `latest released` support line.

Unreleased branches and pull requests are development evidence, not supported releases. A finding against an unreleased head is still useful and should be reported privately, but support and disclosure decisions are made against affected released artifacts as well as the development fix.

A future stable release may define a broader support window. Until then, this table is the public support contract; an enterprise support agreement may define additional maintained versions separately.

## Reporting a vulnerability

1. Open the repository **Security** area. If GitHub shows **Report a vulnerability**, use that private reporting form. It creates a private GitHub Security Advisory discussion with the maintainers.
2. If **Report a vulnerability** is unavailable, create a public issue that only asks for a private security contact without disclosing the vulnerability. Do not include vulnerability details, proof-of-concept payloads, secrets, or customer data in a public issue.
3. Keep technical details in the resulting private channel until coordinated disclosure is agreed or the maintainers publish an advisory.

A useful report includes, when known:

- the exact affected version, package, entry point, and platform;
- the security boundary or invariant that can be violated;
- a minimal reproduction using synthetic data and the smallest safe proof of impact;
- expected behavior and observed behavior;
- exploit prerequisites and whether interaction, authentication, or a particular host configuration is required;
- whether the issue is already public or known to another vendor; and
- any proposed remediation or regression condition that may help reproduce the issue.

Do not send production credentials, access tokens, private tenant identifiers, real customer documents, or other unnecessary sensitive material. Replace them with synthetic fixtures whenever possible. If sensitive evidence is essential to establish impact, first establish a private channel and minimize the disclosed material.

## Scope and ownership boundary

Reports are in scope when an Inkspan-controlled editor or deterministic conversion surface can violate its documented security boundary, including package parsing/serialization, strict link and image policy, rich-content handling, document-envelope validation, local revision/autosave contracts, provider-neutral collaboration adapters, deterministic Office rendering, packaged artifacts, or Inkspan-owned release evidence.

Inkspan does not own host-owned transport, authorization, tenant isolation, persistence, credentials, migration, retention, collaboration-provider authorization, downstream deployment policy, or model-use policy. Report a host defect to the host that owns that boundary. An Inkspan flaw that crosses or undermines one of those documented boundaries remains in scope for Inkspan.

Repository automation and organization-wide security/review infrastructure owned by `ContextualWisdomLab/.github` should be reported against that repository rather than treated as Inkspan runtime behavior. Model-routing defects owned by `ContextualWisdomLab/contextual-orchestrator` likewise belong to that service unless the defect originates in Inkspan's interface contract.

Security research does not authorize access to third-party data, destructive testing, service degradation, credential theft, social engineering, or testing systems you do not own or have explicit permission to test.

## Vulnerability handling lifecycle

For a credible report, maintainers should:

1. establish a private case and preserve the reporter's original evidence without copying sensitive payloads into ordinary logs or public CI output;
2. reproduce the issue against the exact affected version and current development head, separating an Inkspan defect from host-owned configuration or infrastructure;
3. assess impact, exploit prerequisites, affected release lines, dependency exposure, and whether other vendors need coordinated disclosure;
4. implement the minimum root-cause fix with a root-cause regression test and any required security, compatibility, packaging, or rollback evidence;
5. verify the exact fix head through exact-head CI, security scanning, coverage, packaging/provenance, and independent review gates that apply to the affected release;
6. prepare a GitHub Security Advisory and request a CVE when appropriate for a publicly distributed vulnerability;
7. coordinate release and disclosure timing around user risk, downstream-vendor needs, and availability of a verified remediation; and
8. publish remediation guidance that identifies affected and fixed versions without exposing private customer data or unnecessary exploit detail.

A failed, queued, cancelled, stale-head, predecessor-head, or synthetic-merge result is not release evidence. A security fix does not weaken tests, bypass branch protection, manufacture approval, or silently broaden Inkspan into a host authorization or persistence service.

## Communication expectations

This public policy does not promise a response-time SLA, remediation deadline, bounty, or payment. Those commitments require an explicit support or disclosure agreement. Maintainers should nevertheless keep the private reporter informed when the report is reproducible, when scope or severity changes materially, when a fix is ready for coordinated validation, and when disclosure timing is decided.

Coordinated disclosure is preferred over unilateral premature publication because users need a verified remediation path. Reporters are also free to communicate reasonable disclosure expectations in the private case; the final schedule should reflect actual user risk rather than an arbitrary silence period.

## Standards and claim boundary

This policy is informed by ISO/IEC 29147 vulnerability disclosure guidance, ISO/IEC 30111 vulnerability-handling guidance, NIST SP 800-218 Secure Software Development Framework (SSDF) Version 1.1, and GitHub's current security-policy and private vulnerability-reporting documentation. The corresponding decision and APA 7 references are recorded in [`docs/doctoring/security-disclosure-lifecycle.md`](docs/doctoring/security-disclosure-lifecycle.md).

Publishing this policy does not by itself establish ISO certification, complete SSDF conformance, a legal safe harbor, or a contractual service level. Deployed hosts and commercial agreements retain their own incident-response, regulatory, notification, and contractual obligations.
