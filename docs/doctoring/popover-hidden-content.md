# Doctoring record: hidden popover clipboard content

## Decision

Inkspan drops the complete subtree of every element that carries a `popover`
content attribute during rich clipboard HTML reconstruction. The element and all
descendants are omitted before ProseMirror parses the sanitized fragment.

This decision applies only to the bounded untrusted clipboard-ingress surface.
It does not change host rendering policy, authorization, tenant isolation,
persistence, collaboration transport, model use, retention, or audit policy.

## Standards rationale

The WHATWG HTML Living Standard defines `popover` as a global enumerated
attribute. When the attribute is specified, the element is not rendered until it
becomes shown. The empty value defaults to the Auto state, recognized keywords
include `auto`, `manual`, and `hint`, and an invalid value defaults to the Manual
state. Each element also has a separate runtime popover visibility state that is
initially hidden and can later become showing.

Static clipboard HTML retains the content attribute but does not carry that
runtime visibility state. Therefore, Inkspan cannot prove from the serialized
fragment that a popover subtree was visible when copied. Unwrapping the element
while discarding its attribute would promote content that is hidden by default
into ordinary visible editor prose. Dropping the subtree is the deterministic,
fail-closed conversion that avoids inventing visibility evidence.

This is an Inkspan security-policy inference grounded in the standard's
attribute and runtime-state model. It is not a claim that every clipboard source
serializes popovers identically or that jsdom implements the complete Popover
API.

## Implementation boundary

`isHiddenClipboardElement()` checks for the presence of the `popover` content
attribute before CSSOM or raw-style checks. The value is intentionally not
whitelisted:

- an empty attribute is an Auto popover;
- `auto`, `manual`, and `hint` are defined popover states; and
- an unrecognized value uses the standard's invalid-value default, Manual.

The complete subtree is dropped. Inkspan does not copy the attribute, attempt to
reconstruct top-layer state, evaluate invoker relationships, execute script, or
call `showPopover()`. Ordinary elements without the attribute continue through
the existing semantic allowlist.

## Test-first evidence

The regression was introduced before the production repair:

- RED commit `d69575ead51f734de974c459aa2b5e710bb3e134` added default,
  `auto`, `manual`, and `hint` popover cases and failed exact-head CI because all
  hidden descendants were promoted into visible output;
- GREEN commit `ee14bdb6a9c651d8921a5aa425081aad241d2f49` added the
  attribute-presence hidden-subtree boundary and made those cases pass; and
- commit `0af1410af60489bd282e97619ea0ff482573380a` added an
  unrecognized-value case to prove the invalid-value default is also removed.

Repository acceptance still requires exact-current-head TypeScript, 100%
production statement/branch/function/line coverage, packaging, security, SAST,
automated review, independent approval, and branch-protection evidence.

## Security and privacy effect

The policy prevents default-hidden popover text from being silently converted
into visible editor content after the runtime state and attribute are lost. This
reduces accidental disclosure, misleading semantic review, and source-to-editor
rendering drift. It does not authorize the remaining content or make it safe for
another output context; SafeLink, image, schema, host authorization, persistence,
and downstream rendering controls remain separate.

No clipboard content, attribute value, tenant identifier, credential, or parser
exception is added to telemetry. Rejections continue to use bounded, redacted
error categories.

## Compatibility and assurance boundary

The deterministic regression runs in jsdom and proves Inkspan's own
attribute-presence policy. It is not Chromium, Firefox, or WebKit conformance
evidence. A version-pinned cross-engine differential corpus remains a
release-acceptance gate before publication of the default behavior in version
0.6.0.

The fail-closed policy can discard content from a popover that was showing at the
moment a user copied it because static HTML does not preserve that runtime fact.
A trusted host that owns richer provenance may convert a verified visible
popover to ordinary semantic content before it reaches the untrusted clipboard
boundary.

## Rollback

Rollback must remove the `popover` attribute boundary, its regression, this
record, operator guidance, documentation contract, and changelog entry as one
change. It must not weaken the existing `hidden`, `aria-hidden`, CSS hidden,
closed-dialog, closed-details, Office hidden-content, or content-containment
boundaries. Rollback requires the same exact-head review, coverage, security,
packaging, and independent-approval gates as the original change.

## References (APA 7th edition)

WHATWG. (2026, July 20). *HTML Living Standard: The popover attribute*.
https://html.spec.whatwg.org/multipage/popover.html

WHATWG. (n.d.). *HTML Living Standard: The popover attribute*. Retrieved August
6, 2026, from https://html.spec.whatwg.org/multipage/popover.html
