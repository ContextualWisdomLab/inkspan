# Inkspan Test Strategy

Status: Protected-main canonical baseline

## Purpose

Inkspan testing must prove deterministic authoring/conversion behavior, fail-closed security boundaries, package compatibility, accessibility semantics, and release evidence without conflating local correctness with host authorization or durable persistence. Protected `main` remains the implementation authority; open feature branches are not shipped evidence.

## Test pyramid and evidence classes

### Pure deterministic unit tests

Exercise document-envelope validation, canonicalization, UTF-8 handling, revision derivation, transition evidence, selection capture, autosave queue/state transitions, link/image policy, clipboard reconstruction, conversion primitives, Office renderer validation, and error normalization. Inputs include hostile objects, proxies/accessors, malformed JSON/UTF-8, deep or large structures, invalid identifiers, and boundary values.

### Component and integration tests

Exercise TipTap/ProseMirror integration, actual paste-pipeline installation, SSR/hydration, native form serialization, provider-neutral Yjs bindings, editor lifecycle, autosave durable-session handoff, and deterministic conversion packages. Tests must use the actual public adapter path instead of invoking an unregistered configuration field or bypassing the integration layer.

### Package-consumer tests

Install or consume the packed artifacts rather than source-tree aliases. Verify ESM, CommonJS, and strict TypeScript consumers. Framework-independent subpaths must compile and run without accidental React, TipTap UI, ProseMirror view, Yjs, DOM, network, or credential dependencies when the public contract excludes them.

### Browser differential tests

Where browser fragment parsing or serialization participates in a security boundary, use dependency-locked Playwright coverage across Chromium, Firefox, and WebKit. SafeClipboard and the cross-engine publication gate are implemented on protected `main`.

The protected gate pins **Playwright 1.62.0** in an isolated immutable browser-test lock and runs the same versioned synthetic corpus through the supported TipTap/ProseMirror `transformPastedHTML` path in named Chromium, Firefox, and WebKit projects on one **exact source head**. Evidence binds the corpus version, browser-test lock digest, Playwright version, actual browser versions, operating-system identity, exact source head, fresh run identity, and exact packed npm artifact digest. The corpus covers active/resource/form content, hidden/Office/popover semantics, safe and unsafe links, malformed fragments, tables/lists, SVG/MathML, interactive/native fallback, byte/node/depth ceilings, hostile DOM capability failures, and a representative Word-like performance alarm.

Issue #375's proposed first slice separately runs the deterministic synthetic
`inkspan-large-document-v1` corpus through the real `CwlEditor` browser harness
for mount, snapshot, envelope serialization, and revision timing. This is
PR-CI smoke evidence only: it reports no document body or digest and claims no
support budget until repeated exact-head hardware/runtime measurements are
available.

Differences are not normalized away merely to produce parity. The default gate has no generic normalization or broad engine allowlist; a permitted difference requires a focused regression fixture, authoritative standards basis, threat analysis, exact affected engine/version evidence, canonical interpretation, compatibility impact, and rollback. Missing, skipped, cancelled, incomplete, stale-run, stale-lock, package-mismatched, or divergent required browser evidence must fail closed rather than becoming successful release evidence. A source movement after evidence generation requires the new exact release candidate to re-prove the gate.

### Office artifact tests

Exercise realistic DOCX, XLSX, and PPTX fixtures and inspect the generated package structure. Cover XML 1.0 validity, formula-injection neutralization, worksheet naming and freeze panes, bounds/depth/cycles, deterministic metadata, publication races, overwrite semantics, and wheel/package contents. No macro, network, model, or Desktop Office execution is required by the deterministic renderer.

### Security and static analysis

Run repository security scanning, Semgrep/SAST, dependency and supply-chain checks, secret scanning where configured, package/license inspection, immutable workflow/source checks, and hostile-input regressions. Scanner success does not replace behavioral tests.

### Accessibility tests

Verify native control semantics, focus behavior, `aria-pressed`, `aria-keyshortcuts`, keyboard parity, programmatic status data, SSR behavior, non-color status semantics, and host-facing lifecycle information. Automated checks supplement rather than replace manual assistive-technology and interaction review for a release candidate.

## Coverage policy

JavaScript/TypeScript owned production code is enforced at exact 100% statements, branches, functions, and lines by the repository Vitest/V8 coverage configuration. Coverage is a structural completeness gate, not proof of semantic correctness. Tests must continue to include realistic domain and adversarial behavior instead of creating vacuous branches merely to satisfy a percentage.

