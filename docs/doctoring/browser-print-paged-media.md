# Browser print and paged-media assurance

Status: Implemented on active PR

## Decision scope

Inkspan uses CSS media adaptation rather than a second document renderer for ordinary browser print preview and print-to-PDF. This preserves the authored DOM as the semantic source while removing transient editor chrome and screen-only clipping under `@media print`.

This evidence supports a bounded browser-presentation claim only. It does not establish PDF/A, PDF/UA, archival fidelity, pagination identity across engines, printer-driver equivalence, signature/authorship, durable export acceptance, or host authorization/persistence.

## Standards authority

Media Queries Level 3 is the normative published authority for selecting `print` presentation. The W3C Recommendation identifies `screen` and `print` as media types and defines media-dependent presentation without changing document content.

CSS Fragmentation Module Level 3 is the latest published Candidate Recommendation Snapshot for the fragmentation rules used here. It defines page/column/region fragmentation, `break-before`, `break-after`, `break-inside`, and widow/orphan behavior. Inkspan uses those rules as progressive paged-layout hints and does not treat implementation support as universal.

CSS Paged Media Module Level 3 remains a Working Draft. It describes generated page boxes, page size/orientation, margins, page numbering, and related paged-media facilities, while delegating content fragmentation to CSS Fragmentation. Inkspan tracks it as a design input only. The current bounded slice deliberately does not claim page-number/header/footer generation or a fixed paper-size contract.

## Product interpretation

The interactive shell has different semantics from the document being printed. Toolbar controls, collaboration presence, remote cursors, cursor labels, placeholders, screen scroll containers, and dark-mode surface colors are application state rather than authored content. The print contract therefore removes or neutralizes them without rewriting the document tree.

Authored hyperlinks remain underlined so the print representation does not rely solely on theme color. Headings, block quotes, code/preformatted text, tables, lists, and images remain semantic HTML content. Fragmentation hints avoid obvious splits where supported while allowing large tables to paginate instead of forcing an impossible one-page box.

## Compatibility and failure semantics

Browser engines and print/PDF drivers can differ in pagination and support for fragmentation hints. The contract is therefore semantic rather than pixel- or byte-identical. Unsupported pagination hints degrade to the browser's normal fragmentation behavior; Inkspan must not hide or delete authored content to manufacture cross-browser parity.

The print stylesheet is network-free and requires no JavaScript activation. If a host does not import the shipped Inkspan stylesheet, the contract is not active. A future change that introduces a separate rendered export format, PDF conformance claim, page-header/footer generation, or server-side print service is a materially different authority decision and requires its own acceptance evidence and ADR where appropriate.

## Privacy and security

Collaboration presence and placeholder text are intentionally excluded from printed output because they are transient UI metadata, not canonical document content. Inkspan does not append raw link destinations automatically because doing so could disclose sensitive URLs that the author did not place visibly in the document.

The CSS path has no permission to fetch external resources, access credentials, infer tenant identity, sign artifacts, persist exports, or record durable audit events. Existing host and browser resource-loading policy remains authoritative for any resource already present in the rendered document.

## Verification and rollback

Permanent tests require an explicit print media block, complete-document flow, suppression of interactive/transient chrome, placeholder suppression, conservative fragmentation controls, and color-independent link affordance. Normal exact-head CI, security scanning, package verification, real-browser clipboard assurance, and Office runtime gates remain independent acceptance authorities.

Rollback removes the print overrides and documentation without changing document envelopes, saved content, collaboration state, serializers, or Office artifacts. Previously printed output is not reinterpreted or revoked by rollback.

## References — APA 7th

World Wide Web Consortium. (2018, December 4). *CSS Fragmentation Module Level 3* (Candidate Recommendation). https://www.w3.org/TR/css-break-3/

World Wide Web Consortium. (2023, September 14). *CSS Paged Media Module Level 3* (Working Draft). https://www.w3.org/TR/css-page-3/

World Wide Web Consortium. (2024, May 21). *Media Queries Level 3* (W3C Recommendation). https://www.w3.org/TR/mediaqueries-3/
