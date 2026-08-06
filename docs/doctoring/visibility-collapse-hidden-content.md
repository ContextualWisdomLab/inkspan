# Visibility-collapse hidden-content boundary

**Decision date:** 2026-08-06  
**Status:** Accepted for the SafeClipboard feature branch  
**Scope:** Deterministic rich-HTML paste reconstruction only

## Decision

Inkspan treats an inline computed `visibility` value of either `hidden` or
`collapse` as a complete hidden-subtree marker during rich-clipboard
reconstruction. The sanitizer drops the marked element and every descendant
before ProseMirror parses the reconstructed fragment.

This rule applies uniformly to ordinary elements and table-internal elements.
It does not try to preserve descendants that override visibility because doing
so would require browser layout, inherited-style resolution, author style-sheet
execution, and accessibility-tree interpretation outside Inkspan's bounded,
network-free clipboard contract.

## Rationale

CSS defines `visibility: collapse` as non-rendered table row or column content,
and otherwise gives it the same invisibility meaning as `hidden`. CSS Display
Level 3 also describes invisible boxes as not rendered, not interactive, removed
from navigation, and normally absent from speech rendering. Allowing descendant
text to become ordinary editor prose after discarding the source style would
therefore reveal content the source presentation intentionally withheld and
would break deterministic browser-to-editor meaning.

The fail-closed choice is intentionally stricter than a browser layout engine:
Inkspan removes the whole source subtree rather than attempting to reconstruct
visible descendants. Hosts that need style-aware document import must use a
separate reviewed conversion pipeline and must not bypass SafeClipboard for
untrusted paste input.

## Verification

The permanent regression corpus contains collapsed table-row, table-cell, and
ordinary-element examples. It proves that hidden descendants are absent while a
visible sibling remains. The RED commit is
`77ea951c54230f896788157913a924186ae487f7`; the production repair begins at
`503ba7f74001c2bfc05bee76d154fc7b162200f3`. Exact-current-head CI, 100%
production statement and branch coverage, security scanning, SAST, automated
review, and independent approval remain mandatory merge evidence.

## Operational and compatibility boundary

- No network, credential, persistence, tenant, model, or host-policy behavior is
  introduced.
- Standalone and provider-neutral collaborative editors receive the same rule
  through the shared extension kit.
- The rule has no database object or migration impact.
- Rollback is the exact two-commit test-and-production pair; removing only the
  test is prohibited.
- Cross-engine Chromium, Firefox, and WebKit differential evidence remains a
  release gate for the broader bespoke-sanitizer conformance claim.

## References

World Wide Web Consortium. (2011, June 7). *Cascading Style Sheets Level 2
Revision 1 (CSS 2.1) specification: Visual effects*. https://www.w3.org/TR/CSS2/visufx.html

World Wide Web Consortium. (2023, December 7). *Cascading Style Sheets Level 2
Revision 2 (CSS 2.2) specification: Tables*. https://www.w3.org/TR/CSS22/tables.html

World Wide Web Consortium. (2026, June 5). *CSS Display Module Level 3*.
https://www.w3.org/TR/2026/CRD-css-display-3-20260605/
