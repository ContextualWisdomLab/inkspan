# Doctoring record: rich clipboard resource preflight

**Date:** 2026-08-16  
**Status:** Active PR / Proposed  
**Decision owner:** ContextualWisdomLab  
**Scope:** Allocation bounds inside `sanitizeRichClipboardHtml()` before UTF-8
encoding and before DOM child materialization.

## Buyer-visible gap

Hosts paste untrusted HTML from Word, browsers, mail, and support tools. A
caller-controlled string can already be larger than `maxHtmlBytes` in UTF-16
code units, yet a complete `TextEncoder` copy was still allocated before
rejection. A broad surviving source node could also enqueue every child before
`maxNodes` was enforced. Buyers therefore saw the configured ceilings as
weaker than their names: Inkspan could still amplify memory on rejected paste.

If a paste fails with `input_too_large` or `node_limit_exceeded`, measure the
trusted source and raise only that ceiling. Do not remove the limits.

## Decision

1. Reject `sourceHtml.length > maxHtmlBytes` with the existing redacted
   `input_too_large` error before constructing `TextEncoder`. Retain the exact
   UTF-8 `byteLength` check when code-unit length alone cannot reject.
2. Reject when `visited + queued + newly enqueueable` source nodes would exceed
   `maxNodes`, before `NodeList.item()` materializes those children. The
   closed-`details` first-summary path uses the same invariant.
3. Keep dropped and hidden subtrees unvisited so their descendants do not
   consume budget. Preserve source order, allowlist, SafeLink, depth, and
   redacted error text.

No network, persistence, credential, model, tenant, collaboration-provider, or
durable-audit authority is added.

## Standards rationale

The Unicode Standard defines UTF-8 as a variable-width encoding in which every
scalar value uses one or more 8-bit code units, and never zero
(Unicode Consortium, 2024, §3.9). ECMA-262 exposes `String` length as UTF-16
code units (Ecma International, 2025, §6.1.4). A UTF-16 code unit therefore
contributes at least one UTF-8 byte, so `sourceHtml.length > maxHtmlBytes` is a
conservative lower-bound rejection. Non-ASCII text can still expand, so the
exact encoder check remains required inside the ceiling.

WHATWG DOM defines `Node.childNodes` as a live `NodeList` whose members are
retrieved by index (Web Hypertext Application Technology Working Group, 2026).
Counting enqueueable children against the remaining node budget before index
access prevents the sanitizer from allocating a traversal stack larger than the
configured ceiling.

CWE-770 records allocation without a matching limit as a reliability and
availability defect (MITRE, 2024). The W3C Clipboard API Working Draft treats
HTML clipboard payloads as untrusted input (World Wide Web Consortium, 2026).
The cited Working Draft is work in progress and is not a conformance claim.

## Test-first evidence

- RED `51f9edfdff7de9072cafa8cebaf068dc39f92208` on current protected
  `main@e8109ec2a17de8bd6594487aa12c8c8a93cb2c03` proved an ASCII
  nine-code-unit string under `maxHtmlBytes: 8` still called
  `TextEncoder.prototype.encode`, and a three-child fragment under
  `maxNodes: 2` performed three `NodeList.item()` reads before
  `node_limit_exceeded`.
- GREEN `71654a8e59eecd72f2a23ebec173e4e537c927d9` rejects both cases at the
  preflight boundary without changing codes or messages.

Predecessor Draft #164 remains historical. It is not current-main
implementation authority.

## Residual risk

The UTF-16 lower bound does not replace the exact UTF-8 check. Queue preflight
counts enqueueable children of a surviving parent; it does not invent a second
hidden-content policy. jsdom success is not Chromium, Firefox, or WebKit
conformance. Cross-engine corpus evidence remains a 0.6.0 release-acceptance
gate.

## Rollback

Rollback must remove the length preflight, the traversal-capacity guard, this
record, the operator guidance, the documentation contract, and the changelog
entry together. It must restore the previous encode-then-compare and
visit-then-reject behavior only as one change. Rollback requires the same
exact-head review, coverage, security, packaging, and independent-approval
gates.

## References (APA 7th edition)

Ecma International. (2025). *ECMAScript® 2025 language specification*
(ECMA-262, 16th ed.). https://tc39.es/ecma262/2025/

MITRE. (2024). *CWE-770: Allocation of resources without limits or throttling*.
https://cwe.mitre.org/data/definitions/770.html

Unicode Consortium. (2024). *The Unicode Standard, Version 16.0.0*.
https://www.unicode.org/versions/Unicode16.0.0/

Web Hypertext Application Technology Working Group. (2026). *DOM Standard*.
Retrieved August 16, 2026, from https://dom.spec.whatwg.org/

World Wide Web Consortium. (2026, June 24). *Clipboard API and events* (W3C
Working Draft). https://www.w3.org/TR/2026/WD-clipboard-apis-20260624/
