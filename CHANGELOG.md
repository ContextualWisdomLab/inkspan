# Changelog

All notable changes to **Inkspan** (`@contextualwisdomlab/cwl-editor`) are documented in this file.

Historical release entries from **0.1.0 through 0.5.27** are preserved verbatim in [`docs/changelog/CHANGELOG-0.1.0-0.5.27.md`](docs/changelog/CHANGELOG-0.1.0-0.5.27.md). This active file remains intentionally bounded so current release evidence is easy to review during operations and acquisition diligence.

## [Unreleased]

### Added
- Named the repeating editor chrome as a host-facing theme-token catalog and Storybook inventory so hosts can override `--cwl-*` custom properties on `.cwl-editor` after checking WCAG 2.2 contrast, without editing Inkspan internals. Color catalog values now distinguish light, dark, and `@media print` remaps; forced-colors mode is not treated as a token assignment. Hosts can call `getEditorThemeTokenContrast()` to compare shipped color pairs against the 4.5:1 text threshold.

## [0.6.0] — 2026-08-10

### Release
- Unified the npm editor and `inkspan-office` package manifests at **0.6.0** for the accepted stable OIDC release train; source preparation does not claim registry publication, and public npm/PyPI digest verification remains separate operational acceptance.

### Fixed
- Added the selected standalone Markdown or HTML value to an explicitly configured SSR native form field, preserving controlled-value precedence, external form association, React attribute escaping, and the synchronous post-hydration TipTap transaction mirror

### Security
- Added a fail-closed draft release asset inventory gate that requires exactly one npm tarball, one Office wheel, and `SHA256SUMS`, rejects stale or unexpected draft assets before immutable publication, and verifies every GitHub-reported `sha256:` asset digest against the transferred local file
- Kept SSR document disclosure opt-in through `formFieldName`; hidden-field values remain client-controlled submission data and do not replace host authentication, authorization, tenant isolation, CSRF defenses, server validation, durable concurrency, or persistence controls
- Kept collaborative Yjs document content out of server markup until the host-owned client collaboration lifecycle is bound
- Added packed headless Markdown authority verification that rejects external runtime imports, dynamic module loaders, ambient network/environment credential access, React/TipTap/Yjs runtime coupling, CWL host coupling, and model credential references from the dedicated conversion artifact
- Added OIDC Trusted Publishing for the exact validated npm tarball and Office wheel with registry-side credentials kept out of source, build jobs, and long-lived repository secrets; registry publication is verified against the exact artifact digests after publication.

### Added
- Added `@contextualwisdomlab/cwl-editor/markdown` as a headless ESM/CommonJS/TypeScript conversion subpath exposing the existing deterministic Markdown/HTML/email/plain-text serializers while sharing framework-neutral safe-link and strict inline-raster policy with the editor instead of importing the React/TipTap extension graph
- Added bounded `inspectDocumentEnvelopeIdentity()` and `inspectDocumentEnvelopeIdentityBytes()` routing metadata plus the framework-independent `envelope-identity` package subpath so hosts can select explicit schema migrations without exposing document bodies, weakening the strict current-schema parser, or moving migration/persistence authority into Inkspan
- Added one optional construction-time `onSnapshotChange` callback to the framework-free autosave queue and durable autosave session so hosts can observe saving, pending, blocked, recovery, idle, and shutdown state without polling or introducing a subscriber collection
- Added privacy-minimized revision-scoped selection evidence through `getSelectionRevisionEvidence()`, binding frozen ProseMirror coordinates to the SHA-256 strong revision of the exact same immutable editor state before asynchronous hashing begins
- Added privacy-minimized document transition evidence for validated previous and resulting canonical revisions through the framework-independent `revision-evidence` subpath, with object/JSON and strict UTF-8 entry points, deterministic previous-then-resulting SHA-256 derivation, frozen revision-only results, and no document body, actor, tenant, time, authorization, signature, transport, model, or durable-write claim
- Added CSS-only paged-media output that removes interactive editor chrome and screen-only clipping in print, preserves authored document structure, and is exercised against the packed stylesheet in Chromium, Firefox, and WebKit without introducing a PDF service or network authority.
- Added normalized programmatic editor placeholder semantics so visible placeholder guidance and `aria-placeholder` remain aligned for standalone and collaborative editing without unnecessary editor remounts.
- Expanded deterministic DOCX fidelity with bounded informative inline PNG figures and alternative text, rich-text paragraph runs, and bounded paragraph and heading alignment while preserving fail-closed schema/runtime limits and Python 3.11–3.14 verification.
- Added bounded relationship-backed external HTTP(S) hyperlinks to DOCX rich-text runs while preserving deterministic network-free rendering, existing run emphasis, fail-closed URI validation, redacted errors, and Python 3.11–3.14 verification.

