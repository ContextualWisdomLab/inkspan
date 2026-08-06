# Doctoring record: `content-visibility: hidden` clipboard content

## Decision

Inkspan treats an exact decoded inline declaration of
`content-visibility: hidden` as a complete hidden-subtree boundary during rich
clipboard HTML reconstruction. The element and all descendants are omitted
before ProseMirror parses the sanitized fragment.

This decision applies only to the bounded untrusted clipboard-ingress surface.
It does not change host rendering policy, Content Security Policy, persistence,
authorization, collaboration transport, model use, or tenant governance.

## Standards rationale

CSS Containment Module Level 2 defines `content-visibility` with the values
`visible`, `auto`, and `hidden`. For `hidden`, the element skips its contents;
the specification states that skipped contents must not be available to
user-agent features such as find-in-page and tab-order navigation, and must not
be selectable or focusable. It also explains that descendants cannot override
the ancestor and make themselves visible while the ancestor remains
`content-visibility: hidden`.

Unwrapping such an element while discarding its source `style` attribute would
therefore change source-only descendants into ordinary visible editor prose. A
complete subtree drop is the narrow deterministic conversion that preserves the
source's hidden-content intent without attempting to reproduce browser layout
or containment state inside the editor schema.

The cited W3C document is a Working Draft and is work in progress. This record
uses it as the current primary specification for the property, not as evidence
that Inkspan or any deployed host conforms to the complete specification.

## Implementation boundary

The sanitizer reads the bounded raw `style` attribute rather than relying on
engine-specific CSSOM exposure. It removes closed CSS comments and a final
comment that runs to end of input, decodes bounded CSS escape sequences, trims
ordinary whitespace, strips one terminal `!important`, and compares the decoded
property and value case-insensitively.

A subtree is removed only when both comparisons are exact:

- property: `content-visibility`;
- value: `hidden`.

Supported equivalent forms include case and whitespace variation, comments
inside the property or keyword, and bounded CSS escapes. Values `visible`,
`auto`, and `hiddenly`, and property names such as `not-content-visibility`, do
not match. Invalid null, surrogate, out-of-range, trailing, or newline escapes
also do not match. The original `style` attribute is never copied to output.

The same parser retains the existing exact `mso-hide: all` boundary, preventing
two competing hidden-style parsers from drifting.

## Test-first evidence

The regression was introduced before the production repair:

- RED commit `3e369cb33c1716fc2795493747b28d2b8b7a7648` added ordinary, case,
  whitespace, terminal `!important`, CSS-comment, CSS-escaped, and false-positive
  cases;
- GREEN commit `28df0b99de3eeeacb7a3d696b834de0e832c2f13` generalized the bounded
  raw-style hidden-declaration parser and made the regression pass.

The deterministic test asserts that the four supported hidden forms contribute
no text while `visible`, `auto`, `hiddenly`, and prefixed-property controls remain
visible. Repository acceptance still requires exact-current-head TypeScript,
100% production statement/branch/function/line coverage, packaging, security,
SAST, automated review, independent approval, and branch-protection evidence.

## Security and privacy effect

Dropping the subtree prevents source-only or deliberately suppressed text from
being promoted into visible editor content after the source style is discarded.
This reduces accidental disclosure, misleading review output, and semantic
changes in copied material. It does not authorize the remaining content or make
it safe for a different output context; SafeLink, image, schema, host
authorization, persistence, and downstream rendering controls remain separate.

No clipboard content, declaration value, tenant identifier, credential, or
parser exception is added to telemetry. Rejections continue to use bounded,
redacted error categories.

## Compatibility and assurance boundary

The repository regression runs in jsdom and proves Inkspan's own raw-declaration
parser and reconstruction policy. It is not browser-conformance evidence. A
Cross-engine Chromium, Firefox, and WebKit differential corpus remains a
release-acceptance gate before publication of the default behavior in version
0.6.0.

The policy intentionally does not drop `content-visibility: auto`. That value
can skip rendering based on relevance while retaining availability to user-agent
features, so treating it as always hidden would create false-positive data loss.

## Rollback

Rollback must remove the `content-visibility: hidden` matcher, its regression,
this record, operator guidance, documentation contract, and changelog entry as
one change. It must not weaken the existing `mso-hide: all`, `display: none`,
`visibility: hidden`, `visibility: collapse`, HTML `hidden`, or
`aria-hidden="true"` boundaries. Rollback requires the same exact-head review,
coverage, security, packaging, and independent-approval gates as the original
change.

## References (APA 7th edition)

World Wide Web Consortium. (2022, September 17). *CSS Containment Module Level
2* (W3C Working Draft). https://www.w3.org/TR/2022/WD-css-contain-2-20220917/

World Wide Web Consortium. (n.d.). *CSS Containment Module Level 2: Latest
published version*. Retrieved August 6, 2026, from
https://www.w3.org/TR/css-contain-2/
