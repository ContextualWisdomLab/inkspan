# ADR 0032: Bounded local spreadsheet body import

Status: Proposed

## Context

Buyers need to insert visible worksheet contents from a locally selected `.xls` or `.xlsx` file into the current Inkspan document. The earlier Office renderer contract writes deterministic XLSX artifacts and keeps formula-looking strings inert (ADR 0012). It does not give the editor a local import path. Untrusted workbook bytes can carry macros, formulas, hyperlinks, hidden sheets, and hostile JavaScript object graphs. Those bytes must not gain network, credential, persistence, model, transport, or formula-execution authority.

This decision is Proposed active-PR architecture for PR #318. It is not protected-main implementation authority until the branch merges with the required exact-head evidence.

## Alternatives considered

### Server-side conversion

Rejected. Uploading workbook bytes would move transport, retention, and tenant isolation into Inkspan or force every host to stand up a conversion service for a local authoring action.

### CSV-only or paste-only import

Rejected as the primary contract. Buyers already have Excel workbooks. Paste remains available through SafeClipboard, but it does not preserve worksheet names or hidden-sheet exclusion from a real file.

### Statically bundle the parser into the editor startup graph

Rejected. Ordinary editor startup must not pay for or evaluate a workbook parser before the user selects a file.

### Local preflight, lazy official SheetJS parse, inert TipTap insertion

Selected. Classify ZIP/OLE bytes first, load the pinned official SheetJS CE 0.20.3 tarball only after that preflight, project visible displayed/cached cell text into parser-neutral workbook data, and insert one heading-plus-table batch at the current selection.

## Decision

Inkspan accepts local `.xls` and `.xlsx` bytes through the toolbar file picker and the framework-neutral `@contextualwisdomlab/cwl-editor/spreadsheet` subpath.

The import must:

1. reject source size above 64 MiB before allocating the file body;
2. classify only ZIP (`xlsx`) and OLE compound-file (`xls`) signatures;
3. load the parser only after that envelope preflight;
4. recover BIFF8 worksheet visibility from raw BoundSheet8 records rather than trusting mutable parser-emitted hidden flags;
5. insert only visible, non-empty worksheets as a level-3 heading, one rectangular table of ordinary cells, and a trailing paragraph;
6. project displayed or cached cell text only — formulas, macros, and hyperlinks receive no execution or editor authority;
7. enforce worksheet, row, column, cell, and text ceilings before TipTap materialization;
8. announce progress and counts through a polite status region, and emit only payload-redacted failures;
9. read genuine `File`/`Blob` bodies through `arrayBuffer()` when present, otherwise `FileReader` or `Response`, so DOMs that omit `Blob.arrayBuffer` still insert the selected workbook.

Hosts retain transport, authorization, tenant isolation, durable persistence, credentials, retention, and model-use policy. Worksheet names are authoring labels, not tenant identifiers, and are not PII-masked in this lane.

## Consequences

- Authors can place a real worksheet into the document body as editable table cells.
- Hidden worksheets and formula/link payloads stay out of the inserted document.
- The spreadsheet subpath remains lazy and package-managed rather than part of ordinary editor startup.
- jsdom and older DOMs that omit `File.arrayBuffer` no longer fail closed on a genuine local file.

## Failure and recovery

Malformed signatures, hostile descriptors, parser exceptions, resource-limit violations, and rejected editor transactions leave the document unchanged and announce `Spreadsheet import failed.` Recovery is to choose a supported visible workbook within the documented ceilings. Hosts may observe the underlying redacted error through `onSpreadsheetError` without receiving cell text, file names, or parser payloads in the status region.

## Security and privacy impact

Workbook bytes are untrusted local content. The parser receives no network, credential, persistence, or model authority. Formula text, hyperlink targets, hidden-sheet values, and private exception causes must not appear in ordinary diagnostics. This decision does not authorize destination fetching, macro execution, or host-owned audit of workbook contents.

## Compatibility and migration

The change is additive. Existing documents, Office rendering, and ADR 0012 literal-formula export semantics are unchanged. Removing the toolbar control or the `./spreadsheet` subpath after publication would be a public compatibility change.

## Verification

Acceptance requires a known small XLS/XLSX fixture to insert into the document body with asserted heading and cell text, plus 100% owned-production coverage, package-consumer verification of the spreadsheet subpath, and exact-head product CI. Historical or predecessor-head checks do not transfer.

## Rollback or supersession

Rollback removes the toolbar control and spreadsheet subpath from the unmerged branch, or reverts the merged change as one reviewed compatibility decision. A future server converter, CSV-only path, or different parser may supersede this ADR only if it preserves local-only authority, inert cell projection, and redacted failures.

## References — APA 7th

Ecma International. (2021). *ECMA-376: Office Open XML file formats* (5th ed.). https://ecma-international.org/publications-and-standards/standards/ecma-376/

Microsoft. (n.d.). *[MS-XLS]: Excel Binary File Format (.xls) Structure*. Microsoft Learn. Retrieved August 17, 2026, from https://learn.microsoft.com/en-us/openspecs/office_file_formats/ms-xls

SheetJS. (n.d.). *SheetJS CE*. Retrieved August 17, 2026, from https://docs.sheetjs.com/

World Wide Web Consortium. (2023, June 6). *Accessible Rich Internet Applications (WAI-ARIA) 1.2*. https://www.w3.org/TR/wai-aria-1.2/
