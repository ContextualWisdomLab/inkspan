# Cross-engine rich-clipboard release assurance

Status: Implemented on active PR

## Decision boundary

Inkspan's SafeClipboard runtime is already integrated on protected `main`, but HTML fragment parsing, DOM reconstruction, CSS interpretation, serialization, and ProseMirror parsing are browser semantics. jsdom remains useful deterministic unit evidence; it is not real-engine conformance. The 0.6.0 rich-clipboard publication boundary therefore requires the same committed synthetic fixtures to execute through the supported TipTap/ProseMirror paste path in real Chromium, Firefox, and WebKit on one exact source head.

This active implementation uses **Playwright 1.62.0** from the isolated `tests/browser/pnpm-lock.yaml`. The official Playwright **Release notes: Version 1.62** identify Chromium 151.0.7922.34, Mozilla Firefox 153.0, and WebKit 26.5 as the bundled browser versions for that release. The CI evidence records the actual `browser.version()` value for each engine, the Playwright version, operating-system identity, corpus version, SHA-256 of the browser-test `pnpm-lock.yaml`, the exact source head, one fresh browser-run identity, and—on the release path—the SHA-256 of the exact packed npm artifact under test. Those observed values, rather than this prose, are the release evidence when a browser revision changes.

## Test-first evidence

RED commit `cd6945b642a5d48449e1a59581e728ce6b440ff6` added the permanent release-oracle contract before its implementation existed. Hosted CI failed at TypeScript resolution because `crossEngineClipboardEvidence` was deliberately absent. The contract also injects deliberate sanitized-HTML, ProseMirror-structure, rejection-behavior, missing-engine, duplicate-engine, and mixed-case divergences. The production oracle then implemented fail-closed three-engine consensus, and a later exact coverage run exposed and removed one unreachable fallback instead of excluding it from coverage.

A later exact-head review found three release-evidence integrity gaps that direct source-tree browser success could not prove: the tag workflow did not exercise the packed `.tgz`, completed browser evidence disappeared with the runner, and predecessor-run evidence could survive in the local evidence directory. Permanent regression contracts now require the release browser job to consume the npm artifact produced by `build-release-artifacts`, verify its transferred checksum, expose only that artifact's public bundle to the browser harness, retain the bounded `.browser-evidence` directory as a GitHub Actions artifact, clear predecessor evidence once before projects start, bind every engine record to one run identifier, and recompute the current browser lock digest at consensus time.

The browser corpus covers active content, external-resource and form subtrees, hidden CSS/ARIA/Office/popover content, safe and unsafe links, malformed formatting and paragraph reconstruction, table/list parser repair, SVG/MathML, interactive and native-widget fallback, semantic inline-style reconstruction, byte limits, node limits, and depth limits. A separate real-browser probe uses a revoked `Document` proxy to require stable redacted DOM-capability failure without reflecting the private source string. A representative Word-like fixture provides a generous release alarm rather than a universal performance benchmark.

## Packed-artifact and source authority

Pull-request CI may use the exact checked-out source entry through the browser harness alias to prove the current implementation before packaging. The release path is stricter: `build-release-artifacts` first builds, tests, packs, and transfers the npm `.tgz`; the browser job then downloads that artifact, verifies `SHA256SUMS`, unpacks the exact package into the isolated browser consumer, and points the harness alias at the packaged `dist/cwl-editor.js`. The browser release result therefore cannot be satisfied solely by an uninstalled source-tree module that differs from what will be published.

The packed npm SHA-256 is carried into every engine evidence record and is recomputed from the exact transferred `.tgz` bytes at evidence creation and consensus time. A propagated digest, when available, must match those bytes rather than replacing that calculation. This package digest is release-integrity metadata, not a tenant, actor, authorization, or durable-document identifier.

## Hermeticity and evidence minimization

The browser scenario permits requests only to the loopback Vite harness and aborts any external request. The external-request assertion is evaluated after each scenario has reached network idle so a delayed request cannot escape an early assertion. SafeClipboard itself performs no network fetch. The workflow installs the exact browser revisions selected by pinned Playwright before the test scenario begins; browser provisioning is a build prerequisite, not application egress.

