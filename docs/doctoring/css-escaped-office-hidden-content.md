# Doctoring addendum: CSS-escaped Office hidden content

- **Status:** Accepted
- **Decision date:** 2026-08-05
- **Parent record:** `safe-rich-clipboard.md`
- **Scope:** Recognition of CSS-escaped `mso-hide: all` declarations in bounded clipboard HTML

## Problem

The first raw-style parser handled case, whitespace, comments, and terminal
`!important`, but compared the proprietary property and keyword before decoding
CSS escape sequences. CSS Syntax Level 3 permits escaped code points inside
identifiers. Therefore an Office-compatible declaration such as
`mso-\68 ide: \61ll` could be semantically equivalent to `mso-hide: all` while
avoiding the exact raw comparison. Because Inkspan removes the source style
attribute, failing to recognize that declaration would convert hidden clipboard
content into visible editor text rather than preserving the source's hidden
state or dropping it.

## Decision

Decode only the bounded CSS escape grammar needed for exact property and keyword
comparison before testing for `mso-hide` and `all`.

The decoder:

- accepts a simple escape of one non-newline code point;
- accepts one through six hexadecimal digits and consumes at most one following
  CSS whitespace code point;
- rejects null, surrogate, and code points above U+10FFFF;
- rejects trailing escapes and escaped newlines; and
- never repairs an invalid escape into a hidden-content match.

After decoding, the property and value are compared case-insensitively against
the exact strings `mso-hide` and `all`. Other properties and values, including
escaped `alligator`, remain visible. No decoded source style is copied into the
output fragment.

## Security and performance consequences

This closes a hidden-data disclosure path without adding a CSS parser, runtime
dependency, network operation, credential, provider, storage adapter, or database
object. Work remains linear in the already bounded inline-style length. The
helper allocates one decoded string per tested property or value and reads at
most six hexadecimal digits for each escape.

The decoder is intentionally narrower than a complete CSS declaration parser.
Cross-engine differential browser fixtures remain required before the 0.6.0
publication claim, especially for malformed declarations, tokenizer recovery,
and proprietary Office rendering behavior.

## Verification

Deterministic regressions cover ordinary, case-varied, commented, hexadecimal,
simple, and six-digit escaped hidden declarations. They also cover escaped
`alligator`, prefixed properties, null, surrogate, out-of-range, trailing, and
newline escapes so false positives and invalid repair remain fail-closed.

Repository-wide exact-head TypeScript, 100% production statement/branch/function/
line coverage, package, Office, security, review, and release gates remain
authoritative.

## APA 7 reference

CSS Working Group. (2021, December 24). *CSS Syntax Module Level 3* (W3C
Candidate Recommendation Draft). World Wide Web Consortium.
https://www.w3.org/TR/2021/CRD-css-syntax-3-20211224/
