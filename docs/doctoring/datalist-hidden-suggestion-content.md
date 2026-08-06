# Doctoring record: hidden datalist suggestion content

- **Status:** Accepted
- **Decision date:** 2026-08-06
- **Scope:** SafeClipboard semantic reconstruction
- **Runtime change:** Drop complete `datalist` subtrees from rich clipboard HTML

## Problem

SafeClipboard unwraps unknown elements so ordinary semantic text is not lost only
because Inkspan does not preserve a source wrapper. That general rule is unsafe
for `datalist`. The HTML Living Standard defines `datalist` as a suggestion
source for another form control and states that, in rendering, the element
represents nothing and it and its children should be hidden. The standard also
allows fallback descendants for down-level clients that do not support
`datalist`.

Removing only the wrapper therefore creates a deterministic visibility expansion:
suggestion labels or legacy fallback content that a current conforming browser
does not render as ordinary page prose can become visible editor text. Clipboard
input is untrusted, so that hidden region can contain confidential, misleading,
or workflow-inappropriate content.

## Decision

Drop the complete `datalist` subtree before semantic reconstruction. This removes
its `option` suggestions and any down-level fallback descendants together.
Inkspan does not preserve the linked form control, `list` relationship, suggestion
semantics, or legacy-client context needed to create an equivalent accessible
conversion. It must not invent ordinary prose from those hidden descendants.

The decision is provider-neutral and applies identically to standalone and Yjs
collaborative editors through the shared SafeClipboard extension. It introduces
no network, storage, credential, model, database, transport, authorization,
tenancy, migration, retention, or host-policy behavior.

## Test-first evidence

- RED `a48d81eac541effea5d7742a47c0ca6bd01d04ed` added a mixed fragment containing
  visible paragraph text, direct `datalist` fallback text, and an `option` label.
  Exact-head CI run `31055341495` failed as intended because the direct fallback
  text was promoted into the sanitized fragment. Security Scan `31055341447` and
  SAST Semgrep `31055341617` succeeded on the same head.
- GREEN `ec5d602bcf4f8e82fcc3136a82e354816913f6df` added `datalist` to the complete-
  subtree denylist without changing ordinary paragraph preservation.
- The permanent regression proves visible neighboring content remains while the
  fallback text, option text, `datalist`, and `option` are absent.

Repository-wide exact-head TypeScript, 100% production statement/branch/function/
line coverage, package-consumer, SSR, Office, security, SAST, automated review,
independent approval, and branch-protection gates remain authoritative.

## Claim boundary and residual risk

This change preserves the current-browser rendered visibility boundary for one
specified element. It does not claim that jsdom has parser, rendering, CSS, or
serialization parity with Chromium, Firefox, and WebKit. The version-pinned
cross-engine differential corpus remains a release-acceptance gate for 0.6.0.

Dropping the subtree can discard content intended for legacy clients. That loss
is intentional because Inkspan cannot preserve the source form relationship or
prove which client context the author intended. A trusted format-specific import
may implement an independently reviewed accessible conversion before content
reaches the untrusted clipboard boundary.

## Rollback

Revert the source, regression, operator guidance, changelog evidence, and this
record together. Do not restore generic unwrapping for `datalist` without a
reviewed conversion that preserves equivalent suggestion and accessibility
semantics across supported engines.

## References — APA 7th edition

WHATWG. (2026, July 15). *HTML Living Standard: The datalist element*. https://html.spec.whatwg.org/multipage/form-elements.html#the-datalist-element

WHATWG. (2026, July 15). *HTML Living Standard: The input element*. https://html.spec.whatwg.org/multipage/input.html