Global browser setup removes predecessor `.browser-evidence` once before Chromium, Firefox, WebKit, and consensus projects begin and creates one opaque run identity shared by the current invocation. Consensus requires every engine record to match that run identity and recomputes the current `tests/browser/pnpm-lock.yaml` SHA-256 rather than merely trusting equality among evidence files.

The evidence files contain only public synthetic fixture identifiers, sanitized output, ProseMirror JSON produced from those synthetic fixtures, stable rejection codes, engine/runtime versions, lock digest, optional packed-package digest, corpus version, source SHA, run identity, runner identity, and representative timing. They contain **no tenant document**, production clipboard payload, credential, model prompt/output, authorization context, user identity, or private local path. The committed corpus uses synthetic fixtures only. Release execution uploads only the bounded `.browser-evidence` directory with hidden run-identity metadata included; Playwright screenshots/traces and the broader `test-results` directory are not retained by this evidence artifact.

## Difference policy

Security-relevant results must agree across Chromium, Firefox, and WebKit. The comparator uses **no generic normalization** and no broad engine allowlist. The one structural canonicalization is limited to recursively sorting JSON object member names before comparing ProseMirror JSON, because JSON object member ordering is not part of the document structure; array order, primitive values, nulls, sanitized HTML, and rejection codes remain exact. This rule prevents a semantically irrelevant object insertion-order difference from becoming an engine exception while preserving all ordered document structure.

Any other difference may be admitted only through a focused regression fixture and a reviewed rule that records the authoritative standards basis, exact affected engine/version, threat analysis, canonical interpretation, compatibility consequence, and rollback. An unexplained parser, sanitizer, error, ordered ProseMirror-structure, or value difference must **fail closed**.

The same rule applies when one project is missing, skipped, cancelled, unable to provision, unable to emit current-run evidence, has a stale lock digest, or cannot prove the expected packed package: the rich-clipboard release lane remains blocked. Other Inkspan work may continue; the browser gate itself does not become optional.

## Compatibility and rollback

Playwright/browser upgrades are compatibility events. Update the immutable browser-test lock, rerun every engine and the complete corpus, review any difference against current standards, and accept the new evidence only on the unchanged exact head. Do not transfer browser evidence from a predecessor commit or prior workflow attempt.

If the browser gate itself is faulty, rollback may revert the gate change while explicitly leaving the 0.6.0 rich-clipboard publication claim unaccepted. After protected integration, removing a required engine, weakening the corpus, broadening normalization beyond unordered JSON object-member canonicalization, dropping packed-artifact binding/current-run identity/lock revalidation, or replacing the exact-head evidence contract requires a superseding ADR and new threat analysis. A sanitizer defect discovered by the gate is fixed at the runtime boundary test-first rather than hidden in an engine-specific expectation.

## Claim limits

Passing these projects proves the committed SafeClipboard corpus and supported paste integration under the pinned Playwright engine builds on the recorded runner, and on the release path proves that the exact packed npm artifact exercised by the harness matches the recorded package digest. It does not claim byte-identical behavior for every browser build, enterprise browser policy, extension environment, branded channel, downstream renderer, or arbitrary HTML. Hosts continue to own authorization, tenancy, persistence, CSP, application egress, deployment, model-use policy, and legal/privacy policy.

## References

Microsoft. (2026). *Playwright Test 1.62.0*. npm. https://www.npmjs.com/package/@playwright/test/v/1.62.0

Microsoft. (2026). *Release notes: Version 1.62*. Playwright. Retrieved August 10, 2026, from https://playwright.dev/docs/release-notes

Microsoft. (n.d.-a). *Browsers*. Playwright documentation. Retrieved August 10, 2026, from https://playwright.dev/docs/browsers

Microsoft. (n.d.-b). *Projects*. Playwright documentation. Retrieved August 10, 2026, from https://playwright.dev/docs/test-projects

Web Hypertext Application Technology Working Group. (2026). *HTML Standard: Parsing HTML documents* (Living Standard). Retrieved August 10, 2026, from https://html.spec.whatwg.org/multipage/parsing.html

World Wide Web Consortium. (2026, June 24). *Clipboard API and events* (W3C Working Draft). https://www.w3.org/TR/2026/WD-clipboard-apis-20260624/
