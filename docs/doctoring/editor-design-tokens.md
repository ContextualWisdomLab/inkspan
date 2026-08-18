# Doctoring record: editor chrome design tokens

**Date:** 2026-08-16  
**Status:** Active PR / Proposed  
**Decision owner:** ContextualWisdomLab  
**Scope:** Named `--cwl-*` theme tokens, DTCG 2025.10 interchange snapshot, and Storybook inventory for repeating toolbar/editor objects.

## Buyer-visible gap

Hosts embed Inkspan and need to match brand color, radius, and font without forking `src/styles.css`. The protected stylesheet already uses `--cwl-*` custom properties, but buyers have no protected-main typed catalog, interchange snapshot, or Storybook inventory of the repeating toolbar button and editor chrome. Theme work therefore still requires reading CSS internals until this active PR integrates.

The same inventory exposed an Inkspan-owned protected-main default-theme defect rather than a host-only customization problem: dark `.cwl-tb-btn.is-active` renders `--cwl-accent` text on `--cwl-accent-soft` at about 4.13:1, below the WCAG 2.2 4.5:1 threshold for normal text. This Active PR now carries dark `--cwl-accent: #58a6ff` against unchanged `--cwl-accent-soft: #163356`, producing about 5.06:1 for the active toolbar pair. That repaired value is active-PR evidence, not shipped protected-main truth, until integration. Host overrides must still re-check their own resulting pairs.

If contrast fails after a re-theme, override only the named tokens on `.cwl-editor` and re-check WCAG 2.2 text contrast for `--cwl-fg` on `--cwl-bg` and `--cwl-accent` on `--cwl-accent-soft`. `getEditorThemeTokenContrast()` reports Inkspan's catalog baseline only; after a host override, pass the actual resolved pair to `contrastRatioFromHex(actualForegroundHex, actualBackgroundHex)` before shipping. Do not disable forced-colors overrides.

## Decision

If integrated:

1. Keep `src/styles.css` as runtime presentation authority.
2. Publish `listEditorThemeTokens()` / `getEditorThemeToken()` / `getEditorThemeTokenContrast()` / `contrastRatioFromHex()` / `toDesignTokenFormatGroup()` as host-facing theme evidence: the name-based contrast helper evaluates the catalog baseline, while the hex helper evaluates actual resolved host colors.
3. Keep the catalog light/dark/print values synchronized with the stylesheet and require the inventoried active-toolbar text pair to meet the WCAG 2.2 4.5:1 threshold in Inkspan's own default themes.
4. Reject unknown token names with a stable payload-redacted `EditorThemeTokenError`.
5. Preview repeating `.cwl-tb-btn` states, the shipped Toolbar component, and token swatches in Storybook.
6. Add no network, persistence, credential, model, tenant, Figma, or design-tool sync authority.

## Standards rationale

The Design Tokens Format Module 2025.10 defines a vendor-neutral JSON interchange for token groups, `$type`, and `$value` (Design Tokens Community Group, 2025). This active PR emits a snapshot of Inkspan CSS custom properties in that shape. The report is a W3C Community Final Specification, not a W3C Standard, so this record does not claim W3C standardization or complete DTCG conformance.

WCAG 2.2 requires at least 4.5:1 contrast for normal text under Success Criterion 1.4.3 and at least 3:1 for meaningful user-interface component boundaries/states under Success Criterion 1.4.11 (World Wide Web Consortium, 2024). The protected-main failing default is therefore an Inkspan-owned defect; this active PR repairs it at Inkspan's presentation boundary while host overrides remain the host's contrast responsibility. Storybook's React/Vite preview is the proposed inventory surface for repeating chrome (Storybook, n.d.).

## Test-first evidence

- Original RED: `src/designTokens.test.ts` failed because `./designTokens.js` did not exist.
- Initial GREEN: the active-PR catalog lists nine inventoried tokens, aligns light/dark/print color values with the matching `src/styles.css` media blocks, reports WCAG 2.2 contrast for inventoried color pairs, rejects unknown names without reflecting caller input, and emits a DTCG 2025.10 group.
- Accessibility RED: exact test-only head `a831359d1509811ab8777e7356f6ebd5f251b5cf` changed the active-chrome contract to require the dark `--cwl-accent` / `--cwl-accent-soft` pair to meet 4.5:1. The protected-main values remained `#4493f8` on `#163356` (about 4.13:1), so the new expectation could not pass without a real default-theme change.
- Accessibility GREEN: the active-PR dark `--cwl-accent` is `#58a6ff` in both the typed catalog and runtime stylesheet; against unchanged `#163356` it measures about 5.06:1 and `meetsTextContrast` is true.
- Override-truth RED: exact-head CI `32149806678` / build-test `95752733876` proved the documentation and API action text still conflated catalog-token contrast with resolved host override contrast.
- Override-truth repair: `getEditorThemeTokenContrast()` is explicitly catalog-only and custom host themes are checked with `contrastRatioFromHex()` using the actual resolved colors.

## Residual risk

Print media still remaps the color tokens after a host override. Forced-colors mode only restyles the toolbar focus outline to `CanvasText`; it does not assign `--cwl-*` values. The active-PR repaired dark `.cwl-tb-btn.is-active` pair (`--cwl-accent` on `--cwl-accent-soft`) meets the WCAG 2.2 4.5:1 normal-text threshold and also exceeds the 3:1 non-text threshold; protected main remains at the failing pre-repair pair until integration. `getEditorThemeTokenContrast()` reports only that catalog evidence; after overriding either token, hosts must call `contrastRatioFromHex(actualForegroundHex, actualBackgroundHex)` with the actual resolved values because custom values can reintroduce a contrast failure. The font token snapshot splits a CSS font-family list and does not execute CSS. Storybook success is not Chromium/Firefox/WebKit release evidence.

## Rollback

Rollback before integration removes the catalog export, this record, the operator guide, the Storybook inventory/config/stories, ADR 0031, the changelog entry, and the documentation-index rows together. After integration, reverting the compliant dark accent without also reverting the active-pair contrast contract would deliberately recreate a known accessibility defect and is not a valid partial rollback.

## References (APA 7th edition)

Design Tokens Community Group. (2025, October 28). *Design Tokens Format Module 2025.10* (Final Community Group Report). World Wide Web Consortium. https://www.w3.org/community/reports/design-tokens/CG-FINAL-format-20251028/

Storybook. (n.d.). *Storybook for React with Vite*. Retrieved August 16, 2026, from https://storybook.js.org/docs/get-started/frameworks/react-vite

World Wide Web Consortium. (2024, December 12). *Web Content Accessibility Guidelines (WCAG) 2.2* (W3C Recommendation). https://www.w3.org/TR/WCAG22/
