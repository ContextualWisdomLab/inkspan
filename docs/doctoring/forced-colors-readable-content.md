# Doctoring record: readable content in forced colors

Date: 2026-09-06
Status: Active PR / Proposed
Owner: Inkspan presentation, existing PR #151

## Visual finding and causal check

Direct inspection of the retained three-engine, 320 CSS-pixel editor screenshots
found unusually faint empty-editor guidance in WebKit's forced-colors rendering.
The images belong to `dd1a78045807e37e32f87810564be4b1fefd56df`, not a newer
source generation. Its stylesheet blob
`265e79cc53f540cdf3de1b4ab10a4139c4444756` matches the test-only integrated
candidate `f97452a902326d76061b6c770ebf69b68e8cdca0` exactly.

The shared stylesheet assigned `GrayText` to both placeholder guidance and
blockquote content. W3C defines that system color for disabled text. Neither
an instruction in an editable document nor authored quoted text is an inactive
control. The focused regression at
`8f8ff6e3040d0fd2e436a65090bf3350f571b824` failed both content selectors while
the six existing stylesheet checks passed. That is a stylesheet-contract RED;
the earlier screenshots are retained visual evidence, not a fresh browser RED
or a measured contrast ratio.

## Minimal repair and alternatives

Change the two content declarations to the existing `CanvasText` system color.
Keep `GrayText`, full opacity and a visible border for disabled toolbar buttons.
Normal themes, controls, keyboard order, print output, accessible names, document
serialization and host ownership do not change. No dependency or abstraction is
needed. CONTRACTS and ADR ownership remain unchanged.

Keeping disabled-text colors on readable content was rejected because it gave
the wrong semantic cue and produced faint guidance in the inspected rendering.
Hard-coded black/white colors or opting out of forced colors were rejected
because they can conflict with the user's selected palette. Text identity and
structural cues distinguish placeholders/quotes without borrowing disabled state.

## Runnable verification and limits

```sh
pnpm exec vitest run src/forcedColorsStyles.test.ts
pnpm --dir tests/browser exec playwright test --config playwright.config.ts specs/forced-colors.browser.spec.ts --workers=1
```

The browser regression checks both content selectors against document text,
including the actual editor's placeholder pseudo-element at 320 CSS pixels.
Retain and inspect normal/forced-colors toolbar images, actual Tab-focus images
and the focused editor fixture. Run the complete source and extracted-package
browser suites with their own exact-head/artifact receipts; the inherited
stylesheet-provenance checks must prove the selected CSS was loaded.

A selected system palette may intentionally differ between browsers or user
preferences. Do not infer a numeric contrast ratio from screenshot appearance,
claim physical-device/OS coverage from emulation, or treat these narrow checks
as whole-product WCAG certification. Final run outcomes belong in dated PR
evidence. Failed/partial runs stay retained rather than being normalized away.

## Standards basis

World Wide Web Consortium. (2026). *CSS Color Module Level 4: CSS system colors*.
https://www.w3.org/TR/css-color-4/#css-system-colors

World Wide Web Consortium. (n.d.). *Understanding Success Criterion 1.4.3:
Contrast (Minimum)*. Web Accessibility Initiative. Retrieved September 6, 2026,
from https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html
