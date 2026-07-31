# Changelog

All notable changes to **Inkspan** (`@contextualwisdomlab/cwl-editor`) are documented in this file.

## [0.2.0] — 2026-07-31

Commercial host-integration release: a buyer embedding the editor can control it, surface image failures, edit tables, and emit email-ready HTML without forking.

### Added
- **`CwlEditorHandle`** via `ref` — `getValue` / `getHTML` / `getMarkdown` / `setValue` / `clear` / `focus` / `blur` / `isEmpty` / `getEditor`
- **`onImageError`** — size-guard and decode failures are reported to the host (no silent swallow on the commercial path)
- **Table editing toolbar** — add column after, add row after, delete table (enabled only when the cursor is in a table)
- **Horizontal rule** toolbar control
- **Live toolbar state** — re-renders on TipTap `transaction` / `selectionUpdate` so active/disabled UI stays correct
- **`markdownToEmailHtml`** — Markdown → email body HTML (fragment or full document), preserving inline base64 images for compose→send

### Changed
- Package version **0.2.0**
- README documents the imperative handle, `onImageError`, table ops, and email helper
- README submodule URL corrected to `ContextualWisdomLab/inkspan`

### Tests
- 113 real vitest cases driving shipped modules (handle, image errors, table ops, email HTML)

## [0.1.0] — prior

Initial public surface: Markdown/HTML modes, base64 inline images, standalone converter, bundled Noto Sans fonts, ship gates.