### Reliability
- Lifecycle observers receive only distinct frozen document-free snapshots; observer exceptions cannot alter save ordering, conflict/failure recovery, queue outcomes, or durable-validator handoff
- Durable-session notifications expose a newly committed server validator only after it is coherent with the emitted lifecycle state, preserving host-owned atomic RFC 9110 `If-Match` semantics

### Accessibility
- Require explicit author alternative-text intent before inline image insertion: non-empty text is stored as `alt`, an explicitly submitted empty response marks the image decorative with `alt=""`, cancellation inserts nothing, and conversion failures still abort before prompting.
- Added programmatic toolbar shortcut discoverability with WAI-ARIA `aria-keyshortcuts` for the implemented bold, italic, link, undo, and redo commands, preserving the same native-button behavior, visible labels, roving focus model, and host-owned shortcut-conflict policy
- Completed redo shortcut metadata with `Control+Shift+Z Meta+Shift+Z Control+Y Meta+Y`, matching the configured Tiptap history and collaboration behavior and exposing both `Ctrl/Cmd+Shift+Z` and `Ctrl/Cmd+Y` alternatives without adding new key handling
- Corrected extension-scoped review evidence after exact-head repository review found the existing editor-surface `Ctrl/Cmd+K` link binding in `EditorFrame`; the link button now truthfully exposes `Control+K Meta+K` while the Tiptap Link extension itself remains documented as having no default shortcut
- Preserved buyer-facing README guidance within the same validated safe-link command boundary and moved the shortcut-specific behavior contract to the authoritative accessibility and doctoring records so it is not misattributed to Tiptap
- Added deterministic regression and documentation contracts plus APA 7th doctoring for exact `Control`/`Meta` shortcut alternatives, the descriptive-only accessibility boundary, repository-level shortcut verification, and omission of unsupported shortcut claims

### Tests
- Added a dependency-locked Chromium/Firefox/WebKit **cross-engine rich-clipboard release gate** using Playwright 1.62.0, one versioned synthetic adversarial corpus, the actual TipTap/ProseMirror paste path, exact-source-head/lock/browser evidence, hostile-DOM and resource-ceiling cases, bounded performance alarm evidence, and fail-closed three-engine consensus without generic normalization
- Added test-first Node `renderToString` evidence for the missing SSR native value, controlled-over-default selection, escaping, external form ownership, no ProseMirror server construction, and opt-out non-disclosure
- Added browser-DOM handoff tests proving the field retains and updates the selected value before TipTap exists while reset-only unnamed fields remain empty
- Added real packed ESM/CommonJS/strict-TypeScript consumers for the headless Markdown subpath, including browserless Node HTML-to-Markdown execution, strict safe/unsafe-link behavior, plain-text projection, normalization, full-document email language/direction preservation, and artifact authority-boundary checks

