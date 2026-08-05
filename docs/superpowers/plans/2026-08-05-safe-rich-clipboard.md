# Safe Rich Clipboard Ingestion Implementation Plan

> **Execution method:** test-driven development, exact-head verification, and
> serial branch writes only. Checked items describe implementation work already
> represented on this feature branch; repository, review, and release gates are
> checked only after evidence exists on the exact current head.

**Goal:** Add a bounded, fail-closed semantic rich-HTML clipboard sanitizer that
is enabled consistently in standalone and provider-neutral collaborative Inkspan
editors.

**Architecture:** `SafeClipboard` transforms `text/html` before ProseMirror
parsing. It parses into an inert template, iteratively reconstructs an allowlisted
fragment, reuses SafeLink, drops resource-bearing images and active/hidden
subtrees, and reports only redacted stable errors through the latest host
callback. The original `ClipboardConfig` object is preserved by identity until
paste-time validation. SafeClipboard uses the lowest-practical TipTap extension
priority so it remains the final ordinary paste transform in the supported kit.

**Technology:** TypeScript 5.7, TipTap 2.27/ProseMirror, React 18/19, Yjs,
Vitest 3 with jsdom, Vite 6, the existing SafeLink and Base64Image boundaries,
and existing hash-locked Office Python verification.

## Global constraints

- Default maximum source HTML: 1,048,576 UTF-8 bytes.
- Default maximum traversed nodes: 10,000.
- Default maximum source depth: 64.
- No new runtime dependency.
- No network, filesystem, model, provider, credential, storage, or database
  operation.
- Drop every HTML `<img>`; binary clipboard images continue through Base64Image.
- Preserve only the elements and attributes in the accepted design.
- Convert only bold, italic/oblique, underline, and line-through styles to
  semantic elements.
- Reuse `isSafeLinkHref()`; never trim or repair an untrusted link.
- Errors contain only stable codes and static bounded messages.
- Production statement, branch, function, and line coverage: 100%.
- Complete beginner-readable public API documentation.
- The behavior targets 0.6.0 but remains under `Unreleased` until a separate
  exact-head release-only pull request passes publication gates.
- No cross-engine browser conformance claim is made from jsdom evidence.

## Task 1: Public sanitizer contract

- [x] Write failing configuration, resource-limit, malformed HTML, hidden
  subtree, link, semantic-style, and missing-DOM tests.
- [x] Add `ClipboardConfig`, `ClipboardSanitizationErrorCode`,
  `ClipboardSanitizationError`, `sanitizeRichClipboardHtml()`, and
  `SafeClipboard`.
- [x] Validate exact own data properties without evaluating accessors, symbols,
  or proxy traps.
- [x] Enforce hard byte, node, and depth ceilings.
- [x] Reconstruct newly created allowlisted nodes through iterative traversal.
- [x] Preserve only SafeLink hyperlinks, bounded list starts, and bounded table
  spans.
- [x] Convert the four approved style semantics and discard all source style
  attributes.
- [x] Drop scripts, embedded resources, forms, metadata, SVG/MathML, media,
  templates, comments, hidden content, and all HTML images.
- [x] Detect proprietary Office `mso-hide: all` from bounded raw style
  declarations with CSS-comment removal, case/whitespace handling, terminal
  `!important`, and false-positive guards.

## Task 2: Shared editor integration

- [x] Add `clipboard` and `onClipboardError` to the public editor props.
- [x] Add exactly one SafeClipboard extension through `buildExtensions()` for
  standalone and Yjs-backed editor surfaces.
- [x] Preserve the original `ClipboardConfig` object without nested reads during
  editor construction.
- [x] Defer exact fail-closed configuration validation to rich paste.
- [x] Route errors to the latest host callback without recreating the editor or
  collaboration binding.
- [x] Contain host callback exceptions so rejected HTML remains rejected.
- [x] Add standalone and collaborative regression tests for hostile accessors,
  callback liveness, redaction, and editor identity.

## Task 3: Transform-order security boundary

- [x] Write a failing real TipTap extension-manager regression with a competing
  host transform that reintroduces a script and tracking image.
- [x] Assign SafeClipboard the lowest-practical TipTap extension priority.
- [x] Prove it is the final ordinary `transformPastedHTML` transform in the
  supported shared extension graph.
- [x] Document that a deliberately lower-priority host transform or later parsed
  transaction mutation is outside the supported boundary and requires an
  independently verified equivalent validation step.

