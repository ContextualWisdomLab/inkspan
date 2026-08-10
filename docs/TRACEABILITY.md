# Inkspan Standards and Evidence Traceability

Status: Protected-main canonical baseline

## Purpose

This record maps durable Inkspan product decisions to authoritative standards, primary technical documentation, repository evidence, and explicit claim limits. It is not a certification statement. Protected `main` remains the implementation authority; open pull requests are proposed or active evidence only.

## Traceability matrix

| Concern | Inkspan decision | Primary authority | Repository evidence | Claim limit |
|---|---|---|---|---|
| HTTP optimistic concurrency | Durable saves use a host/server-selected strong entity tag; local content digests do not substitute for durable `If-Match` authority | RFC 9110, HTTP Semantics | autosave session tests, `docs/document-autosave.md`, architecture concurrency sequence | Inkspan validates/coordinates local semantics; host owns atomic persistence and authorization |
| JSON envelope grammar | Versioned envelopes use strict JSON handling, duplicate-name defenses, bounded parsing, and explicit schema identity | RFC 8259; RFC 7493 where interoperable JSON constraints apply | envelope parser/resource-limit tests and package consumers | Current-schema parsing does not imply migration authority for unknown schemas |
| Envelope version routing | A bounded identity-only inspector identifies `schemaId`/`schemaVersion` for dispatch while the current parser stays strict and the host owns migration execution | RFC 8259; RFC 7493; RFC 8785 for canonical current-schema bytes | ADR 0015, protected-main `documentEnvelopeIdentity` implementation/tests, envelope guide/doctoring and framework-independent packed consumers | Protected-main evidence proves only bounded routing metadata; identifying a schema generation does not validate that generation's document semantics, authorize migration, or prove durable persistence |
| Canonical document bytes | Deterministic revision evidence is derived from canonicalized validated document content | RFC 8785, JSON Canonicalization Scheme | revision-evidence, transition-evidence, restore tests | A content digest proves equality only, not actor/time/authorization/durable write |
| W3C text-position selector | Revision-scoped annotation interoperability uses a distinct versioned logical-text projection satisfying `0 <= start <= end <= projectedCodePointLength`, with inclusive `start`, exclusive `end`, Unicode-code-point offsets, grapheme-boundary validation, and same-state revision binding instead of relabeling ProseMirror coordinates | W3C Web Annotation Data Model; ProseMirror reference manual; ECMA-402 13th edition | ADR 0018, protected-main text-position selector implementation/tests, packed consumer verifier, selection lifecycle and doctoring | Protected-main evidence proves positions only for the named projection and exact revision; it does not prove actor, authorization, durable annotation acceptance, source IRI policy, or cross-revision re-anchoring |
| Headless deterministic Markdown conversion | One serializer implementation and one framework-neutral safe-link/inline-raster policy are exposed through a self-contained ESM/CommonJS/TypeScript `./markdown` subpath | CommonMark 0.31.2; Node.js package `exports` documentation | protected-main #114 implementation, packed Node consumers, package-distribution contract, `docs/doctoring/headless-markdown-package.md` | `implemented_on_protected_main`; deterministic conversion does not grant MIME delivery, recipient, auth, tenant, persistence, network, credential, or model authority |
| Provenance semantics | Local transition/release evidence keeps content lineage separate from actor/authorization/durable claims | W3C PROV family | transition evidence, release evidence, canonical data model | Inkspan does not claim complete PROV conformance or host audit provenance |
| Accessibility | Native controls, keyboard semantics, shortcut metadata, semantic placeholder guidance, and host-facing status state support accessible embedding | W3C WCAG 2.2; WAI-ARIA 1.2 where used | protected toolbar/accessibility tests, SSR tests, autosave lifecycle data, protected #131 placeholder tests/packed consumer and `docs/doctoring/editor-placeholder-accessibility.md` | Component evidence alone is not a full host WCAG conformance claim; `aria-placeholder` supplements but never replaces the accessible name |
| Browser clipboard behavior | Security-relevant rich HTML handling requires actual paste-pipeline integration and bounded semantic reconstruction before editor state | WHATWG HTML parsing; W3C Clipboard API | protected-main rich-clipboard unit/integration corpus and SafeClipboard ADR | Protected jsdom/TipTap integration success is not universal browser-engine conformance |
| Cross-engine release assurance | The same committed synthetic adversarial corpus runs under required Chromium, Firefox, and WebKit projects; exact package-lock and packed npm artifact SHA-256 digests are required, and only focused standards-grounded safe differences may be admitted | WHATWG HTML Living Standard; W3C Clipboard API and events; Playwright 1.62 release notes and browser/project documentation | ADR 0016, protected-main browser evidence source/workflows, TEST_STRATEGY, OPERABILITY and UML | Protected-main implementation is the release-policy authority; every release candidate must regenerate fresh exact-source/lock/run/browser evidence bound to the exact packed npm artifact SHA-256 and does not claim byte-identical browser serialization or branded enterprise-policy coverage |
| CSS paged-media output | Shipped editor CSS has a declarative print boundary that removes interactive chrome and screen clipping while preserving authored document flow and bounded fragmentation behavior | W3C Media Queries Level 3; CSS Fragmentation Level 3; CSS Paged Media Level 3 as tracked draft input | protected-main #116 packaged stylesheet, real-browser print-media evidence, ADR 0021, print doctoring and tests | `implemented_on_protected_main`; browser print styling does not create a durable PDF service, page-number/header authority, persistence, signing, or PDF-conformance claim |
| Editor integration | Public behavior must exercise the actual TipTap/ProseMirror integration path, not an inert extension field or test-only hook | official TipTap and ProseMirror documentation for the locked dependency line | integration tests and package consumers | Inkspan does not claim compatibility with untested major-version integration semantics |
| Collaboration | Inkspan provides provider-neutral editor/Yjs bindings; host owns provider lifecycle, room authorization, awareness privacy, persistence and audit | official Yjs/provider documentation plus Inkspan public contract | collaboration tests and architecture ownership matrix | No network-provider or tenant-authorization authority is implied |
| Secure development | Security controls are developed test-first, with exact-head scanning/review/package evidence and root-cause regression | NIST SP 800-218 SSDF 1.1 | CI/security/SAST/package/provenance gates, doctoring and regression history | Repository evidence is not a claim of complete SSDF organizational conformance |
| Office rendering | JSON→DOCX/XLSX/PPTX is deterministic, bounded, network-free, macro-free, injection-aware and package-inspected | Office Open XML specifications and relevant Python package contracts | Office renderer tests, Python coverage/docstring/package gates | Format fidelity is limited to explicitly tested supported constructs |
| DOCX informative PNG figures | Informative figures accept only bounded inline PNG data, explicit alt text, bounded dimensions/bytes and deterministic WordprocessingML output | Office Open XML drawing semantics; python-docx public picture APIs | protected-main #121 renderer/schema/tests, ADR 0022 and PNG doctoring | No remote/file/SVG/JPEG fetch, decorative-image claim, arbitrary drawing authority, or image-based model inference is implied |
| DOCX bounded rich-text runs | `rich_paragraph` preserves ordered bold/italic/underline run emphasis through a strict bounded JSON contract | Office Open XML run semantics; python-docx run API | protected-main #124 renderer/schema/tests, ADR 0023 and rich-run doctoring | No arbitrary Word styles, font/color/size, hyperlink, field-code, tracked-change, raw-OOXML or source-format parsing authority is implied |
| DOCX bounded paragraph alignment | `paragraph` and `rich_paragraph` optionally preserve exact `left`, `center`, `right`, or `justify`; omission preserves inherited/default Word alignment | Microsoft WordprocessingML paragraph documentation; python-docx paragraph API | protected-main #130 renderer/schema/tests, ADR 0024, Office guide and paragraph-alignment doctoring | Alignment is bounded to the protected paragraph contract; list/table/title/page-layout/style authority is not implied |
| DOCX bounded heading alignment | `heading` optionally preserves the same exact `left`, `center`, `right`, or `justify` contract through the shared paragraph-alignment mapping; omission preserves inherited/default heading-style alignment | Microsoft WordprocessingML paragraph documentation; python-docx paragraph API | protected-main #134 renderer/schema/tests, ADR 0025, Office guide and heading-alignment doctoring | Heading alignment adds no arbitrary heading style, outline numbering, TOC, list/table/title/page-layout, source-format, network, model, credential or persistence authority |
| DOCX bounded external hyperlinks | `rich_paragraph.runs[]` optionally preserves one exact bounded printable-ASCII absolute HTTP(S) target as a relationship-backed external `w:hyperlink` while retaining visible Unicode text and run emphasis | ECMA-376 Office Open XML package/WordprocessingML semantics; Microsoft Open XML hyperlink/relationship documentation; python-docx 1.2.0 hyperlink feature analysis | protected-main #137 renderer/schema/OOXML tests, ADR 0026 and Office guidance | Accepted syntax is not destination trust; Inkspan performs no fetch, DNS, redirect, local-file read, credential use, tenant policy, phishing policy, internationalized-URI conversion, persistence, or distribution |
| DOCX bounded single-section page layout | Proposed `page_layout` accepts only A4/Letter, portrait/landscape, and complete integer 0–100 mm edge margins; it applies only to the existing sole DOCX section and is canonicalized after the layout pass | ECMA-376 Office Open XML section/page semantics; python-docx 1.2.0 section API and section guidance | active PR #141 schema/renderer/page-layout tests, ADR 0027, `docs/docx-page-layout.md`, page-layout doctoring, all-four paper/orientation round trips, page-break/hyperlink/image fidelity and DOCX-only format-boundary tests | `implemented_on_active_pr`; not protected-main or released authority, and no arbitrary page geometry, multiple sections, headers/footers, printer/PDF service, persistence, auth, network, model, credential, or host policy authority is implied |
| Release authority | Source movement invalidates exact-head evidence; stale assets/digest ambiguity fail closed; formal approval remains distinct from status/comments | GitHub protected-branch/review/release/attestation behavior and repository policy | release workflow tests, package checksums, browser evidence, SBOM/provenance, formal reviews | Local success or automated prose does not authorize protected merge/release |