### Documentation
- Added browser-assurance doctoring, operability, test-strategy, clipboard-security, and documentation-fitness coverage for the **dependency-locked Chromium/Firefox/WebKit** release boundary, including Playwright 1.62.0 provenance, exact-head/corpus identity, standards-backed difference policy, evidence minimization, fail-closed behavior, and rollback
- Added a canonical acquisition documentation spine covering product requirements, technical requirements, public interface/integration contracts, Mermaid UML, a conceptual data/evidence model, a threat model, test strategy, operability/recovery, standards/evidence traceability, and linked architecture decision records without inventing Inkspan-owned persistence or host authority; the newest decisions make envelope schema identity/host-owned migration routing, cross-engine browser-semantic release assurance, protected security disclosure, headless conversion, paged-media presentation, and deterministic Office fidelity first-class while keeping unimplemented capabilities explicitly planned
- Added machine-checkable canonical-documentation decision coverage that keeps required files, ADR index links and completeness, migration-routing and browser-assurance UML/data-model/traceability evidence, physical-ERD non-applicability, browser-security evidence, offline font provenance/no-runtime-font-egress, standards references, rollback sections, host-vs-Inkspan authority boundaries, implemented-vs-active-PR status, and work-conserving autonomous-maintenance guidance synchronized
- Documented work-conserving autonomous-maintenance governance in `AGENTS.md` and `CLAUDE.md`: a blocked PR blocks only its lane, status/report/prompt/documentation milestones are intermediate while safe work remains, and the external scheduler owns cadence rather than becoming an Inkspan runtime capability
- Added a repository-native security disclosure and vulnerability-handling policy with supported pre-1.0 release lines, private GitHub Security Advisory routing and safe public fallback, minimized evidence guidance, explicit Inkspan-versus-host ownership boundaries, no-SLA and non-conformance claim limits, deterministic documentation tests, and APA 7th doctoring grounded in current ISO/IEC 29147:2018, ISO/IEC 30111:2019, final NIST SP 800-218 SSDF 1.1, the draft-status boundary for SSDF 1.2, and GitHub primary documentation
- Documented that revision-scoped selection evidence contains no selected text or complete document envelope, remains valid only for its exact document revision, is not a W3C `TextPositionSelector`, and leaves durable comments, authorization, persistence, collaborative anchoring, and cross-revision re-anchoring to the host
- Added an APA 7th doctoring record for the selection/revision atomicity, privacy, rollback, and interoperability boundaries grounded in ProseMirror, RFC 9110, and the W3C Web Annotation Data Model
- Added transition-evidence operator guidance and APA 7th doctoring for content minimization, W3C PROV occurrence-provenance limits, RFC 8785 canonicalization, RFC 9110 durable-validator separation, SHA-256 lifecycle evidence, framework-free packaging, rollback, and host-owned authenticated audit semantics
- Added an authoritative standalone and modular MSA architecture contract with reviewable deployment, optimistic-concurrency, data-ownership, security, and acquisition-evidence diagrams and tables
- Added a beginner-readable naruon compose and ui.panel integration guide covering narrow client hydration, server-selected strong validators, accessible conflict handling, host-owned Yjs lifecycle, contextual-orchestrator boundaries, and local-versus-shareable evidence
- Added an opaque editing-context remount for the complete editor and autosave example, latest-generation asynchronous capture ordering, encoded document path segments, redacted recovery status, and lazy state-owned session identity to prevent cross-document state reuse
- Bounded the host save example with a fresh abort deadline, exposed authenticated conflict recovery through `session.resume(...)`, generated an instance-unique accessible heading relationship, and strengthened fenced-TSX ordering contracts
- Added stale-generation conflict recovery and operational save failure recovery through one reason-aware single-flight host workflow, so newer local edits cannot hide or duplicate recovery while retained work remains blocked; rejected or malformed resume attempts retain the same recovery surface until a valid resume succeeds or the editing context is disposed
- Added exact-head read-only CI with fixed Ubuntu 24.04 runners, immutable action pins, explicit contributor-head checkout, disabled persisted Git credentials, and a documented merge-result compatibility boundary
- Added deterministic documentation contract tests and APA 7th doctoring grounded in RFC 9110, WCAG 2.2, NIST SP 800-204, NIST SP 800-204D, OWASP ASVS 5.0.0, React, current Next.js App Router guidance, and GitHub Actions primary documentation
- Added APA 7th doctoring for the SSR native form field, including the WHATWG hidden-input/form-entry contract, React server/hydration continuity, client-controlled-data boundary, host-owned CSRF and acceptance controls, collaboration exclusion, and rollback
- Added lifecycle-observation doctoring covering bounded callback retention, local-versus-shareable evidence, durable-validator coherence, WCAG 2.2 status-message responsibilities, rollback, and APA 7 references to RFC 9110, WCAG 2.2, and optimistic concurrency research
- Added headless Markdown package doctoring and standards traceability grounded in CommonMark 0.31.2 and Node.js package exports, with explicit protected-main maturity, shared-policy authority, packed artifact verification, and rollback boundaries

## [0.5.29] — 2026-08-05

### Added
- Added `createDocumentAutosaveSession()` to bind every single-flight save to the exact server-issued strong entity tag loaded or last committed by the host, without adding transport, persistence, credentials, tenancy, or provider coupling
- Added `isStrongHttpEntityTag()` for fail-closed RFC 9110 quoted opaque-tag validation without trimming or repair
- Added immutable durable save request, result, session, recovery, and document-free snapshot contracts to the framework-independent `autosave` package surface

### Changed
- Package version **0.5.29**
- Package discovery metadata identifies the server-validator-bound durable autosave session alongside the lower-level single-flight coordinator