## Task 4: Public exports and operator evidence

- [x] Export the sanitizer, extension, error class, error-code type, and config
  type through the existing public package surface.
- [x] Add README discovery for Word/Google Docs rich paste, HTML-image rejection,
  limits, and the host error callback.
- [x] Add `docs/clipboard-security.md` with preserved/removed content, SSR,
  callback, ordering, ownership, privacy, and recovery guidance.
- [x] Add `docs/doctoring/safe-rich-clipboard.md` with APA 7 sources, rejected
  alternatives, modular ownership, claim boundaries, maintenance obligations,
  and rollback/release policy.
- [x] Update `ARCHITECTURE.md` and `CHANGELOG.md` under `Unreleased`.
- [x] Add deterministic documentation contract tests for the accepted behavior
  and assurance limits.

## Task 5: Browser assurance and sanitizer maintenance

- [x] Record that current deterministic tests run in jsdom and do not establish
  Chromium, Firefox, or WebKit parser/CSS/serialization parity.
- [x] Record OWASP's maintained-sanitizer guidance and DOMPurify recommendation
  without implying endorsement of the bespoke implementation.
- [x] Record the direct vulnerability-response obligation created by retaining a
  no-new-runtime-dependency bespoke sanitizer.
- [x] Make a version-pinned Playwright cross-engine differential corpus a 0.6.0
  publication gate rather than adding an unpinned one-shot browser download to
  this feature branch.
- [ ] Implement and dependency-lock that cross-engine corpus in the later
  release-acceptance slice before 0.6.0 publication.

## Post-review reconciliation

The first integrated review identified three valid implementation defects and
one assurance gap. They were handled test-first:

- [x] **Configuration boundary:** the shared kit previously dereferenced nested
  clipboard values at editor construction. Regressions now require identity
  preservation and paste-time validation on both React surfaces.
- [x] **Office hidden content:** CSSOM access did not expose `mso-hide` reliably.
  Regressions now cover raw declaration variants and false positives.
- [x] **Transform ordering:** default extension priority allowed a later transform
  to reintroduce unsafe markup. A real TipTap chain regression now requires the
  sanitizer to run last in the supported kit.
- [x] **Incorrect test assertion:** a raw regular expression matched the visible
  phrase `font text`. Structural DOM assertions now verify removed element names
  while preserving visible text.
- [x] **Browser assurance:** the feature claim is narrowed, and the cross-engine
  differential corpus is an explicit publication gate.
- [x] **Standards correction:** a review mistakenly described the official W3C
  24 June 2026 dated Working Draft as nonexistent; that finding was withdrawn
  after direct verification of the official publication and is not implemented.

## Task 6: Exact-head repository verification

The feature is not accepted merely because an earlier head or individual job
passed. Every item below must be established on the final exact head after all
writes stop.

- [ ] TypeScript typecheck.
- [ ] 100% production statement, branch, function, and line coverage.
- [ ] Deterministic library and demo builds.
- [ ] Isolated packed ESM, CommonJS, and strict TypeScript consumers.
- [ ] Office Python 3.11 and 3.14 dependency, docstring, branch coverage, wheel,
  schema, and license gates.
- [ ] Fixed-runner exact-head CI using immutable workflow-source pins and
  non-persisted checkout credentials.
- [ ] Security Scan and SAST Semgrep.
- [ ] Current-head human, CodeRabbit, GitHub Advanced Security, Dependabot,
  OpenCode, Noema, Strix, and other applicable automated feedback triage.
- [ ] Zero valid unresolved review threads.
- [ ] Current-head qualifying non-author independent approval.
- [ ] Branch protection permits merge without bypass.

## Task 7: Integration and release

- [ ] Reconcile with the modular architecture PR if it merges first, preserving
  valid changes in both `ARCHITECTURE.md` and `CHANGELOG.md`.
- [ ] Move Draft to Ready only after implementation/docs and exact-head direct
  gates are complete.
- [ ] Merge only when every protected exact-head check and independent review is
  satisfied.
- [ ] Open a separate release-only PR for version 0.6.0, the dependency-locked
  cross-engine corpus, package metadata, release notes, SBOM, provenance,
  immutable artifacts, rollback evidence, and publication acceptance.
- [ ] Publish only from the exact reviewed release head; do not infer publication
  from feature merge.
