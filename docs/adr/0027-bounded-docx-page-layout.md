# ADR 0027: Bounded single-section DOCX page layout

Status: Proposed

Implementation maturity: `implemented_on_active_pr` in PR #141; not protected-main behavior until that PR is integrated.

## Context

Inkspan Office already owns deterministic, network-free JSON-to-DOCX rendering for a deliberately bounded set of document constructs. Protected `main` does not expose page size, orientation, or page margins, so Word documents inherit the renderer template defaults. Enterprise reports and handoffs often need an explicit physical page contract, but exposing arbitrary WordprocessingML or unconstrained section authoring would substantially enlarge the fidelity, compatibility, and security surface.

`python-docx` 1.2.0 models page dimensions, orientation, and margins on a Word `Section`. Its current section guidance explicitly describes a section as the page-layout authority and shows that landscape orientation requires the page width and height to be swapped together with the orientation property. ECMA-376 identifies Office Open XML as the normative vocabulary and document representation for DOCX packages.

## Alternatives considered

1. **Keep implicit template defaults.** Lowest implementation risk, but leaves buyer-visible physical layout nondeterministic from the request contract and cannot express common A4/Letter requirements.
2. **Expose arbitrary dimensions and raw section properties.** Maximizes flexibility but creates a broad OOXML/layout authority, increases invalid or nonsensical combinations, and makes deterministic support claims harder to prove.
3. **Add multi-section authoring now.** Supports mixed layouts but creates ordering, section-break, header/footer, and inheritance semantics that are not required for the immediate buyer gap.
4. **Selected: one optional complete bounded `page_layout` object for the existing single section.** Gives deterministic common page setup while keeping the contract small and fail-closed.

## Decision

For DOCX requests only, Inkspan may accept an optional top-level `page_layout` object with this exact complete shape:

- `paper_size`: `a4` or `letter`;
- `orientation`: `portrait` or `landscape`;
- `margins_mm`: required integer `top`, `right`, `bottom`, and `left`, each from 0 through 100.

A4 maps to 210 × 297 mm. Letter maps to 8.5 × 11 inches. Landscape sets the Word orientation and swaps the physical width and height. The layout applies only to the document's existing single section. Missing fields, unknown fields, aliases, case variants, booleans, floats, strings, nulls, out-of-range margins, and multiple sections fail closed. When `page_layout` is absent, the existing renderer behavior is preserved.

The public safety facade strips `page_layout` before invoking the established content renderer, applies the validated section settings to the returned DOCX, and then performs the existing deterministic OOXML canonicalization. This preserves the internal content-renderer payload contract while keeping page-layout validation at the public product boundary.

## Consequences and ownership trade-offs

The selected contract covers the common A4/Letter portrait/landscape use case without granting arbitrary page geometry, multi-section layout, headers, footers, gutters, columns, mirrored margins, page numbering, printer selection, CSS-to-Word mapping, or PDF-service authority. Hosts still own source-format interpretation, export authorization, storage, distribution, and business-specific layout policy.

Reopening and saving the generated package through `python-docx` is an intentional implementation step. Compatibility is therefore asserted only for the tested Inkspan-generated single-section document surface, not for arbitrary third-party DOCX round trips.

## Failure and recovery semantics

Invalid layout input raises the existing bounded `OfficeDocumentError` path and never publishes a partial output. `write_office_document()` renders completely before atomic publication, so layout rejection cannot leave a destination file containing a partially modified package. A multiple-section package is rejected instead of guessing which sections should inherit the request.

Recovery is caller-owned: correct the request and rerun rendering. Inkspan does not mutate a durable source document, retry against a remote service, or retain a failed package.

## Security and privacy impact

The contract adds no network access, filesystem input authority, macros, raw OOXML, model call, credential, identity, tenant, persistence, audit, or print-service authority. Numeric and enum bounds prevent arbitrary section XML from entering the renderer. Existing XML/resource validation, deterministic packaging, redacted error, and atomic-publication boundaries remain in force.

The request may still contain document content, so hosts remain responsible for authorization, privacy classification, retention, logging, and storage. Page-layout values themselves are ordinary document-format metadata and are not authorization or provenance evidence.

## Compatibility and migration

The field is optional. Existing DOCX requests without `page_layout` keep the prior contract and output behavior. XLSX and PPTX request schemas are unchanged. A future expansion to arbitrary paper dimensions or multiple sections requires a new ADR or an explicit superseding revision rather than silently widening this decision.

Because the feature is still on an active Draft PR, downstream hosts must not depend on it as a released capability. Version/CHANGELOG promotion occurs only after the stable 0.6.0 release boundary is complete and this feature is accepted for the next release line.

## Verification and acceptance

Acceptance requires all of the following on one exact live-base-integrated head:

- schema evidence for the exact object shape and bounds;
- real `python-docx` round trips proving A4 landscape and Letter portrait physical dimensions, orientation, and margins;
- fail-closed missing/type/enum/range/unknown-field tests;
- rejection of multiple sections;
- deterministic repeated-render evidence;
- no-partial-publication evidence;
- Python 3.11–3.14 Office verification with 100% owned production statement/branch and public-docstring coverage;
- repository CI, security scanning, package verification, and applicable review evidence;
- canonical buyer documentation, doctoring, traceability, and next-release metadata reconciled before Ready/merge evaluation.

PR #141 currently supplies the implementation and exact-head machine evidence but remains Draft because issue #118 still owns the 0.6.0 registry operational boundary. This ADR therefore remains Proposed.

## Rollback and supersession

Before protected integration, rollback is branch closure. After a future accepted merge, rollback is a normal revert that removes the optional schema field, page-layout adapter, tests, and associated release documentation together. A revert must not leave documentation claiming support that protected code no longer provides. Any later widening to multiple sections or arbitrary dimensions should supersede this ADR explicitly.

## Standards and implementation basis

- Ecma International. (2021). *ECMA-376: Office Open XML file formats* (5th ed.). https://ecma-international.org/publications-and-standards/standards/ecma-376/
- python-docx contributors. (2025). *Working with sections (python-docx 1.2.0 documentation).* https://python-docx.readthedocs.io/en/latest/user/sections.html
- python-docx contributors. (2025). *Section objects (python-docx 1.2.0 documentation).* https://python-docx.readthedocs.io/en/stable/api/section.html