### Reliability
- Successful durable writes advance the next `If-Match` base only from the host callback's validated server-selected replacement tag
- Conflict, malformed result, hostile reflection, promise-assimilation failure, and transport failure preserve the previous durable validator until explicit authenticated recovery supplies a new strong tag
- Retained work resumes only after `resume(nextStrongEntityTag)` installs the recovered durable base before the next callback begins
- Recovery validators are validated consistently before lifecycle inspection; a valid no-op resume cannot replace the current durable base, and an unexpectedly declined blocked transition restores the previous validator
- Malformed recovery validators raise the dedicated public `invalid_recovery_validator` code and redacted recovery message instead of being misclassified as malformed session-construction options
- `flush()` reacquires the current terminal queue state after asynchronous wrapper boundaries, following recovery or shutdown races until lifecycle fields and `durableStrongEntityTag` describe one coherent idle, blocked, or closed logical moment

### Security
- Initial and replacement durable validators reject weak, unquoted, whitespace-containing, list, wildcard, control-character, and out-of-range values before they can enter host transport
- Callback results are exact-shape validated through property descriptors; document bodies, validators, callback values, and private exceptions never enter public error messages
- Session snapshots remain frozen and document-free; entity tags are tenant-confidential equality metadata rather than authorization, signatures, tenant membership, or durable audit evidence

### Tests
- Added deterministic sequential and concurrently queued validator handoff, conflict recovery, lifecycle-independent recovery validation, malformed option, missing and symbol-keyed option, malformed callback result, hostile reflection, promise assimilation, transport failure, frozen request, shutdown, and snapshot tests under repository-wide 100% production statement and branch coverage gates
- Added explicit regression cases for control characters, out-of-range Unicode, list-form values, wildcards, no-op recovery, and recovered-validator installation before retained work starts
- Added deterministic recovery-before-wrapper and close-before-wrapper concurrency regressions that prevent temporally mixed public flush snapshots
- Extended isolated packed-artifact ESM, CommonJS, and strict TypeScript consumers to prove the durable session and strong-tag validator work without React, React DOM, TipTap, ProseMirror, or Yjs installed
- Added release evidence that binds the version, changelog, scope, ownership boundary, acceptance gates, and rollback policy for 0.5.29

### Documentation
- Added buyer-visible autosave onboarding, explicit `autosave` and `revision-evidence` distribution surfaces, and npm persistence discovery metadata
- Corrected the autosave onboarding so initial and replacement validators are checked before use and come from the durable host's server-issued strong `ETag` rather than local revision evidence; missing, weak, or malformed validators fail closed in the example
- Documented that host-owned save callbacks must apply their own timeout or abort signal because an unresolved callback intentionally retains the active single-flight operation; retry policy remains host-owned
- Added a deterministic repository contract test and APA 7th-style doctoring for README, npm-search, Node.js package-export discoverability, RFC 9110 validator ownership, and quoted opaque-tag syntax
- Added operator, doctoring, and release evidence for the durable autosave session, coherent recovery-time flush snapshots, host ownership boundaries, exact-head verification, and acquisition-review scope

## [0.5.28] — 2026-08-05

### Added
- Framework-independent `@contextualwisdomlab/cwl-editor/autosave` ESM, CommonJS, and TypeScript package subpath
- `createDocumentAutosaveQueue()` for provider-neutral single-flight ordering of immutable `CwlEditorDocumentRevisionEvidence`
- Frozen saved, unchanged, superseded, conflict, closed, lifecycle snapshot, and redacted error contracts
- Beginner-oriented operator guidance for durable base-revision tracking, authenticated atomic RFC 9110 `If-Match`, conflict recovery, shutdown, privacy, and ownership boundaries

### Changed
- Package version **0.5.28**
- Concurrent nonterminal `flush()` calls now share one pending promise, bounding internal waiter retention independently of polling frequency
- The package build now emits dedicated `dist/cwl-autosave.js`, `dist/cwl-autosave.cjs`, and `dist/autosave/index.d.ts` artifacts
- Historical changelog entries through 0.5.27 moved intact to the versioned archive linked above

