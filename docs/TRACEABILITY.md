# Inkspan Standards and Evidence Traceability

Status: Proposed canonical baseline

## Purpose

This record maps durable Inkspan product decisions to authoritative standards, primary technical documentation, repository evidence, and explicit claim limits. It is not a certification statement. Protected `main` remains the implementation authority; open pull requests are proposed or active evidence only.

## Traceability matrix

| Concern | Inkspan decision | Primary authority | Repository evidence | Claim limit |
|---|---|---|---|---|
| HTTP optimistic concurrency | Durable saves use a host/server-selected strong entity tag; local content digests do not substitute for durable `If-Match` authority | RFC 9110, HTTP Semantics | autosave session tests, `docs/document-autosave.md`, architecture concurrency sequence | Inkspan validates/coordinates local semantics; host owns atomic persistence and authorization |
| JSON envelope grammar | Versioned envelopes use strict JSON handling, duplicate-name defenses, bounded parsing, and explicit schema identity | RFC 8259, JSON | envelope parser/resource-limit tests and package consumers | Current-schema parsing does not imply migration authority for unknown schemas |
| Canonical document bytes | Deterministic revision evidence is derived from canonicalized validated document content | RFC 8785, JSON Canonicalization Scheme | revision-evidence, transition-evidence, restore tests | A content digest proves equality only, not actor/time/authorization/durable write |
| Provenance semantics | Local transition/release evidence keeps content lineage separate from actor/authorization/durable claims | W3C PROV family | transition evidence, release evidence, canonical data model | Inkspan does not claim complete PROV conformance or host audit provenance |
| Accessibility | Native controls, keyboard semantics, shortcut metadata, and host-facing status state support accessible embedding | W3C WCAG 2.2; WAI-ARIA where used | toolbar/accessibility tests, SSR tests, autosave lifecycle data | Component evidence alone is not a full host WCAG conformance claim |
| Browser clipboard behavior | Security-relevant rich HTML handling requires actual paste-pipeline integration and real-engine differential evidence before the rich-clipboard release line | WHATWG HTML parsing; W3C Clipboard API; Playwright browser/project documentation | rich-clipboard unit/integration corpus and planned Chromium/Firefox/WebKit gate | jsdom-only success is not universal browser-engine conformance |
| Editor integration | Public behavior must exercise the actual TipTap/ProseMirror integration path, not an inert extension field or test-only hook | official TipTap and ProseMirror documentation for the locked dependency line | integration tests and package consumers | Inkspan does not claim compatibility with untested major-version integration semantics |
| Collaboration | Inkspan provides provider-neutral editor/Yjs bindings; host owns provider lifecycle, room authorization, awareness privacy, persistence and audit | official Yjs/provider documentation plus Inkspan public contract | collaboration tests and architecture ownership matrix | No network-provider or tenant-authorization authority is implied |
| Secure development | Security controls are developed test-first, with exact-head scanning/review/package evidence and root-cause regression | NIST SP 800-218 SSDF 1.1 | CI/security/SAST/package/provenance gates, doctoring and regression history | Repository evidence is not a claim of complete SSDF organizational conformance |
| Office rendering | JSON→DOCX/XLSX/PPTX is deterministic, bounded, network-free, macro-free, injection-aware and package-inspected | Office Open XML specifications and relevant Python package contracts | Office renderer tests, Python coverage/docstring/package gates | Format fidelity is limited to explicitly tested supported constructs |
| Release authority | Source movement invalidates exact-head evidence; stale assets/digest ambiguity fail closed; formal approval remains distinct from status/comments | GitHub protected-branch/review/release/attestation behavior and repository policy | release workflow tests, package checksums, SBOM/provenance, formal reviews | Local success or automated prose does not authorize protected merge/release |

## Current primary references

Bray, T. (Ed.). (2017). *The JavaScript Object Notation (JSON) Data Interchange Format* (RFC 8259; STD 90). RFC Editor. https://doi.org/10.17487/RFC8259

Fielding, R., Nottingham, M., & Reschke, J. (Eds.). (2022). *HTTP Semantics* (RFC 9110; STD 97). RFC Editor. https://doi.org/10.17487/RFC9110

Rundgren, A., Jordan, B., & Erdtman, S. (2020). *JSON Canonicalization Scheme (JCS)* (RFC 8785). RFC Editor. https://doi.org/10.17487/RFC8785

Souppaya, M., Scarfone, K., & Dodson, D. (2022). *Secure Software Development Framework (SSDF) Version 1.1: Recommendations for Mitigating the Risk of Software Vulnerabilities* (NIST SP 800-218). National Institute of Standards and Technology. https://doi.org/10.6028/NIST.SP.800-218

World Wide Web Consortium. (2024, December 12). *Web Content Accessibility Guidelines (WCAG) 2.2*. https://www.w3.org/TR/WCAG22/

World Wide Web Consortium. (2013). *PROV-DM: The PROV Data Model*. https://www.w3.org/TR/prov-dm/

Microsoft. (n.d.). *Browsers*. Playwright documentation. https://playwright.dev/docs/browsers

Microsoft. (n.d.). *Projects*. Playwright documentation. https://playwright.dev/docs/test-projects

## Research-backed concurrency rationale

The autosave design uses explicit optimistic-concurrency boundaries: Inkspan coordinates local single-flight work and immutable local evidence, while the host performs the authoritative atomic compare-and-swap. The classic optimistic-concurrency literature is rationale, not protocol authority:

Kung, H. T., & Robinson, J. T. (1981). On optimistic methods for concurrency control. *ACM Transactions on Database Systems, 6*(2), 213–226. https://doi.org/10.1145/319566.319567

## Evidence hierarchy

1. Protected `main` source and versioned public contracts.
2. Exact-current-head CI/security/package/provenance evidence for the source being considered.
3. Formal current-head review and repository protection state.
4. Canonical PRD/TRD/Architecture/ADRs/UML/data model/security/test/operability documents synchronized to that source.
5. Feature doctoring and implementation plans.
6. Historical PR bodies, predecessor-head results, conversations, comments, and local-only evidence.

Lower levels may explain intent or history but cannot override a contradictory higher-level source.

## Status discipline

- **Implemented** means present in protected `main` and verified under its release/product contract.
- **Proposed** means documented or implemented on an unmerged branch and not yet protected-main authority.
- **Planned** means an accepted future direction without a protected implementation.
- **Superseded** means retained for history but replaced by a later explicit decision.

Documentation must not promote Proposed or Planned capabilities to Implemented merely because a PR, issue, or design document is detailed.

## Review cadence

Revalidate this matrix when a public schema, security boundary, supported runtime/browser line, Office format contract, collaboration/provider contract, accessibility interaction, release workflow, or authoritative external standard materially changes. Prefer explicit supersession over silent historical rewrite.
