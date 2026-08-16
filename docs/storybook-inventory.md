# Storybook inventory

Status: Active PR / Proposed

Run `pnpm storybook` to preview repeating Inkspan chrome before you override tokens in a host. The button-state story is a class-level chrome sample. **Editor Chrome / Live Toolbar** mounts the shipped Toolbar so a token change is visible on the same objects buyers ship. These stories do not mount `CwlEditor`.

| Story | Repeating object | Host next action |
| --- | --- | --- |
| `Editor Chrome / Toolbar Button States` | `.cwl-tb-btn` default, `is-active`, disabled, and `:focus-visible`, plus `.cwl-collaboration-status` and `.cwl-editor__surface` | Override `--cwl-accent` and `--cwl-accent-soft` on `.cwl-editor` after checking WCAG 2.2 contrast, including `getEditorThemeTokenContrast('cwl-accent', 'cwl-accent-soft', 'dark')` |
| `Editor Chrome / Live Toolbar` | shipped Toolbar buttons, groups, and disabled/active states | Override `--cwl-accent` and `--cwl-accent-soft` on `.cwl-editor` after checking WCAG 2.2 contrast |
| `Editor Chrome / Theme Tokens` | Color, radius, and font tokens | Copy `toDesignTokenFormatGroup()` into a host theme file; do not edit Inkspan internals |

Storybook is a development preview. It does not authorize documents, persist content, or replace packed-package evidence.