### Reliability
- Exactly one host save callback can be active; a newer revision can replace only not-yet-started work and never cancels or overlaps an active durable write
- Same-revision active and pending callers share one outcome; an idle revision is `unchanged` only while the queue still knows it is durably current and no active or pending write can replace it
- A conflict, callback failure, or invalid callback result invalidates the unchanged shortcut across `resume()` until a later host callback reports a successful durable save
- Conflict and failure pause automatic progression until an explicit host recovery decision
- `flush()` resolves at idle, blocked, or closed state rather than hanging for an external conflict decision; `close()` rejects new work while allowing active host transport to finish
- Queue memory is bounded to one active request, one pending request, and one shared pending flush promise

### Security
- Evidence and callback outcomes are validated fail-closed without evaluating accessors; hostile reflection failures become bounded redacted errors
- The public autosave boundary traverses candidate document JSON iteratively before scheduling, rejecting mutable nested nodes, accessors, symbols, non-finite numbers, unsupported prototypes, aliases, cycles, sparse arrays, excessive depth, and values beyond the active envelope resource ceiling
- Partially frozen look-alike evidence cannot enter the host callback and mutate after its strong revision was selected
- The queue includes no timer, network client, provider SDK, credential, tenant identifier, persistence adapter, React, TipTap, ProseMirror, or Yjs runtime dependency
- Revision tags remain tenant-confidential equality validators rather than authorization, signatures, tenant membership, or proof of durable persistence
- Hosts retain authentication, authorization, tenant isolation, transport, credentials, durable atomic base-revision comparison, migration, retention, audit storage, retry budgets, and conflict-resolution policy

### Performance
- Autosave coordination performs constant-space local scheduling and retains at most one pending full-document evidence value
- Matching active or pending revisions and concurrent flush callers avoid duplicate callback or internal waiter allocation
- Evidence inspection uses an iterative traversal bounded to the active envelope's 1,000,000-value and 128-level default ceilings, avoiding recursive call-stack growth on hostile inputs

### Tests
- Added deterministic single-flight, re-entrant enqueue, pending supersession, same-revision coalescing, durable-shortcut invalidation, last-saved ordering, blocked durable requeue, conflict pause/resume, callback failure recovery, invalid result, shutdown, frozen-value, hostile-reflection, bounded-flush-waiter, and repository-wide 100% production statement, branch, function, and line coverage verification
- Added realistic adversarial evidence tests for partially frozen document nodes, getters, reflection failures, aliases, cycles, sparse and accessor arrays, unsupported prototypes, non-JSON primitives, excessive depth, and the maximum JSON-value boundary
- Added exact packed-artifact ESM, CommonJS, and strict TypeScript consumers in an isolated temporary package tree without React, React DOM, TipTap, ProseMirror, or Yjs installed; the packed ESM consumer also proves that mutable nested evidence is rejected before transport

### Documentation
- Added the autosave architecture and doctoring record with APA 7th references to RFC 9110, RFC 8785, Herlihy and Wing (1990), and ISO/IEC 25010:2023
- Added an operator guide covering correct durable-base `If-Match` usage, local versus durable ownership, SSR/worker compatibility, observability minimization, and CWL/naruon modular integration boundaries

## Historical development note — Safe rich clipboard ingestion

The detailed notes below were maintained while the rich-clipboard work was targeting the future 0.6.0 line. The implemented behavior and its cross-engine release assurance are now summarized in the 0.6.0 release section above; this section remains historical engineering detail rather than a second release identity.

### Added
- Added a default `SafeClipboard` TipTap extension and `sanitizeRichClipboardHtml()` API that reconstruct browser-provided `text/html` through a strict semantic allowlist before ProseMirror parsing
- Added a registered TipTap v2.27.2 ProseMirror plugin adapter and public plugin key so SafeClipboard participates in the actual `transformPastedHTML` editor-property chain before parsing
- Added `clipboard` byte/node/depth limits and a live `onClipboardError` observer to standalone and provider-neutral Yjs editor surfaces
- Added operator guidance, design, implementation-plan, and APA 7th doctoring records for the clipboard trust boundary

### Changed
- Rich HTML pasted from Word, Google Docs, email, and web pages keeps supported structure and narrowly mapped bold/italic/underline/strike semantics while discarding arbitrary source styling and proprietary metadata
- Standalone and collaborative editors use one shared clipboard policy through `buildExtensions()`
- The runtime integration now uses the locked TipTap v2.27.2 `addProseMirrorPlugins` contract instead of relying on a manually invoked direct extension field that the installed v2 ExtensionManager does not register
- Nested clipboard policy objects use accessor-safe paste-time configuration validation at the exact rich-paste boundary
- Because default rich-HTML paste behavior changes, publication targets **0.6.0** only after a separate verified release pull request

