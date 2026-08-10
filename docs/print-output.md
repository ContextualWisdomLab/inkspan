# Browser print and paged-output contract

Status: Implemented on protected main

Inkspan's shipped stylesheet is an opt-in presentation contract for the interactive editor. The print boundary defined here makes the same authored document suitable for browser print preview and print-to-PDF without turning Inkspan into a PDF renderer, print service, persistence layer, or durable-export authority.

## Product boundary

When `@contextualwisdomlab/cwl-editor/styles.css` is imported, the stylesheet defines an explicit `@media print` mode. Inkspan owns only deterministic presentation of the currently rendered editor document under that media query. The browser and operating system remain responsible for pagination, printer/PDF-driver behavior, paper size, margins, headers and footers, color-management, font rasterization, and final artifact creation.

Inkspan does not add actor identity, timestamps, signatures, page numbers, legal attestations, tenant metadata, durable export receipts, or PDF conformance claims. Hosts that need a governed export workflow must establish their own authorization, provenance, retention, signing, storage, and downstream accessibility requirements.

## Print behavior

The print stylesheet:

- removes the editor shell border, rounding, screen clipping, and scroll/max-height constraints so the complete document can participate in page fragmentation;
- hides toolbar controls, collaboration status, remote collaborator carets, and collaborator labels because they are interactive/transient application chrome rather than authored document content;
- suppresses placeholder pseudo-content so instructional UI text is not mistaken for authored output;
- neutralizes dark-screen theme colors to a high-contrast white-paper presentation while preserving semantic borders and text;
- keeps authored links underlined so link affordance does not depend on color;
- keeps headings with following content where the browser supports `break-after`;
- avoids splitting preformatted blocks, block quotes, images, and individual table rows where the browser supports `break-inside`;
- allows long tables to paginate rather than forcing the whole table onto one page, and asks the browser to repeat table headers through normal table-header-group semantics;
- removes horizontal scrolling from preformatted blocks in favor of printable wrapping; and
- applies conservative widow/orphan controls to the document surface.

These are paged-media hints, not a promise that every browser/printer combination will produce byte-identical pagination. Browser engines and printer/PDF drivers remain separate rendering authorities.

## Accessibility and fidelity

Printing must not depend on the visual color theme to distinguish authored links, and it must not leak collaborative presence or placeholder UI into the document. Author-provided semantic structure remains the source: headings remain headings, tables remain tables, links remain links, images retain their DOM alternative-text semantics, and code/preformatted text remains text rather than rasterized screen content.

Inkspan does not append raw link destinations automatically because that changes authored content and may disclose sensitive URLs. A host that requires archival link-destination expansion can generate a separately governed export representation under its own policy.

## Failure and degraded behavior

A browser that ignores a supported fragmentation hint may choose a different page break; that is a rendering limitation, not permission to drop authored content. Screen-mode behavior remains unchanged outside `@media print`. If the host omits the Inkspan stylesheet entirely, this print contract is not active.

The print CSS must remain usable without JavaScript, network access, model calls, credentials, or a database. It must not fetch external print resources.

## Verification

The repository keeps a source-level stylesheet contract for fast regression feedback and separately requires post-build package verification against `dist/cwl-editor.css`, the exact target exported as `@contextualwisdomlab/cwl-editor/styles.css`. Real Chromium, Firefox, and WebKit print-media evidence must load that built public stylesheet artifact rather than `src/styles.css`. Together these gates require the print media boundary, complete-document flow, interactive-chrome suppression, placeholder suppression, conservative fragmentation rules, and color-independent link affordance on the shipped package surface.

Normal exact-head CI continues to run complete JavaScript coverage/build/package gates, pinned real-browser evidence, SAST/Security Scan, and Office Python 3.11-3.14 gates so this presentation change cannot bypass unrelated release assurance.

The exact standards rationale and maturity/claim limits are recorded in [`doctoring/browser-print-paged-media.md`](doctoring/browser-print-paged-media.md).

## Rollback

Rollback removes only the print-media overrides and this documentation. It does not alter canonical editor content, document envelopes, autosave, collaboration state, deterministic serializers, Office artifacts, or host persistence. A rollback must not be described as deleting or invalidating documents previously printed by a browser.
