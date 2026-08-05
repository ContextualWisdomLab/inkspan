# Closed interactive clipboard content

## Status

Implemented for the unreleased SafeClipboard boundary. Publication remains gated
on exact-current-head CI, security scanning, independent review, branch
protection, and the separately documented cross-engine corpus for 0.6.0.

## Problem statement

A rich clipboard payload can contain HTML whose source text is not visible in the
source document. Before this repair, Inkspan unwrapped unsupported interactive
containers and traversed every child. That behavior made the additional content
of a closed `details` element and the complete contents of a closed `dialog`
visible as ordinary editor text.

This was a deterministic confidentiality and semantic-integrity defect. The
source markup did not grant the hidden text authority to become visible merely
because the target editor does not preserve the interactive wrapper.

## Primary normative evidence

The WHATWG HTML Living Standard defines the first `summary` element child as the
summary for a `details` element and the remaining contents as additional
information. Presence of the boolean `open` attribute means both the summary and
the additional information are shown. It also states that a `dialog` element
without an `open` attribute should not be shown to the user.

Those rendering semantics are part of the sanitizer's hidden-content boundary.
Inkspan does not copy either interactive element or any of its attributes; it
uses only the source element name, the presence of `open`, and the first summary
child to decide which source subtree was rendered.

## Decision

SafeClipboard applies these deterministic rules before ordinary allowlist
reconstruction:

1. A closed `dialog` contributes no subtree.
2. An open `dialog` is unwrapped and its children are sanitized normally.
3. A closed `details` contributes only its first `summary` element child, when
   present; that summary is itself processed through all ordinary hidden,
   active-content, link, style, depth, and node rules.
4. A closed `details` without a summary contributes no source text. Inkspan does
   not invent a user-agent fallback label.
5. An open `details` is unwrapped and all children are sanitized normally.
6. The `details`, `summary`, and `dialog` wrappers and all source attributes are
   absent from output.

The implementation remains iterative. Skipped hidden subtrees are not traversed,
which avoids work on content that cannot enter output; the original UTF-8 byte
limit still bounds the complete source payload.

## Test-first evidence

- RED commit `eebf18a623b7702e55995c4d406fe07203edfd39` added a realistic closed/open
  `details` and `dialog` regression.
- Exact-head CI run `31042227181` failed only the new disclosure test and showed
  closed details, summaryless details, and closed dialog text leaking into the
  sanitized fragment.
- GREEN implementation commit `e84261e74dcb07ed6afec9a934adcf5b8b1e41e3`
  added state-aware iterative traversal without introducing a dependency,
  network call, storage surface, credential, database object, model call, or
  host-policy responsibility.

Final acceptance evidence must be anchored to the current pull-request head, not
to either historical TDD commit.

## Security and accessibility considerations

Preserving the first summary of a closed disclosure retains the label that the
source exposed while preventing hidden supplementary information from becoming
visible. Dropping source-only dialog content avoids disclosure of text that the
source document did not show. Open variants retain their rendered content but
lose interactive semantics because Inkspan's deterministic document schema does
not claim to preserve those widgets.

Hosts that need live disclosure or dialog controls must create authorized target
widgets outside this clipboard conversion boundary. They must not infer control
authority, dialog modality, focus management, or event behavior from pasted
markup.

## Uncertainty boundary

The repository regression runs in jsdom. It proves Inkspan's own reconstruction
rules, but it is not represented as Chromium, Firefox, or WebKit conformance.
The 0.6.0 release gate still requires version-pinned cross-engine differential
fixtures for accepted and rejected clipboard cases.

## Rollback

Rollback is the removal of the state-aware branches and their tests, docs, and
changelog entry. Such a rollback reopens the hidden-text exposure and therefore
requires an explicit security decision; silently restoring unconditional
unwrapping is not acceptable.

## References

WHATWG. (2026). *HTML Living Standard: Interactive elements*. Retrieved August
6, 2026, from https://html.spec.whatwg.org/multipage/interactive-elements.html
