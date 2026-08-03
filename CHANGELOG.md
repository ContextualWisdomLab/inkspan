# Changelog

All notable changes to **Inkspan** (`@contextualwisdomlab/cwl-editor`) are documented in this file.

## [Unreleased]

### Added
- **Provider-neutral real-time collaboration** — a separate `@contextualwisdomlab/cwl-editor/collaboration` entrypoint backed by a host-owned `Y.Doc`, with no transport, authentication, persistence, credential, or provider-lifecycle coupling
- Shared CRDT-aware editor shell preserving the existing toolbar, tables, inline base64 images, Markdown/HTML exports, read-only behavior, and `CwlEditorHandle`
- Allowlisted public awareness payloads with descriptive nonnumeric user identifiers, safe remote label rendering, computed black/white label contrast, and an accessible connection/collaborator status region
- **Inkspan Office 0.1.0** — a deterministic, network-free Python package and CLI that renders strict machine-readable JSON to DOCX, XLSX, or PPTX through `python-docx`, `openpyxl`, and `python-pptx`
- Bundled JSON Schema for structured LLM output, plus in-memory and atomic file-writing APIs
- Formula-injection protection for AI-authored spreadsheet strings and strict rejection of unknown or malformed fields
- Public Office safety facade that rejects XML-incompatible text, cyclic containers, excessive JSON nesting, invalid freeze-pane coordinates, oversized Excel grids/cells, Excel-incompatible worksheet names, and integers Excel cannot preserve exactly
- Canonical OOXML packaging that normalizes generated metadata and ZIP-entry timestamps, producing byte-identical output for the same validated request

### Changed
- Package version **0.3.0**
- Collaborative editing disables StarterKit history and delegates undo/redo to the Yjs collaboration extension
- Common editor serialization, imperative-handle, keyboard, toolbar, and surface behavior now share one internal implementation across standalone and collaborative entrypoints

### Fixed
- Non-overwrite Office writes now use atomic link publication, closing the check-then-replace race that could overwrite a file created concurrently
- Excel strings longer than 32,767 characters are rejected instead of being silently truncated by `openpyxl`
- Large integers that would be rounded by Excel's binary64 numeric storage are rejected even when their decimal representation contains trailing zeroes
- Worksheet names beginning or ending with an apostrophe, or using Excel's reserved `History` name, are rejected before rendering

### Tests
- Collaboration tests cover rich-text convergence, concurrent changes, shared undo, tables, inline images, awareness validation and removal, accessible status updates, runtime source-of-truth guards, image-error forwarding, and host lifecycle ownership
- 82 Python tests re-open all generated Office formats and exercise deterministic packaging, validation, storage limits, atomic publication, CLI, and module entrypoints on minimum Python 3.11 and current stable Python 3.14
- 100% statement/branch/function/line coverage remains required for the TypeScript package; 100% statement/branch and shipped-symbol docstring coverage are required for Office
- Hash-locked binary dependencies protect the Office CI jobs from unreviewed package changes
- Wheel packaging gate verifies that the JSON Schema and MIT license ship with the package

## [0.2.1] — 2026-07-31

### Added
- **`CwlEditorHandle.insertValue`** — insert Markdown/HTML at the cursor (AI/snippet path); fires `onChange` and does not wipe the document
- **Table toolbar** — delete column and delete row (enabled only inside a table)

### Tests
- Drop-path `onImageError`, `insertValue` markdown+html, table delete row/column

## [0.2.0] — 2026-07-31

Commercial host-integration release: a buyer embedding the editor can control it, surface image failures, edit tables, and emit email-ready HTML without forking.

### Added
- **`CwlEditorHandle`** via `ref` — `getValue` / `getHTML` / `getMarkdown` / `setValue` / `clear` / `focus` / `blur` / `isEmpty` / `getEditor`
- **`onImageError`** — size-guard and decode failures are reported to the host (no silent swallow on the commercial path)
- **Table editing toolbar** — add column after, add row after, delete table (enabled only when the cursor is in a table)
- **Horizontal rule** toolbar control
- **Live toolbar state** — re-renders on TipTap `transaction` / `selectionUpdate` so active/disabled UI stays correct
- **`markdownToEmailHtml`** — Markdown → email body HTML (fragment or full document), preserving inline base64 images for compose→send

### Fixed
- **`onImageError` paste/drop path** — previously only toolbar file-picker failures reached the host; paste/drop size-guard failures were silently dropped because `buildExtensions` never forwarded `onError` to `Base64Image`. Wired via a live ref so hosts can attach the handler after mount (including `hideToolbar`).

### Changed
- Package version **0.2.0**
- README documents the imperative handle, `onImageError`, table ops, and email helper
- README submodule URL corrected to `ContextualWisdomLab/inkspan`

### Tests
- 116 real vitest cases driving shipped modules (handle, image errors including paste path, table ops, email HTML)

## [0.1.0] — prior

Initial public surface: Markdown/HTML modes, base64 inline images, standalone converter, bundled Noto Sans fonts, ship gates.
