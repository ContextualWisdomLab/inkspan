# Doctoring record: narrow toolbar control visibility

Date: 2026-09-06  
Status: Active PR / Proposed  
Owner: Inkspan presentation, existing PR #151

## User-visible failure and causal evidence

At 320 CSS pixels, authors could see only part of the image insertion button and could not see the image alternative-text button. The page itself had no horizontal overflow: its scroll width and viewport width both measured 320. The editor's clipping concealed overflow inside the toolbar, so page-width checks and the smaller forced-colors chrome fixture had passed without proving that all real controls were accessible.

The actual public editor is mounted by `tests/browser/input-harness.ts`. `Toolbar` in `src/components/Toolbar.tsx` renders the affected controls in one group; `src/styles.css` allowed the outer toolbar to wrap groups but did not allow a group to wrap its controls. The group's minimum content width exceeded the available space. This is an Inkspan presentation defect, separate from the reference host's previously repaired control-style leakage.

The test-only baseline `4bc3c8fab0c697dba0576686325cf09fe61242b3` adds full-button bounds checks to `tests/browser/specs/forced-colors.browser.spec.ts`. Each of Chromium, Firefox and WebKit reported the same two clipped controls in both normal and forced colors: 12 clipped-control observations across six independent engine/mode cases. The initial incorrectly named test locator failed before reaching geometry and is not counted as product evidence. Screenshots are captured before the assertion so failing states remain inspectable.

## Choice and alternatives

Allow the existing group to wrap with `flex-wrap: wrap`. It adds no JavaScript, dependency, breakpoint, observer or alternative navigation. It preserves every command, the existing control sizes, DOM order, keyboard behavior, theme tokens and host boundary. A narrow group may occupy additional vertical space.

Keeping the page-width-only check was rejected because it reproduced a false pass. Removing clipping from the editor was rejected because controls would escape their surface. Hiding commands or shrinking their targets would trade away functionality or accessibility. A horizontally scrolling group could preserve access, but adds a separate navigation action when native wrapping can keep every control visible. No new layout framework or component abstraction is needed.

## Verification and limits

Run the actual-control regression across the three configured engines:

```sh
pnpm --dir tests/browser exec playwright test specs/forced-colors.browser.spec.ts --grep 'keeps every real toolbar control'
```

The optimization metric is the total count of clipped controls across all six engine/mode cases; lower is better, and acceptance requires zero. Keep existing keyboard, touch, composition, print, package, production-coverage and Office checks. Inspect the screenshots as well as geometry. A successful source-harness run is not installed-tarball identity, physical-device/OS high-contrast evidence, general WCAG certification or a performance result. Final exact-head results and artifact identities belong in dated PR evidence, not protected-main claims.

The PRD accessibility requirement, TRD interaction boundary and product-technical gap baseline link this record. CONTRACTS remains unchanged because no public API, document/evidence schema, callback behavior or host ownership moves. The candidate must retain normal protected review and parent-before-child integration; local success does not ship the change. Before integration, a rejected experiment is reversed with an ordinary inverse change while retaining its evidence, never by hiding controls or weakening the visibility check.

## Standards basis

WCAG's Reflow guidance describes preserving information and functionality at a 320 CSS-pixel width and acknowledges exceptions for content that needs a two-dimensional layout. Inkspan does not need to use that exception to hide these controls: wrapping can preserve their availability. This record uses the guidance to choose and test a repair, not to claim whole-product conformance.

World Wide Web Consortium. (n.d.). *Understanding Success Criterion 1.4.10: Reflow*. Web Accessibility Initiative. Retrieved September 6, 2026, from https://www.w3.org/WAI/WCAG22/Understanding/reflow.html
