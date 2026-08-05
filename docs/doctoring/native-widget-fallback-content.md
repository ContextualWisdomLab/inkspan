# Doctoring record: native-widget and obsolete fallback content

- **Status:** Accepted
- **Decision date:** 2026-08-05
- **Scope:** SafeClipboard semantic reconstruction
- **Runtime change:** Drop complete `progress`, `meter`, `noframes`, and `noembed`
  subtrees from rich clipboard HTML

## Problem

SafeClipboard unwraps unknown elements so that ordinary semantic text is not lost
merely because Inkspan does not preserve a source wrapper. That general rule is
unsafe for elements whose descendant text is not the ordinary rendered surface.

Modern user agents render `progress` and `meter` as native progress and gauge
widgets derived primarily from their attributes. The HTML Standard encourages
inline descendant text for users of legacy user agents that do not support those
elements. Removing only the wrapper therefore changes the source rendering
contract: legacy fallback text that a current browser ordinarily represents as a
widget can become ordinary visible editor prose.

The same semantic-integrity problem applies to obsolete `noframes` and `noembed`
content. The HTML Standard classifies both elements as entirely obsolete, and its
expected default rendering hides their subtrees. Unwrapping them would surface
content that the source document did not ordinarily display.

Clipboard input is untrusted and may contain confidential, misleading, or
tracking-oriented text in these fallback regions. Inkspan must not invent a new
visible representation by stripping only the element boundary.

## Decision

Drop the complete subtree for:

- `progress`;
- `meter`;
- `noframes`; and
- `noembed`.

This is deliberately fail-closed. Inkspan does not preserve the widget attributes
needed to reconstruct an equivalent accessible progress or gauge representation,
and it must not infer which descendant text a source author intended current
versus legacy user agents to expose. Hosts that need a trusted business-specific
conversion can transform a known document format before it reaches the untrusted
clipboard boundary.

The change introduces no network, storage, credential, model, database,
collaboration, or host-policy behavior. It applies identically to standalone and
provider-neutral collaborative editors through the shared SafeClipboard
extension.

## Test-first evidence

- RED `6e6d48ff8a377bab875d6a520580e65d3489f78e` added a realistic mixed fragment
  and proved that the existing unknown-element unwrapping surfaced all four
  fallback texts. Exact-head CI run `31047047213` failed as intended while
  Security Scan `31047046529` and SAST Semgrep `31047045777` remained successful.
- GREEN `01683cc89faadfcacf05f358e34b6a1812e61e77` added the four elements to the
  complete-subtree denylist without changing ordinary paragraph preservation.
- The permanent regression parses the sanitized fragment, proves ordinary visible
  content remains, proves every fallback text is absent, and proves none of the
  source wrapper elements survives.

Repository-wide exact-head TypeScript, 100% production statement/branch/function/
line coverage, package-consumer, SSR, Office, security, SAST, automated review,
independent approval, and branch-protection gates remain authoritative.

## Claim boundary and residual risk

This decision prevents one deterministic source-to-editor visibility expansion.
It does not claim that jsdom has parser, rendering, CSS, or serialization parity
with Chromium, Firefox, and WebKit. The version-pinned cross-engine differential
corpus remains a release-acceptance gate for 0.6.0.

Dropping these subtrees can discard text that a legacy or specialized user agent
might expose. That loss is intentional: preserving untrusted text without the
source widget semantics would be a different and potentially misleading
representation. A future feature may add an explicitly reviewed, attribute-aware,
accessible conversion contract, but it must not weaken this default fail-closed
boundary.

## Rollback

Revert the source, regression, operator documentation, changelog, and this record
together. Do not restore generic unwrapping for these elements without a reviewed
accessible conversion that preserves equivalent semantics across supported
engines and retains the exact-head security and coverage gates.

## References — APA 7th edition

WHATWG. (2026, July 15). *HTML Living Standard: The meter element*. https://html.spec.whatwg.org/multipage/form-elements.html#the-meter-element

WHATWG. (2026, July 15). *HTML Living Standard: The progress element*. https://html.spec.whatwg.org/multipage/form-elements.html#the-progress-element

WHATWG. (2026, July 15). *HTML Living Standard: Obsolete features*. https://html.spec.whatwg.org/multipage/obsolete.html

WHATWG. (2026, July 15). *HTML Living Standard: Rendering*. https://html.spec.whatwg.org/multipage/rendering.html
