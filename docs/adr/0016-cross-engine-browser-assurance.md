# ADR 0016: Cross-engine browser-semantic release assurance

Status: Proposed

## Context

Inkspan's safe rich-clipboard boundary depends on browser HTML fragment parsing, DOM construction, serialization, hidden-content interpretation, and TipTap/ProseMirror integration. Unit and jsdom evidence is valuable but cannot prove that Chromium, Firefox, and WebKit expose identical security-relevant behavior. Earlier development already found a CSSOM mismatch around proprietary Office style handling, demonstrating that one simulated DOM is not a sufficient publication boundary.

PR #65 owns the sanitizer implementation. Issue #66 separately owns the browser-realistic differential release gate after PR #65 reaches protected `main`. The architectural decision is how browser-semantic differences are admitted into a release without turning engine disagreement into either an unbounded compatibility promise or an excuse to normalize away a security defect.

## Alternatives considered

- Treat jsdom/unit success as browser conformance. Rejected because simulated DOM behavior is not authoritative for real engine fragment parsing or serialization.
- Test only Chromium. Rejected because Inkspan is a browser-facing package and security semantics can diverge in Firefox or WebKit even when Chromium is green.
- Require byte-identical output from all engines without exception. Rejected because standards-permitted serialization differences can exist and unconditional normalization can hide a real semantic discrepancy.
- Run one dependency-locked adversarial corpus across Chromium, Firefox, and WebKit, require semantic parity for security decisions, and admit only narrowly reviewed standards-grounded differences. Selected because it provides buyer-reviewable evidence without claiming universal engine identity.

## Decision

Before a release line can claim the rich-clipboard boundary as supported, the same committed adversarial corpus must execute through Inkspan's public sanitizer and supported paste integration in named Playwright `chromium`, `firefox`, and `webkit` projects on one exact source head.

The suite is hermetic and network-free, depends on immutable package/workflow pins, and does not require operating-system clipboard permissions. It covers strict element/attribute allowlisting; unsafe-link handling; scripts, resources, embeds, forms, metadata, media, SVG/MathML and images; interactive/obsolete fallback structures; hidden and Office-specific content; malformed fragment/table/list/formatting/namespace cases; hostile DOM capabilities; bounded bytes/nodes/depth; stable redacted failures; and representative performance alarms.

Security-relevant semantic decisions must agree across required engines. A serialization difference may be allowlisted only when a focused fixture, authoritative standards basis, threat analysis, exact affected engine/version evidence, expected canonical interpretation, and rollback note show that the difference does not weaken the trust boundary. An allowlist is code-reviewed evidence, not a generic normalizer.

The gate fails closed when a required browser is absent, skipped, cancelled, unsuccessful, or cannot produce the required evidence. Queued or pending execution is not success. Exact-head evidence records the package lock, Playwright version, browser revisions, operating system, corpus version, and source SHA without exposing private clipboard data or local paths.

## Consequences

Rich clipboard publication costs more CI time and browser artifacts, but acquisition reviewers receive direct evidence for the parser/serializer boundary most likely to vary by browser. Engine upgrades become observable compatibility events rather than silent semantic changes.

The gate does not make Inkspan responsible for branded browser enterprise policy, extensions, host CSP, downstream rendering, transport, authorization, tenancy, persistence, credentials, retention, migration, or model policy. Those remain separate host/runtime controls.

## Failure and recovery

A newly divergent fixture blocks the release lane. The first response is to classify whether the divergence changes the security/semantic result, is a standards-permitted serialization-only difference, or exposes a test/environment defect. Repair the sanitizer or integration test-first when the boundary is unsafe. Add a focused reviewed allowance only for a proven safe difference.

Do not delete a failing engine, weaken the corpus, convert a required project to optional, hide the failure behind retries, or reuse predecessor-head browser evidence. If browser provisioning itself is unavailable, the release remains blocked while unrelated Inkspan work continues.

## Security and privacy impact

The differential corpus contains committed synthetic fixtures only. Browser jobs receive no tenant document, production clipboard payload, provider credential, model credential, or persistence secret. Network access is disabled for the test scenario where practical, and logs/artifacts must not emit raw hostile input outside the public fixture set.

The design reduces parser-confusion, hidden-content, active-resource, serialization, and regression risk. It does not replace host CSP, egress policy, authorization, tenant isolation, or application security testing.

## Compatibility and migration

Each accepted browser/Playwright revision is part of release evidence rather than a forever-supported browser guarantee. Upgrading Playwright or its browser revisions requires the complete corpus to rerun before the new evidence becomes authoritative. A future browser difference that is safe only behind a narrower supported construct must be reflected in the public compatibility contract rather than silently normalized.

The gate is ordered behind the safe-clipboard implementation because there is no useful release assurance for a trust boundary that is not yet integrated. It does not change existing document-envelope or persistence migration semantics.

## Verification

Issue #66 defines the test-first implementation acceptance. Required proof includes RED evidence that the differential harness detects an intentionally introduced divergence or unsafe reconstruction, GREEN evidence after removing the fault, all three named browser projects, deterministic corpus/allowlist/evidence-generation tests, representative performance bounds, exact-head CI/security/package evidence, and a qualifying independent review before the release gate is accepted.

The canonical documentation and test strategy must continue to state that jsdom-only evidence is not real-engine conformance and that differences are never normalized merely to make engines agree.

## Rollback or supersession

Before protected integration, rollback removes the proposed browser gate while leaving the rich-clipboard release line explicitly unaccepted for publication. After integration, disabling a required engine or loosening difference admission is a security/release-policy change requiring a superseding ADR and new threat analysis.

Supersession is acceptable only if a later harness provides equivalent or stronger real-engine coverage and preserves exact-head, fail-closed, synthetic-fixture, and reviewed-difference boundaries.

## References

Microsoft. (n.d.-a). *Browsers*. Playwright documentation. Retrieved August 9, 2026, from https://playwright.dev/docs/browsers

Microsoft. (n.d.-b). *Projects*. Playwright documentation. Retrieved August 9, 2026, from https://playwright.dev/docs/test-projects

Web Hypertext Application Technology Working Group. (2026). *HTML Standard: Parsing HTML documents* (Living Standard). Retrieved August 9, 2026, from https://html.spec.whatwg.org/multipage/parsing.html

World Wide Web Consortium. (2026, June 24). *Clipboard API and events* (W3C Working Draft). https://www.w3.org/TR/2026/WD-clipboard-apis-20260624/