## Current primary references

Bray, T. (Ed.). (2015). *The I-JSON Message Format* (RFC 7493). RFC Editor. https://doi.org/10.17487/RFC7493

Bray, T. (Ed.). (2017). *The JavaScript Object Notation (JSON) Data Interchange Format* (RFC 8259; STD 90). RFC Editor. https://doi.org/10.17487/RFC8259

Ecma International. (2021). *ECMA-376: Office Open XML file formats* (5th ed.). https://ecma-international.org/publications-and-standards/standards/ecma-376/

Ecma International. (2026). *ECMA-402: ECMAScript 2026 internationalization API specification* (13th ed.). https://402.ecma-international.org/

Fielding, R., Nottingham, M., & Reschke, J. (Eds.). (2022). *HTTP Semantics* (RFC 9110; STD 97). RFC Editor. https://doi.org/10.17487/RFC9110

MacFarlane, J. (2024, January 28). *CommonMark specification* (Version 0.31.2). CommonMark. https://spec.commonmark.org/0.31.2/

Microsoft. (n.d.-a). *Browsers*. Playwright documentation. Retrieved August 10, 2026, from https://playwright.dev/docs/browsers

Microsoft. (n.d.-b). *Hyperlink class (DocumentFormat.OpenXml.Wordprocessing)*. Microsoft Learn. Retrieved August 10, 2026, from https://learn.microsoft.com/en-us/dotnet/api/documentformat.openxml.wordprocessing.hyperlink

