# Doctoring record: editor chrome design tokens

**Date:** 2026-08-16  
**Status:** Active PR / Proposed  
**Decision owner:** ContextualWisdomLab  
**Scope:** Named `--cwl-*` theme tokens, DTCG 2025.10 interchange snapshot, and Storybook inventory for repeating toolbar/editor objects.

## Buyer-visible gap

Hosts embed Inkspan and need to match brand color, radius, and font without forking `src/styles.css`. The stylesheet already used `--cwl-*` custom properties, but buyers had no typed catalog, no interchange snapshot, and no Storybook inventory of the repeating toolbar button and editor chrome. Theme work therefore required reading CSS internals.

If contrast fails after a re-theme, override only the named tokens on `.cwl-editor` and re-check WCAG 2.2 contrast against `--cwl-bg`. Do not disable forced-colors overrides.

## Decision

1. Keep `src/styles.css` as runtime presentation authority.
2. Publish `listEditorThemeTokens()` / `getEditorThemeToken()` / `toDesignTokenFormatGroup()` as a host-facing catalog of the nine shipped chrome tokens.
3. Reject unknown token names with a stable payload-redacted `EditorThemeTokenError`.
4. Preview repeating `.cwl-tb-btn` states, the shipped Toolbar, and token swatches in Storybook.
5. Add no network, persistence, credential, model, tenant, Figma, or design-tool sync authority.

## Standards rationale

The Design Tokens Format Module 2025.10 defines a vendor-neutral JSON interchange for token groups, `$type`, and `$value` (Design Tokens Community Group, 2025). Inkspan emits a snapshot of its CSS custom properties in that shape. The report is a W3C Community Final Specification, not a W3C Standard, so this record does not claim W3C standardization or complete DTCG conformance.

WCAG 2.2 requires sufficient contrast for text and user-interface components (World Wide Web Consortium, 2024). Host overrides remain the host's contrast responsibility. Storybook's React/Vite preview is the inventory surface for repeating chrome (Storybook, n.d.).

## Test-first evidence

- RED: `src/designTokens.test.ts` failed because `./designTokens.js` did not exist.
- GREEN: the catalog lists the nine shipped tokens, aligns light/dark/print color values with the matching `src/styles.css` media blocks, rejects unknown names without reflecting caller input, and emits a DTCG 2025.10 group.

## Residual risk

Print media still remaps the color tokens after a host override. Forced-colors mode only restyles the toolbar focus outline to `CanvasText`; it does not assign `--cwl-*` values. The font token snapshot splits a CSS font-family list and does not execute CSS. Storybook success is not Chromium/Firefox/WebKit release evidence.

## Rollback

Rollback must remove the catalog export, this record, the operator guide, the Storybook inventory/config/stories, ADR 0031, the changelog entry, and the documentation-index rows together.

## References (APA 7th edition)

Design Tokens Community Group. (2025, October 28). *Design Tokens Format Module 2025.10* (Final Community Group Report). World Wide Web Consortium. https://www.w3.org/community/reports/design-tokens/CG-FINAL-format-20251028/

Storybook. (n.d.). *Storybook for React with Vite*. Retrieved August 16, 2026, from https://storybook.js.org/docs/get-started/frameworks/react-vite

World Wide Web Consortium. (2024, December 12). *Web Content Accessibility Guidelines (WCAG) 2.2* (W3C Recommendation). https://www.w3.org/TR/WCAG22/