### Security
- Active, embedded, form, metadata, media, SVG/MathML, template, resource-bearing, hidden, and HTML-image subtrees are removed before insertion
- Exact `content-visibility: hidden` subtrees are removed from bounded raw style declarations, including case, whitespace, terminal `!important`, CSS-comment, and CSS-escaped forms, while `visible`, `auto`, `hiddenly`, and prefixed property names remain visible
- Closed `details` elements preserve only their first rendered summary, closed `dialog` subtrees are removed, and open variants are unwrapped through the ordinary sanitizer
- Every subtree bearing a `popover` attribute is removed because static clipboard HTML cannot prove the source element's separate runtime showing state; empty, `auto`, `manual`, `hint`, and invalid-value forms are covered
- Native `progress` and `meter` widget subtrees and obsolete `noframes` and `noembed` fallback subtrees are removed
- Hidden `datalist` suggestion and down-level fallback subtrees are removed
- Raw `mso-hide` declarations are parsed with exact case-insensitive property/value matching, closed and EOF-terminated CSS-comment removal, optional terminal `!important`, and false-positive guards
- CSS-escaped property and keyword forms of `mso-hide: all` are decoded for exact comparison, while invalid or look-alike declarations remain visible
- SafeClipboard is the final ordinary TipTap paste transform through a low-priority ProseMirror plugin; a host that deliberately installs an even later transform remains outside the supported safety contract
- Unsafe and credential-bearing links are unwrapped while visible text remains; approved links retain only exact `href` and fixed `noopener noreferrer nofollow`
- IDs, classes, styles, event handlers, `data-*`, arbitrary ARIA, `contenteditable`, remote resources, local-file references, and Office/Google attributes never reach the output fragment
- UTF-8 bytes, traversed nodes, source depth, and configuration reflection are bounded and fail closed with static redacted errors
- Hostile direct-API `Document` accessors, proxies, and revoked proxies now fail closed as the stable `dom_unavailable` error before parsing, without exposing private capability exceptions

### Performance
- Accepted clipboard traversal is iterative and linear in the bounded source tree; defaults are 1 MiB, 10,000 nodes, and 64 levels
- The feature adds no runtime dependency and performs no network, storage, clipboard-permission, model, provider, credential, or database operation

### Tests
- Added realistic Word-like and Google-Docs-like fixtures, Office conditional comments, semantic conversion, structural, malformed, active-content, hidden-data, unsafe-link, resource-bound, hostile-configuration, DOM-unavailable, callback-failure, and error-redaction cases
- Added test-first regressions for closed interactive content, hidden popover state, native-widget fallback content, hidden `datalist` suggestions, `visibility: collapse`, and `content-visibility: hidden`
- Added a test-first direct-API regression proving hostile `createElement` and `implementation` property reads cannot leak arbitrary exception text
- Added RED integration commit `2e1d634bd819686b298256f9bac161e4f6e90067` and CI run `31172315841`, then real standalone, Yjs, competing-transform, and public-export tests against the complete ProseMirror paste pipeline
- Added standalone and Yjs integration tests, a 3,000-paragraph capacity fixture, final-transform ordering evidence, and repository-wide 100% production statement, branch, function, and line coverage gates
- Current jsdom results are not cross-engine browser evidence; version-pinned Chromium, Firefox, and WebKit differential fixtures remain a publication gate for 0.6.0

### Documentation
- Documented preserved and removed clipboard content, Base64Image handoff, SSR behavior, error codes, modular ownership, performance bounds, rollback, and buyer integration
- Documented `content-visibility: hidden` against CSS Containment Module Level 2, including exact raw-declaration matching, false-positive controls, test-first evidence, rollback, and the cross-engine assurance boundary
- Documented hidden popover content against the WHATWG runtime visibility-state model, including invalid-value behavior, deterministic loss boundary, test-first evidence, rollback, and cross-engine limitations
- Documented closed interactive, native-widget fallback, hidden suggestion-source, CSS escape, Office hidden-content, and final-transform composition decisions against primary specifications and official documentation
- Added an APA 7th doctoring record for DOM capability reflection redaction grounded in ECMAScript 2026 proxy abrupt-completion semantics, the WHATWG DOM capability surface, and OWASP generic-error guidance
- Added APA 7th doctoring for the TipTap v2.27.2 ProseMirror paste adapter, including locked-source authority, test-first root-cause evidence, priority ordering, residual host boundary, and rollback
