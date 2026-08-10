# DOCX page-layout doctoring

Status: `implemented_on_active_pr` (PR #141); not protected-main implementation authority.

## Claim under review

Inkspan's proposed DOCX `page_layout` contract makes common physical page setup deterministic without expanding the Office renderer into arbitrary WordprocessingML or a print/PDF service. The bounded contract is intentionally limited to A4 or Letter, portrait or landscape, and explicit integer edge margins from 0 through 100 mm on the renderer's existing single section.

## Primary-source basis

The current `python-docx` 1.2.0 section documentation states that Word sections own page-layout settings such as margins and orientation. Its documented landscape example changes the orientation and swaps `page_width` and `page_height`; the stable Section API exposes orientation, page width/height, and edge margins as read/write properties. Inkspan follows that public API rather than writing raw `w:sectPr` XML.

ECMA-376 is the normative Office Open XML standard family for document representation and packaging. The current Ecma publication page identifies ECMA-376 as *Office Open XML file formats* and the 5th edition as the current listed edition. Inkspan does not claim to implement the entire WordprocessingML layout vocabulary; the standard is the interoperability basis for the generated package while `python-docx` is the concrete library boundary exercised in tests.

## Why the contract is narrow

A fully general Word page-layout surface would require policy for arbitrary dimensions, section breaks, headers/footers, gutters, columns, mirrored margins, inheritance, and mixed orientation. Those are independent fidelity commitments and would make invalid combinations much harder to reject deterministically. The selected contract instead covers two common paper sizes and one complete section-level layout object. Unknown or partial shapes fail closed rather than inheriting hidden defaults.

## Fidelity and determinism evidence

PR #141's permanent tests reopen generated DOCX bytes with `python-docx` and check the actual section properties for A4 landscape and Letter portrait. A4 uses 210 × 297 mm; Letter uses 8.5 × 11 inches. Landscape swaps width/height and sets `WD_ORIENT.LANDSCAPE`. All four margins are checked after round trip.

The feature is applied before Inkspan's existing OOXML canonicalization step. Repeated rendering of the same request is required to remain byte-identical. A multiple-section package fails closed so the implementation never guesses which section should receive the caller's layout.

## Safety, privacy, and operational boundary

The field cannot introduce network fetches, file reads, macros, raw OOXML, model execution, credentials, tenant context, durable persistence, or printer/PDF-service authority. Existing XML/resource validation and atomic output publication remain authoritative. Invalid layout fails before the destination file is published.

Hosts still decide whether an author may export, which page layout is appropriate for a business document, where the artifact may be stored, how it is distributed, and whether its content requires special privacy controls. Layout metadata is not authentication, authorization, provenance, or audit evidence.

## Compatibility and rollback

Omitting `page_layout` preserves the pre-existing DOCX request path. XLSX and PPTX schemas remain unchanged. Until PR #141 is merged, all documentation must classify the feature as active-PR behavior. Rollback before merge is branch closure; after a future merge, code, schema, tests, ADR status, buyer documentation, traceability, and release notes must be reverted together.

## APA 7 references

Ecma International. (2021). *ECMA-376: Office Open XML file formats* (5th ed.). https://ecma-international.org/publications-and-standards/standards/ecma-376/

python-docx contributors. (2025). *Section objects (python-docx 1.2.0 documentation).* https://python-docx.readthedocs.io/en/stable/api/section.html

python-docx contributors. (2025). *Working with sections (python-docx 1.2.0 documentation).* https://python-docx.readthedocs.io/en/latest/user/sections.html