Office Python uses a distinct language/tool contract. Across every advertised supported Python minor on protected CI, `coverage.py` runs with branch measurement enabled, `coverage report` is required to meet `fail_under = 100`, and `show_missing = true` exposes uncovered statement lines and missing branch destinations/start lines. The Office gate also requires 100% public-docstring completeness through `scripts/check_docstrings.py`. Python has no separate JavaScript-style function/line percentage counters in this repository contract; do not relabel the coverage.py report as four independent metrics. JavaScript/TypeScript public declarations and package boundaries additionally require strict packed-consumer compilation.

## Security corpus

At minimum, maintain regressions for:

- duplicate JSON object names, negative zero, malformed JSON, malformed UTF-8, BOM, depth/value/string/byte limits, sparse/decorated/non-plain objects, symbols, accessors, proxies, reflection failures, and detached/cross-realm byte views;
- rich clipboard scripts, embeds, resources, forms, metadata, SVG/MathML, images, hidden subtrees, `dialog`, `details`, `popover`, Office `mso-hide`, CSS comments/escapes/case/whitespace, malformed fragments, tables/lists/formatting elements, unsafe links, resource ceilings, real-engine parser/serializer differences, and hostile DOM capabilities;
- SSR client-controlled form values, escaping, hydration continuity, reset behavior, and absence of server editor construction;
- autosave stale validators, conflict/failure recovery, ambiguous transport outcomes, duplicate/no-op lifecycle transitions, callback exceptions, queue bounds, flush/close behavior, and durable-validator coherence;
- selection/revision races and document movement during asynchronous hashing;
- Office formula prefixes, invalid XML characters, malicious strings, path/publication races, invalid worksheet names, invalid freeze panes, cyclic input, pathological nesting, excessive container size, and partial write failure;
- package/release stale draft assets, unexpected or non-regular local entries, exact three-file inventory violations, incomplete remote uploads, GitHub-vs-local digest mismatch, stale exact-head evidence, mutable provenance inputs, and isolated packed-consumer behavior.

## Concurrency and failure testing

Use deterministic barriers/fakes for local concurrency and real process/file boundaries where required. Prove that an observer exception cannot alter queue ordering; a stale digest cannot bind to a later editor state; an ambiguous durable save does not advance a validator; close/recovery does not leak waiters; and file publication either completes under the documented contract or fails without silently replacing unrelated content.

Host persistence transactions, tenant isolation, distributed collaboration authorization, durable audit storage, and production network retry policy are host-owned and must be tested by the embedding product. Inkspan tests verify only the explicit adapter contract at those boundaries.

## Release acceptance

A release candidate requires the exact integrated protected head to satisfy applicable CI, security, JavaScript/TypeScript 100% statement/branch/function/line coverage, Office coverage.py 100% report plus public-docstring completeness, package-consumer, accessibility, browser differential, Office artifact, SBOM/provenance, reproducibility, unresolved-thread, actually required independent-review, and release-workflow gates. Queued, skipped-required, cancelled, absent, stale-head, predecessor-head, status-only, or synthetic-merge evidence is not accepted as success.

The release workflow must also satisfy the normative `docs/CONTRACTS.md` draft inventory contract: exactly one npm tarball, exactly one Office wheel, and `SHA256SUMS`; no other top-level entry; remote uploaded asset names exactly equal local names; and every GitHub-reported `sha256:` digest equals the exact transferred local file digest. Missing, stale, unexpected, non-regular, incomplete, or digest-mismatched assets are failures, not cleanup opportunities.

The 0.6.0 rich-clipboard release line specifically requires the protected dependency-locked **Playwright 1.62.0** Chromium, Firefox, and WebKit differential gate on the exact integrated protected release candidate before publication. Deterministic jsdom coverage remains useful but is not a substitute for browser-engine acceptance. Tagged release evidence must be generated anew from the release candidate and must verify the exact packed npm artifact, not merely reuse a previously green feature-branch run.

## Documentation verification

Documentation tests must compare canonical PRD/TRD/Architecture/ADR/UML/data-model/security/operability claims against current public package names, state enums, runtime versions, integration boundaries, and release evidence. They should reject obsolete product/internal names and unsupported claims, not merely check that files exist.

## Rollback of a test gate

A gate may be changed only because its product contract changed or the gate itself is technically invalid. The replacement begins with a regression that demonstrates the mismatch. Do not disable, skip, broaden allowlists, or lower coverage/security thresholds merely to make a branch green. Browser-gate rollback must leave the rich-clipboard publication claim unaccepted unless equivalent or stronger real-engine evidence replaces it.
