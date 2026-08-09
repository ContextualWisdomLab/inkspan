# Doctoring record: DOM capability reflection redaction

**Date:** 2026-08-06  
**Target release:** Pending Inkspan 0.6.0  
**Decision owner:** ContextualWisdomLab  
**Scope:** The explicit or ambient `Document` capability accepted by `sanitizeRichClipboardHtml()`.

## Buyer-visible risk

Inkspan exposes a direct sanitizer API so a controlled host can provide a DOM
`Document` in browsers, SSR-adjacent test environments, and isolated conversion
surfaces. That host-supplied value crosses the same untrusted boundary as the
clipboard payload. A JavaScript accessor, revoked proxy, proxy `get` trap, or
failing DOM factory can throw while Inkspan establishes the inert parsing
capability.

Before this repair, hostile capability reads could propagate arbitrary host
exceptions and disclose private implementation, tenant, adapter, or test-fixture
text even though the public contract promises stable content-free errors.

## Test-first evidence

- RED commit `486846ae88710b87458712cf8da80eb5677cf031` added two deterministic hostile
  `Document` proxies: one throws while `createElement` is read and one throws
  while `implementation` is read.
- Exact-head CI run `31087687909` failed only at
  `SafeClipboard.domReflection.test.ts`, proving the first private exception was
  propagated instead of becoming `ClipboardSanitizationError`.
- GREEN commit `e4387658f3b3b936967fd9b0101203dbdc25c55a` moved ambient-document selection
  and capability inspection into one fail-closed boundary. Abrupt completion
  while resolving the required DOM capability becomes the stable
  `dom_unavailable` code and message.
- Later exact-head CI exposed a stale regression expectation that treated a
  throwing `createHTMLDocument()` call as malformed clipboard HTML even though
  no inert parsing document had been established. The corrected contract keeps
  inert-document establishment inside the DOM-capability boundary: property
  access and the factory invocation both fail as `dom_unavailable`; only failures
  after a usable inert document exists are classified as `invalid_html`.

Parsing and traversal remain a separate boundary. Once inert-document creation
succeeds, unexpected template parsing, reconstruction, DOM mutation, or
serialization failure becomes `invalid_html`; already classified resource-limit
errors retain their existing stable codes.

## Standards interpretation

ECMAScript defines proxy `[[Get]]` as returning either a normal completion or a
throw completion. Property access is therefore executable behavior and cannot be
assumed to be a passive shape check. The regression exercises the exact
`createElement` and `implementation` reads used by Inkspan.

The WHATWG DOM Standard defines `Document.implementation` and
`DOMImplementation.createHTMLDocument()`, but a host-provided object is not
trusted merely because TypeScript types it as `Document`. Runtime capability
validation remains necessary at the public JavaScript boundary. A callable
property is not yet a usable capability until the factory invocation succeeds
and returns the inert document required by the sanitizer.

OWASP error-handling guidance recommends generic externally observable errors
rather than exposing internal exception details. Inkspan applies that principle
locally: it does not log, transport, persist, or return the original exception;
it returns only the bounded product error category.

## Security and compatibility decision

The selected classification is `dom_unavailable` for both hostile capability
resolution and inert-document creation failure because both occur before a usable
inert parsing document has been established. This gives operators a stable
distinction between missing/unsafe DOM capability and malformed or failing HTML
processing after parsing capability exists, without revealing which property,
proxy, adapter, factory, or private exception caused rejection.

The repair does not:

- accept a previously rejected `Document` shape;
- invoke getters to extract diagnostic detail;
- fall back to unsanitized or plain HTML;
- add network, persistence, credential, tenant, model, database, or scheduler
  behavior; or
- change the standalone versus host-owned MSA responsibility boundary.

A hostile `Document` can still consume time inside a capability function after it
has been obtained. Hosts must provide a controlled DOM implementation; Inkspan's
byte, node, and depth ceilings bound clipboard traversal but cannot preempt
arbitrary host code.

## Rollback boundary

Rollback is safe only by reverting the focused implementation and regressions
together. Removing the catch while retaining the direct `Document` override would
restore exception disclosure and contradict `docs/clipboard-security.md`.
Changing the public error code requires a separately reviewed compatibility
change because hosts may use the stable code for accessible recovery or bounded
telemetry.

## Acceptance gates

- hostile `createElement`/`implementation` reads and a throwing
  `createHTMLDocument()` invocation produce `ClipboardSanitizationError` with the
  exact `dom_unavailable` code and message;
- no private exception string appears in the public error;
- malformed and absent DOM capability tests continue to pass;
- failures after successful inert-document establishment remain `invalid_html`;
- repository production statement and branch coverage remain 100%; and
- exact-head CI, security, Semgrep, review, independent approval where actually
  required, and branch protection all succeed before merge or release.

## References

Ecma International. (2026). *ECMAScript® 2026 language specification*
(ECMA-262, 17th ed.), § 10.5.8, Proxy `[[Get]]`.
https://tc39.es/ecma262/2026/multipage/ordinary-and-exotic-objects-behaviours.html#sec-proxy-object-internal-methods-and-internal-slots-get-p-receiver

OWASP Foundation. (n.d.). *Error handling cheat sheet*. OWASP Cheat Sheet
Series. Retrieved August 6, 2026, from
https://cheatsheetseries.owasp.org/cheatsheets/Error_Handling_Cheat_Sheet.html

WHATWG. (2026). *DOM standard*, § 4.5.1, Interface `DOMImplementation`.
https://dom.spec.whatwg.org/#interface-domimplementation
