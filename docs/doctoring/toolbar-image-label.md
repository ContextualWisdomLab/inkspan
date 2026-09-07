# Readable image action

Status: Active PR / Proposed (#158)

## Observation and decision

Visual inspection of the actual editor at `8f9ccf46082086eeac09089b3bbb5e8a6b3e1c9f`
showed Firefox rendering the image action as a missing-glyph box. Chromium and
WebKit rendered the emoji. A passing shortcut assertion did not detect this.

Use the visible word `Image` in the existing button. Its accessible name remains
`Insert inline image`, containing the visible label. Preserve native file
selection, keyboard navigation, existing colors, focus and upload guards.
No new icon library, font download, SVG abstraction or action is needed.

## Design contract

- Job and action: an author selects a local image to insert into the document.
- Hierarchy: keep the image action in its existing group beside table and alt-text controls.
- Visual language: existing compact button, type, spacing and semantic colors; no new tokens.
- States: readable normal, focused and forced-color text; readonly hides the toolbar.
- Responsive behavior: inherit #151 wrapping at narrow widths; the wider label must not clip.
- Evidence: actual three-engine screenshots, existing Toolbar source, and W3C label-in-name guidance.
- Reference limit: UIZZE's public landing page yielded no relevant editor-screen references; no external layout was copied.
- Acceptance: exact-head unit checks plus actual desktop/narrow browser screenshots and unchanged file-picker behavior. Pending results are not completion.

The alternative emoji variation selector still depends on font glyph availability.
A custom icon introduces drawing and forced-color maintenance for a word the
existing component already supports. Neither addresses this observation more
directly than visible text. This does not claim complete localization, WCAG
certification, or that other toolbar symbols work on every operating system.

The RED check at `697868a3` failed because the button still contained the emoji.
Subsequent results belong to their exact source head and are recorded in PR #158.

## Reference

World Wide Web Consortium. (n.d.). *Understanding Success Criterion 2.5.3: Label in name.*
https://www.w3.org/WAI/WCAG22/Understanding/label-in-name.html
