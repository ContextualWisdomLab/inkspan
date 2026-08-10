# ADR 0021: CSS paged-media print boundary

Status: Proposed

## Context

Inkspan ships an opt-in interactive editor stylesheet. Protected `main` currently has no explicit `@media print` contract: screen-oriented overflow/max-height behavior and interactive toolbar/collaboration/caret/placeholder chrome can therefore affect browser print and print-to-PDF output.

Issue #115 and active PR #116 define a bounded product slice that treats printing as a presentation concern of the shipped stylesheet rather than as a new Inkspan PDF service. Because #116 is not yet protected-main authority, this ADR records the intended decision as Proposed.

Media Queries Level 3 is a W3C Recommendation and defines the `print` media type. CSS Fragmentation Level 3 defines fragmentation controls such as break behavior, widows, and orphans; CSS Paged Media Level 3 defines the paged-media page model while delegating fragmentation to CSS Fragmentation. The latter modules are not promoted here to certification claims beyond their actual publication status.

## Alternatives considered

### Leave printing entirely to embedding hosts

Rejected. Inkspan's own shipped screen CSS can directly cause clipped content or print interactive chrome, so the package must at least neutralize its own presentation side effects.

### Add JavaScript print-mode orchestration

Rejected for the base contract. Browser print media is declarative and a JavaScript state machine would add runtime coupling, race conditions, and a new lifecycle authority without being necessary for the core output correction.

### Add an Inkspan server-side PDF renderer

Rejected. It would introduce a materially different rendering, deployment, persistence/security, font, pagination, and artifact-authority surface. That is not required to make the existing browser document print safely.

### Add a CSS-only paged-media presentation contract

Selected. Inkspan owns only the CSS it ships: it removes its screen-only constraints/chrome under `print`, preserves authored content, and uses conservative fragmentation rules where supported. Hosts remain free to provide a separate durable PDF/print service under their own authority.

## Decision

When PR #116 or a verified successor reaches protected `main`, Inkspan's shipped stylesheet will contain a declarative `@media print` boundary that:

1. hides interactive-only toolbar, collaboration status, remote caret/cursor labels, and placeholder pseudo-content;
2. removes screen-only editor overflow and maximum-height clipping so the complete authored document can participate in pagination;
3. neutralizes editor-shell decoration that is inappropriate for document output without deleting authored document structure;
4. preserves tables, images, preformatted/code blocks, headings, blockquotes, lists, and links;
5. applies conservative fragmentation controls such as `break-inside`, `break-after`, `widows`, and `orphans` where applicable;
6. keeps authored links distinguishable without relying on color alone; and
7. requires no network, database, credential, model, collaboration-provider, or JavaScript print-mode authority.

The browser/user agent remains the pagination renderer. Inkspan does not claim page-number, header/footer, signature, timestamp, tenant, archival-PDF, PDF/A, or durable-export semantics from this CSS contract.

## Consequences

- Browser print and print-to-PDF receive a document-oriented representation rather than the interactive screen chrome Inkspan itself introduced.
- The implementation remains small, standalone, and provider-neutral.
- Exact pagination still varies with user-agent, paper size, fonts, printer settings, and host CSS; Inkspan therefore scopes support to its own presentation contract rather than claiming identical physical pages across environments.
- A future high-fidelity PDF service remains a separate architecture decision.

## Failure and recovery

A regression that prints interactive chrome, clips the document surface, exposes placeholder UI, or hides authored content fails the print contract. Recovery is to repair the shipped CSS/test boundary, not to inject print-only document mutations or silently remove content.

If a browser ignores a draft fragmentation property, authored content must still remain available; unsupported hints must degrade to ordinary browser pagination rather than false success or content loss.

## Security and privacy impact

The print stylesheet does not authorize disclosure. Browser print can expose the full authored document to a printer, PDF destination, or OS spooler selected by the user/host, so hosts remain responsible for document authorization, classification, printing policy, local device controls, retention, and any durable exported artifact.

Inkspan must not add actor, tenant, timestamp, signature, or document-body telemetry merely to support print styling.

## Compatibility and migration

The contract is additive and media-scoped. Screen presentation, forced-colors behavior, interactive keyboard/focus semantics, editor state, and document serialization remain unchanged outside `print` media.

Embedding applications with their own print stylesheet can continue to override Inkspan under normal CSS cascade rules. Material future changes that introduce a server renderer or durable PDF artifact authority require a superseding ADR.

## Verification and acceptance evidence

Before this ADR becomes Accepted:

- a permanent test must prove protected source previously lacked the required print boundary and then prove the implemented selectors/properties;
- existing screen and forced-colors contracts must remain unchanged;
- real-browser print-media evidence should be added where practical using the existing pinned browser infrastructure without weakening the rich-clipboard gate;
- exact-head CI, Security Scan, SAST, package verification, Office gates, and exact owned coverage policy must pass;
- canonical accessibility/print/export documentation must be reconciled after overlapping writers clear; and
- protected integration must complete before the behavior is called shipped.

## Rollback or supersession

Before protected integration, rollback closes/supersedes the active print slice without changing current screen CSS. After integration, rollback may remove only the new print overrides if a regression is proven, while documenting the print-support regression explicitly.

A dedicated PDF renderer, print service, or archival-document product supersedes this decision only through a new ADR defining artifact authority, rendering engine, fonts, pagination fidelity, security/privacy, reproducibility, storage, provenance, and operational recovery.

## References — APA 7th

World Wide Web Consortium. (2024, May 21). *Media Queries Level 3* (W3C Recommendation). https://www.w3.org/TR/mediaqueries-3/

World Wide Web Consortium. (2016, January 14). *CSS Fragmentation Module Level 3* (Candidate Recommendation Snapshot). https://www.w3.org/TR/css-break-3/

World Wide Web Consortium. (2023, April 6). *CSS Paged Media Module Level 3* (Working Draft). https://www.w3.org/TR/css-page-3/
