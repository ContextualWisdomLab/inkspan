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
Hard-coded black/white colors or globally opting out of forced colors were rejected
because they can conflict with the user's selected palette. Text identity and
structural cues distinguish placeholders/quotes without borrowing disabled state.

## Follow-up finding: selected labels disappear

The nine-case prebuilt source-browser run at
`83783803d76c47694f4022ac7cb760f5e83815bf` passed its semantic and geometry
assertions, but direct screenshot inspection found Chromium's real pressed
Bold button blank. The smaller fixture also showed blank active/remote labels.
This visual failure prevents UI acceptance despite the passing test count.

At diagnostic head `a9f2775669a5346132ed5f4994dbb6e13e898271`, the real
button's initial foreground and background both computed to white during its
120 ms color transition. After animation completion, the background used the
system highlight color but a white text backplate still obscured the label.
The strengthened contract at `f6dbf5257a47b7ee05747306e924914292616348`
failed four stylesheet checks and all three selected real-engine cases.

Disabling only toolbar transitions at
`7f6edc7770104cdbd9d7e09aface53f9bbb26b92` removed the interpolated white
background but retained the blank Chromium label. Its screenshot, paint values
and failed check are preserved as an incomplete alternative, not a fix.

The repair retains that forced-mode-only transition removal and sets
`forced-color-adjust: none` only on the three existing system-highlight pairs:
hovered buttons, active buttons and collaboration cursor labels. Each still uses
the user's `Highlight` and `HighlightText`; none uses a hard-coded palette.
The editor, document text and generic controls retain automatic adjustment.
This narrow override corrects the observed backplate conflict under the CSS
Color Adjustment guidance; a whole-editor opt-out would be unnecessarily broad.

The actual collaboration renderer also supplies inline foreground/background
colors. At `0c29f3fed7c12a18ad032eb73273af99d7e5788a`, using that renderer
instead of hand-written cursor markup exposed another three-engine failure:
the narrow adjustment exception retained the author's colors. The two system
color declarations therefore use `!important` inside the forced-colors layer
to override those normal inline values. The browser fixture imports the selected
source or packaged collaboration entrypoint lazily, verifies its normal colors,
then requires the forced label to match the active system-highlight pair.
This does not change the renderer, its sanitization, or normal-mode colors.

Regression evidence must include immediate and settled selected-label screenshots,
hovered labels, keyboard focus and disabled-state cues. CSS/computed-style checks
alone cannot prove painted text is readable. The diagnostic prebuilt configuration
keeps normal test/assertion/startup deadlines, retries and browser projects but
runs the build separately after the standard command exceeded its startup limit.
It is not a passing standard startup run, packed-release proof or a latency claim.

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

World Wide Web Consortium. (2025, December 16). *CSS Color Adjustment Module
Level 1* (Candidate Recommendation Snapshot, Section 3.2).
https://www.w3.org/TR/2025/CR-css-color-adjust-1-20251216/#forced-color-adjust-prop