Microsoft. (n.d.-c). *HyperlinkRelationship class (DocumentFormat.OpenXml.Packaging)*. Microsoft Learn. Retrieved August 10, 2026, from https://learn.microsoft.com/en-us/dotnet/api/documentformat.openxml.packaging.hyperlinkrelationship

Microsoft. (n.d.-d). *Projects*. Playwright documentation. Retrieved August 10, 2026, from https://playwright.dev/docs/test-projects

Microsoft. (n.d.-e). *Release notes: Version 1.62*. Playwright. Retrieved August 10, 2026, from https://playwright.dev/docs/release-notes

Microsoft. (n.d.-f). *Working with paragraphs*. Microsoft Learn. Retrieved August 10, 2026, from https://learn.microsoft.com/en-us/office/open-xml/word/working-with-paragraphs

Node.js contributors. (2026). *Modules: Packages*. Node.js documentation. https://nodejs.org/api/packages.html

ProseMirror. (n.d.). *ProseMirror reference manual*. Retrieved August 10, 2026, from https://prosemirror.net/docs/ref/

python-docx. (n.d.-a). *Hyperlink — python-docx 1.2.0 documentation*. Retrieved August 10, 2026, from https://python-docx.readthedocs.io/en/latest/dev/analysis/features/text/hyperlink.html

