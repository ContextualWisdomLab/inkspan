# Storybook inventory

Status: Active PR / Proposed

Run `pnpm storybook` to preview repeating Inkspan chrome before you override tokens in a host. Each story uses the shipped `.cwl-*` classes so a token change is visible on the same objects buyers see.

| Story | Repeating object | Host next action |
| --- | --- | --- |
| `Editor Chrome / Toolbar Button States` | `.cwl-tb-btn` default and `is-active` | Override `--cwl-accent` and `--cwl-accent-soft` on `.cwl-editor` after checking WCAG 2.2 contrast |
| `Editor Chrome / Theme Tokens` | Color, radius, and font tokens | Copy `toDesignTokenFormatGroup()` into a host theme file; do not edit Inkspan internals |

Storybook is a development preview. It does not authorize documents, persist content, or replace packed-package evidence.
