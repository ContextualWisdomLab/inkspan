# Doctoring record: security disclosure and vulnerability handling

**Decision date:** 2026-08-08  
**Scope:** Repository-native security reporting, supported-release communication, vulnerability handling, coordinated disclosure, and acquisition-review evidence for Inkspan.  
**Status:** Accepted for the bounded documentation slice; implementation evidence remains subject to exact-head CI, review, and protected merge.

## Problem

Inkspan already carries security-focused implementation, testing, release, and architecture evidence, but protected `main` had no root `SECURITY.md`. GitHub's repository security-policy guidance explicitly uses `SECURITY.md` to communicate supported versions and vulnerability-reporting instructions. Without that repository-native entry point, an external researcher or acquisition reviewer has to infer the reporting path from unrelated implementation documentation, increasing the chance of accidental public disclosure or inconsistent handling.

The gap is operational rather than a new runtime authority. Inkspan must not absorb host-owned transport, authorization, tenant isolation, persistence, credentials, migration, retention, incident-response, or model-use policy merely because it publishes a vulnerability-reporting contract.

## Current-source review

### ISO/IEC 29147:2018

ISO identifies ISO/IEC 29147:2018, *Information technology — Security techniques — Vulnerability disclosure*, as the current published second edition. ISO states that the standard provides requirements and recommendations for receiving potential-vulnerability reports, disclosing remediation information, and coordinating vulnerability disclosure. ISO reports that this edition was reviewed and confirmed in 2024, while its lifecycle now records that a revision is under development.

Decision: use the current published 2018 edition as the vulnerability-disclosure baseline. Do not represent an unpublished successor as authoritative production guidance.

### ISO/IEC 30111:2019

ISO identifies ISO/IEC 30111:2019, *Information technology — Security techniques — Vulnerability handling processes*, as the current published second edition. It covers processing and remediating reported potential vulnerabilities. ISO records confirmation in 2025 and also indicates that a revision is planned.

Decision: use the current published 2019 edition for the handling lifecycle while recording that standards maintenance continues. The policy does not claim certification.

### NIST SP 800-218 SSDF Version 1.1

NIST SP 800-218 is the final Secure Software Development Framework (SSDF) Version 1.1. Its Respond to Vulnerabilities practice group establishes vulnerability identification, remediation, root-cause analysis, and prevention as secure-development concerns, and NIST explicitly positions SSDF terminology as useful to software acquirers as well as producers.

NIST published an Initial Public Draft of SP 800-218 Rev. 1 / SSDF Version 1.2 on December 17, 2025. Version 1.2 remains a draft at this decision date; it is useful directional context but is not substituted for the final Version 1.1 baseline in the public policy.

Decision: bind public claims to final SSDF Version 1.1 and explicitly label Version 1.2 as draft. This avoids treating a draft as a completed standard while still tracking the latest NIST work.

### GitHub repository security policy and private vulnerability reporting

Current GitHub documentation recommends a repository `SECURITY.md` containing supported-version and reporting instructions. GitHub private vulnerability reporting, when enabled, gives reporters a private structured path into repository security advisories. GitHub also documents the fallback when private vulnerability reporting is unavailable: a public issue may ask for a preferred private security contact, but vulnerability details should not be disclosed in that public issue.

Decision: the policy says to use **Report a vulnerability** when GitHub exposes that control. It does not claim the repository setting is enabled because this documentation slice cannot safely infer administrative configuration from source. If the control is absent, the only public issue content should be a request for a private contact without technical vulnerability details.

## Accepted product contract

### Supported releases

Inkspan remains pre-1.0. The public support table therefore identifies the newest released `0.5.x` editor line and newest released `0.1.x` Office-renderer line rather than promising indefinite backports across historical minors. Unreleased branches and pull requests remain development evidence, not supported releases.

This does not prevent a coordinated backport when user risk requires one. It prevents an acquisition reviewer from mistaking every historical pre-1.0 artifact for an actively maintained security line.

### Private intake and data minimization

The public policy requires private intake for vulnerability details and explicitly excludes proof-of-concept payloads, production credentials, access tokens, private tenant identifiers, and customer documents from public issues. Reports should use synthetic fixtures and the smallest reproduction that proves the boundary failure.

This aligns with Inkspan's existing local-versus-shareable evidence boundary: security and acquisition evidence can be shared without reproducing private tenant content.

### Vulnerability-handling lifecycle

The policy defines a bounded lifecycle:

1. create a private case and preserve the report without copying sensitive payloads into routine logs;
2. reproduce against the exact affected release and current development head;
3. classify the Inkspan versus host-owned boundary, impact, prerequisites, release scope, and multi-vendor coordination needs;
4. implement the minimum root-cause repair with a permanent root-cause regression test;
5. rerun exact-head CI, security, coverage, packaging/provenance, and independent-review gates;
6. prepare a GitHub Security Advisory and CVE request when appropriate;
7. coordinate release and disclosure around actual user risk and remediation readiness; and
8. publish affected/fixed-version guidance without leaking private customer evidence.

A queued, cancelled, failed, predecessor-head, stale-head, or synthetic-merge result cannot be promoted into successful fix evidence.

### Ownership boundary

Inkspan owns editor and deterministic conversion surfaces. Hosts continue to own host-owned transport, authorization, tenant isolation, persistence, credentials, migration, retention, collaboration authorization, deployment policy, and model-use policy. Organization-level GitHub automation belongs to `ContextualWisdomLab/.github`; provider/model-routing behavior belongs to `ContextualWisdomLab/contextual-orchestrator` unless the defect originates in Inkspan's documented interface.

This routing prevents a vulnerability policy from becoming an accidental monolith or an implied operational service boundary.

### Response, bounty, safe-harbor, and legal claims

The repository policy does not promise a response-time SLA, remediation deadline, bounty, payment, or legal safe harbor. Those commitments depend on commercial support terms, jurisdiction, and explicit organizational authorization. It does forbid destructive or unauthorized testing and instructs researchers to minimize sensitive data.

The policy also does not claim ISO certification or complete SSDF conformance. The standards are design and process inputs; conformance and certification require broader evidence than one repository document.

## Verification contract

`src/securityPolicyDocumentation.test.ts` binds the repository to the following deterministic claims:

- root `SECURITY.md` exists and contains the GitHub-recognized policy structure;
- private reporting and safe public fallback are explicit;
- supported pre-1.0 release lines are explicit;
- host-ownership and evidence boundaries remain explicit;
- the handling lifecycle requires exact version, minimal reproduction, regression, exact-head verification, and coordinated disclosure;
- the policy does not promise an SLA; and
- this record contains the current standards, draft-status, APA 7, and non-conformance claim boundaries.

The test is intentionally documentation-focused. It does not prove that GitHub private vulnerability reporting is administratively enabled, that a reporter will receive a particular response time, or that a deployed host satisfies ISO, NIST, regulatory, or contractual requirements.

## Acquisition and rollback value

For acquisition diligence, the root policy gives a reviewer a concrete answer to five questions that were previously implicit: what release is supported, where security reports go, what evidence is safe to send, who owns which vulnerability class, and what gates a security fix must pass before release.

Rollback is simple because this slice changes no runtime or package behavior. If the policy becomes inaccurate, revert the documentation/test commits or replace them with a reviewed successor policy. Do not remove the private-disclosure entry point without replacing it with another explicit private reporting route.

## APA 7 references

GitHub. (n.d.). *Adding a security policy to your repository*. GitHub Docs. Retrieved August 8, 2026, from https://docs.github.com/en/code-security/how-tos/report-and-fix-vulnerabilities/configure-vulnerability-reporting/add-security-policy

GitHub. (n.d.). *Configuring private vulnerability reporting for a repository*. GitHub Docs. Retrieved August 8, 2026, from https://docs.github.com/en/code-security/how-tos/report-and-fix-vulnerabilities/configure-vulnerability-reporting/configure-for-a-repository

GitHub. (n.d.). *Coordinated disclosure of security vulnerabilities*. GitHub Docs. Retrieved August 8, 2026, from https://docs.github.com/en/code-security/concepts/vulnerability-reporting-and-management/coordinated-disclosure

International Organization for Standardization. (2018). *Information technology—Security techniques—Vulnerability disclosure (ISO/IEC Standard No. 29147:2018).* https://www.iso.org/standard/72311.html

International Organization for Standardization. (2019). *Information technology—Security techniques—Vulnerability handling processes (ISO/IEC Standard No. 30111:2019).* https://www.iso.org/standard/69725.html

Booth, H., Ogata, M., Kent, K., Souppaya, M., & Dodson, D. (2025). *Secure Software Development Framework (SSDF) Version 1.2: Recommendations for mitigating the risk of software vulnerabilities* (NIST Special Publication 800-218 Rev. 1, Initial Public Draft). National Institute of Standards and Technology. https://doi.org/10.6028/NIST.SP.800-218r1.ipd

Scarfone, K., Souppaya, M., & Dodson, D. (2022). *Secure Software Development Framework (SSDF) Version 1.1: Recommendations for mitigating the risk of software vulnerabilities* (NIST Special Publication 800-218). National Institute of Standards and Technology. https://doi.org/10.6028/NIST.SP.800-218