python-docx. (n.d.-b). *Working with text*. Retrieved August 10, 2026, from https://python-docx.readthedocs.io/en/latest/user/text.html

python-docx contributors. (2025). *Working with sections (python-docx 1.2.0 documentation).* https://python-docx.readthedocs.io/en/latest/user/sections.html

python-docx contributors. (2025). *Section objects (python-docx 1.2.0 documentation).* https://python-docx.readthedocs.io/en/stable/api/section.html

Rundgren, A., Jordan, B., & Erdtman, S. (2020). *JSON Canonicalization Scheme (JCS)* (RFC 8785). RFC Editor. https://doi.org/10.17487/RFC8785

Souppaya, M., Scarfone, K., & Dodson, D. (2022). *Secure Software Development Framework (SSDF) Version 1.1: Recommendations for Mitigating the Risk of Software Vulnerabilities* (NIST SP 800-218). National Institute of Standards and Technology. https://doi.org/10.6028/NIST.SP.800-218

Web Hypertext Application Technology Working Group. (2026). *HTML Standard: Parsing HTML documents* (Living Standard). Retrieved August 10, 2026, from https://html.spec.whatwg.org/multipage/parsing.html

World Wide Web Consortium. (2013). *PROV-DM: The PROV Data Model*. https://www.w3.org/TR/prov-dm/

World Wide Web Consortium. (2017, February 23). *Web Annotation Data Model*. https://www.w3.org/TR/annotation-model/

World Wide Web Consortium. (2023, June 6). *Accessible Rich Internet Applications (WAI-ARIA) 1.2*. https://www.w3.org/TR/wai-aria-1.2/

World Wide Web Consortium. (2024, December 12). *Web Content Accessibility Guidelines (WCAG) 2.2*. https://www.w3.org/TR/WCAG22/

World Wide Web Consortium. (2026, June 24). *Clipboard API and events* (W3C Working Draft). https://www.w3.org/TR/2026/WD-clipboard-apis-20260624/

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

Envelope identity routing, SafeClipboard, W3C text-position selector evidence, cross-engine browser assurance, headless deterministic Markdown serialization, CSS paged-media output, accessible placeholder semantics, DOCX informative PNG figures, bounded rich-text runs, bounded paragraph alignment, bounded heading alignment, and bounded external hyperlinks are implemented on protected `main`. The bounded single-section DOCX page-layout contract remains Proposed / `implemented_on_active_pr` in PR #141 and must not be promoted to protected behavior until integration. The W3C selector remains revision-scoped and projection-version-scoped and must satisfy `0 <= start <= end <= projectedCodePointLength`; protected integration does not transfer annotation persistence, source identity, authorization, or re-anchoring authority from the host. The browser gate being protected does not let a future release reuse historical browser evidence: the exact release candidate must generate fresh evidence bound to its own source, committed synthetic corpus, package-lock SHA-256, run identity, browser revisions, and packed npm artifact SHA-256.

Documentation must not promote Proposed or Planned capabilities to Implemented merely because a PR, issue, or design document is detailed.

## Review cadence

Revalidate this matrix when a public schema, selector projection, serialization/package boundary, security boundary, supported runtime/browser line, Office format contract, collaboration/provider contract, accessibility interaction, release workflow, or authoritative external standard materially changes. Prefer explicit supersession over silent historical rewrite.
