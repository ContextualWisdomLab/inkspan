# ADR 0027: Hangul document authoring boundary

- Status: Proposed
- Date: 2026-08-14
- Decision owners: Inkspan maintainers

## Context

Inkspan needs to open, edit, and save Korean Hangul Word Processor documents without turning the editor package into a filesystem-, network-, or vendor-runtime-owning application. HWP 5.x is a published binary format. HWPX is the XML-based Hangul standard-document format built on OWPML, whose document structure is standardized as KS X 6101. The Korean standards catalogue records KS X 6101 as current after confirmation on 2024-10-30. Hancom also publishes HWP/OWPML format material and describes HWPX as an OWPML-based, machine-readable format.

The editor already treats TipTap/ProseMirror JSON as the editable document authority. Introducing a second editable authority for HWP/HWPX would make autosave, collaboration, revision evidence, and host integration inconsistent.

## Alternatives considered

1. Parse HWP/HWPX directly inside the React editor. Rejected because binary/XML parsing, optional WASM initialization, document resources, and UI lifecycle become coupled.
2. Convert every document through HTML and keep HTML as the editing authority. Rejected because HTML cannot represent every Hangul layout primitive and would make conversion loss implicit.
3. Introduce a framework-neutral Hangul bridge with a host-injected parser/serializer engine and TipTap JSON as the editing authority. Selected.

## Decision

Inkspan exposes a framework-neutral Hangul bridge under a dedicated package boundary. The bridge accepts HWP/HWPX bytes through a host-injected engine, projects the supported semantic subset to TipTap JSON, and serializes edited JSON back through the engine. HWPX is the recommended export format because it is the open XML/OWPML path; HWP remains an explicit compatibility export.

The host owns file selection, filesystem access, network access, WASM/module initialization, password UX, persistence, and download/publication. The bridge receives bytes and returns bytes. It never fetches external document resources.

Unsupported structures are never silently asserted to be lossless. Import results carry warnings and a lossy flag. Export rejects editor structures that cannot be represented by the current bridge rather than dropping them silently.

## Consequences

- Existing `CwlEditorHandle.setDocumentJson()` remains the single editing ingress.
- HWP and HWPX share one product API while their parsing implementations remain replaceable.
- Parser/serializer upgrades do not require React changes.
- Full visual round-trip fidelity is not claimed until covered by real-document compatibility fixtures.
- HWPX can later gain a first-party native OWPML implementation without changing the public bridge contract.

## Failure and recovery semantics

Malformed input, unsupported source identity, resource-limit breaches, engine failures, and unsupported export structures fail closed with stable error codes. The original input is never mutated. Hosts may keep the original bytes and offer a fallback download or alternate viewer.

## Security and privacy impact

HWP/HWPX bytes are untrusted input. The bridge has no remote-resource fetch path and no active-content execution path. Source and output byte bounds are enforced before publication. Credentials, cookies, filesystem paths, and document passwords are not part of result objects or telemetry contracts.

A future native HWPX parser must additionally bound ZIP entries, expansion ratio, XML depth, XML node count, text length, relationship targets, embedded objects, and external references. DTD and external-entity resolution must remain disabled.

## Compatibility and migration

The public contract identifies source and output as `hwp` or `hwpx`. HWPX is preferred for newly saved documents. Existing HWP users can explicitly request HWP export when their selected engine supports it. If a later native HWPX implementation replaces the initial engine adapter, compatibility is governed by the same JSON projection tests and real-document fixture suite.

## Verification and acceptance evidence

Acceptance requires all of the following on one exact PR head:

- HWP and HWPX import tests;
- edited JSON to HWPX and HWP export tests;
- real documents reopened after export and compared against expected semantic content;
- hostile/malformed input and resource-limit tests;
- package-consumer verification for ESM, CommonJS, and declarations;
- production statement and branch coverage at repository policy thresholds;
- public API docstring coverage at repository policy thresholds;
- required CI, SAST, security, and independent review gates.

Until that evidence is merged to protected `main`, this ADR remains Proposed.

## Rollback or supersession

The feature can be rolled back by removing the Hangul package subpath while retaining this ADR as historical evidence. A future design that makes native OWPML the canonical editable authority or grants the package filesystem/network authority requires a superseding ADR.

## Standards and source traceability

- Korean Agency for Technology and Standards. (2024). *KS X 6101: Open Word-Processor Markup Language (OWPML) document structure*. e-Nara Standard Certification. https://www.standard.go.kr/KSCI/standardIntro/getStandardSearchView.do?ksNo=KSX6101
- Hancom Inc. (n.d.). *HWP/OWPML formats*. https://license.hancom.com/support/downloadCenter/hwpOwpml
- Hancom Inc. (n.d.). *HWPX format structure*. Hancom Tech. https://tech.hancom.com/hwpxformat/
