# Cross-engine rich-clipboard release assurance

Status: Implemented on active PR

## Decision boundary

Inkspan's SafeClipboard runtime is already integrated on protected `main`, but HTML fragment parsing, DOM reconstruction, CSS interpretation, serialization, and ProseMirror parsing are browser semantics. jsdom remains useful deterministic unit evidence; it is not real-engine conformance. The 0.6.0 rich-clipboard publication boundary therefore requires the same committed synthetic fixtures to execute through the supported TipTap/ProseMirror paste path in real Chromium, Firefox, and WebKit on one exact source head.

This active implementation uses **Playwright 1.62.0** from the isolated `tests/browser/pnpm-lock.yaml`. That pinned Playwright release identifies Chromium 151.0.7922.34, Firefox 153, and WebKit 26.5 as its bundled browser versions. The CI evidence records the actual `browser.version()` value for each engine, the Playwright version, operating-system identity, corpus version, SHA-256 of the browser-test `pnpm-lock.yaml`, and the exact source head. Those observed values, rather than this prose, are the release evidence when a browser revision changes.

## Test-first evidence

RED commit `cd6945b642a5d48449e1a59581e728ce6b440ff6` added the permanent release-oracle contract before its implementation existed. Hosted CI failed at TypeScript resolution because `crossEngineClipboardEvidence` was deliberately absent. The contract also injects deliberate sanitized-HTML, ProseMirror-structure, rejection-behavior, missing-engine, duplicate-engine, and mixed-case divergences. The production oracle then implemented fail-closed three-engine consensus, and a later exact coverage run exposed and removed one unreachable fallback instead of excluding it from coverage.

The browser corpus covers active content, external-resource and form subtrees, hidden CSS/ARIA/Office/popover content, safe and unsafe links, malformed formatting and paragraph reconstruction, table/list parser repair, SVG/MathML, interactive and native-widget fallback, semantic inline-style reconstruction, byte limits, node limits, and depth limits. A separate real-browser probe uses a revoked `Document` proxy to require stable redacted DOM-capability failure without reflecting the private source string. A representative Word-like fixture provides a generous release alarm rather than a universal performance benchmark.

## Hermeticity and evidence minimization

The browser scenario permits requests only to the loopback Vite harness and aborts any external request. SafeClipboard itself performs no network fetch. The workflow installs the exact browser revisions selected by pinned Playwright before the test scenario begins; browser provisioning is a build prerequisite, not application egress.

The evidence files contain only public synthetic fixture identifiers, sanitized output, ProseMirror JSON produced from those synthetic fixtures, stable rejection codes, engine/runtime versions, lock digest, corpus version, source SHA, runner identity, and representative timing. They contain **no tenant document**, production clipboard payload, credential, model prompt/output, authorization context, user identity, or private local path. The committed corpus uses synthetic fixtures only.

## Difference policy

Security-relevant results must agree across Chromium, Firefox, and WebKit. The default comparator uses **no generic normalization** and no broad engine allowlist. A difference may be admitted only through a focused regression fixture and a reviewed rule that records the authoritative standards basis, exact affected engine/version, threat analysis, canonical interpretation, compatibility consequence, and rollback. An unexplained parser, sanitizer, error, or ProseMirror-structure difference must **fail closed**.

The same rule applies when one project is missing, skipped, cancelled, unable to provision, or unable to emit exact-head evidence: the rich-clipboard release lane remains blocked. Other Inkspan work may continue; the browser gate itself does not become optional.

## Compatibility and rollback

Playwright/browser upgrades are compatibility events. Update the immutable browser-test lock, rerun every engine and the complete corpus, review any difference against current standards, and accept the new evidence only on the unchanged exact head. Do not transfer browser evidence from a predecessor commit.

If the browser gate itself is faulty, rollback may revert the gate change while explicitly leaving the 0.6.0 rich-clipboard publication claim unaccepted. After protected integration, removing a required engine, weakening the corpus, broadening normalization, or replacing the exact-head evidence contract requires a superseding ADR and new threat analysis. A sanitizer defect discovered by the gate is fixed at the runtime boundary test-first rather than hidden in an engine-specific expectation.

## Claim limits

Passing these projects proves the committed SafeClipboard corpus and supported paste integration under the pinned Playwright engine builds on the recorded runner. It does not claim byte-identical behavior for every browser build, enterprise browser policy, extension environment, branded channel, downstream renderer, or arbitrary HTML. Hosts continue to own authorization, tenancy, persistence, CSP, application egress, deployment, model-use policy, and legal/privacy policy.

## References

Microsoft. (2026). *Playwright Test 1.62.0*. npm. https://www.npmjs.com/package/@playwright/test/v/1.62.0

Microsoft. (n.d.-a). *Browsers*. Playwright documentation. Retrieved August 10, 2026, from https://playwright.dev/docs/browsers

Microsoft. (n.d.-b). *Projects*. Playwright documentation. Retrieved August 10, 2026, from https://playwright.dev/docs/test-projects

Web Hypertext Application Technology Working Group. (2026). *HTML Standard: Parsing HTML documents* (Living Standard). Retrieved August 10, 2026, from https://html.spec.whatwg.org/multipage/parsing.html

World Wide Web Consortium. (2026, June 24). *Clipboard API and events* (W3C Working Draft). https://www.w3.org/TR/2026/WD-clipboard-apis-20260624/
