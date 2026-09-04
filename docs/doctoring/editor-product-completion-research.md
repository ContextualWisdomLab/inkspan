# Editor product-completion research

Status: Proposed doctoring evidence — 2026-08-20  
Protected implementation baseline: `main@3b38ead2d00f44eb578d0689087b9293b3dabe1e`  
Active planning writer: PR [#372](https://github.com/ContextualWisdomLab/inkspan/pull/372)

## Purpose

This record compares Inkspan's protected product promise, published package
surface, tests, executable examples, current pull-request queue, and buyer
workflows against current standards and public product evidence. It identifies
which missing capabilities are credible product gaps and which apparent gaps
would violate Inkspan's existing authority boundary.

This document is planning and traceability evidence. It does not prove that any
new capability is implemented, protected, published, certified, or supported.
Protected `main` remains the only implementation authority. Active pull requests
and issues remain proposals until they integrate through current governance and
the resulting package artifacts are verified.

## Evidence hierarchy and method

The research used this evidence order:

1. protected Inkspan source, public package metadata, canonical documents, and
   executable tests;
2. exact current pull-request metadata, changed paths, reviews, and workflow
   results;
3. W3C Recommendations and explicitly identified W3C Working Drafts;
4. public vendor documentation as evidence of buyer workflows and market
   expectations, never as proof of Inkspan behavior or performance.

Vendor claims are not imported as Inkspan acceptance thresholds. Inkspan must
establish its own support envelope from reproducible exact-head measurements.
A Working Draft is cited as work in progress rather than represented as a
certification target.

## Protected-product observations

### Review evidence exists, but a review workflow does not

The protected PRD names authors and reviewers and already scopes selection and
annotation evidence to exact canonical document revisions. Inkspan also exposes
a W3C `TextPositionSelector` projection. The host deliberately owns durable
annotation identifiers, comment bodies, authentication, authorization,
persistence, moderation, notification, retention, and cross-revision
re-anchoring.

That boundary is sound, but the protected public package has no provider-neutral
review subpath, comment/suggestion presentation surface, deterministic
accept/reject transaction, or executable revision-comparison journey. Buyers
must currently build the complete reviewer interaction layer themselves.

The W3C Web Annotation Data Model provides an interoperable model for an
Annotation, Body, Target, selector, and state without prescribing a transport or
persistence service. That is compatible with an Inkspan-owned validation and UI
surface plus host-owned durable storage and policy. Public Tiptap and CKEditor
documentation also treats comments, tracked changes, and revision history as
coherent review workflows. These vendor references establish market relevance;
they do not define Inkspan's implementation.

Result: issue [#374](https://github.com/ContextualWisdomLab/inkspan/issues/374)
owns the proposed provider-neutral comments, suggestions, and revision-review
vertical.

### Correctness gates exist, but a supported performance envelope does not

Protected Inkspan has extensive deterministic correctness, browser, package,
Office, security, and coverage evidence. It does not have one canonical
large-document corpus or an accepted latency, throughput, peak-memory, leak, or
gracious-rejection support contract for editor mount, input, serialization,
revision evidence, autosave, collaboration updates, or Office conversion.

The W3C Event Timing API defines browser-observable interaction latency from
trusted input through the following paint. It is a current Working Draft and is
useful as a measurement mechanism, not as a certification. Public Tiptap
conversion release notes show that large-document memory and latency are buyer
and retention concerns, but their vendor measurements cannot become Inkspan
claims.

Result: issue [#375](https://github.com/ContextualWisdomLab/inkspan/issues/375)
owns a deterministic benchmark corpus, support envelope, regression rule, and
root-cause optimization lane.

### Multilingual typography exists, but CJK input support is not proven

Inkspan bundles offline Korean, Japanese, Simplified and Traditional Chinese,
Vietnamese, and Latin fonts. Protected browser evidence covers important desktop
boundaries, but repository searches found no explicit composition-event
contract, CJK IME regression corpus, mobile/touch acceptance lane, or real-device
support record.

Typography coverage is not input-method correctness. Rich-text transactions,
controlled value updates, autosave, Yjs updates, toolbar actions, and undo/redo
can interact with an active composition session. A product can render Korean or
Japanese correctly while still losing, duplicating, reordering, or prematurely
persisting composed text.

Input Events Level 2 defines the evolving `beforeinput`, `input`, and composition
semantics and is a Working Draft. Pointer Events Level 3 is a W3C
Recommendation for hardware-agnostic pointer input. WCAG 2.2 Success Criterion
2.5.8 provides the applicable 24-by-24 CSS pixel target-size or spacing
requirements and defined exceptions for touch-oriented controls.

Result: issue [#376](https://github.com/ContextualWisdomLab/inkspan/issues/376)
owns the cross-engine CJK IME, touch, mobile, and truthful support-matrix lane.

### Package contracts are rich, but the executable host example is too narrow

The current `demo/App.tsx` imports `../src/index.js` and demonstrates controlled
Markdown/HTML editing and image rejection. It does not install the packed
artifact or exercise the integration paths most likely to fail in production:
SSR and hydration, native forms, strong-validator autosave, conflicts,
host-owned Yjs provider lifecycle, read-only transitions, delayed model
proposals, reconnect and teardown, package CSS/fonts, and Office/converter
handoff.

Inkspan's existing host/editor authority split should not be widened merely to
make a demo convenient. A reference application can prove the boundary while
using replaceable synthetic adapters and explicitly refusing production claims
for identity, persistence, collaboration authorization, or model access.

Result: issue [#377](https://github.com/ContextualWisdomLab/inkspan/issues/377)
owns an executable packed-package reference host and acquisition-readable
integration evidence.

## Gap and issue traceability

| Priority | Buyer problem | Protected observation | Owning issue | Smallest credible result |
| --- | --- | --- | --- | --- |
| P0 | A verified installable stable package is unavailable through the promised release path | Source versions are `0.6.0`, while stable publication and public digest/provenance acceptance remain open | [#118](https://github.com/ContextualWisdomLab/inkspan/issues/118) plus its existing PR lanes | Exact protected release, registry publication through supported identity, public digest and provenance verification |
| P0 | Current shipped accessibility and dependency findings remain unresolved on protected `main` | Repairs exist on active PRs, not protected implementation | [#362](https://github.com/ContextualWisdomLab/inkspan/pull/362), [#373](https://github.com/ContextualWisdomLab/inkspan/pull/373) | Qualifying review, exact-head checks, protected integration, regenerated release evidence |
| P1 | Reviewers cannot complete comments and suggestion acceptance through a reusable Inkspan surface | Revision/selector evidence exists; review workflow does not | [#374](https://github.com/ContextualWisdomLab/inkspan/issues/374) | React-free review contract plus accessible host-controlled comment/suggestion UI and deterministic accept/reject |
| P1 | Buyers cannot size or procure Inkspan for large documents | No published or gated support envelope | [#375](https://github.com/ContextualWisdomLab/inkspan/issues/375) | Synthetic benchmark corpus, exact-head budgets, graceful rejection, scheduled regression evidence |
| P1 | CJK and mobile authoring claims exceed current input evidence | Fonts exist; composition/mobile assurance does not | [#376](https://github.com/ContextualWisdomLab/inkspan/issues/376) | Cross-engine composition tests, periodic real-device evidence, touch accessibility, truthful support matrix |
| P1 | Buyers must infer integration correctness from prose and a source-relative demo | Demo does not install the packed artifact or exercise host lifecycle conflicts | [#377](https://github.com/ContextualWisdomLab/inkspan/issues/377) | Packed-package Next.js reference host with SSR, autosave, conflict, Yjs lifecycle, forms, and stale proposal paths |
| P2 | Broader Office authoring/import workflows are not protected | Existing Draft PRs already own DOCX, HWP/HWPX, and spreadsheet imports | [#323](https://github.com/ContextualWisdomLab/inkspan/pull/323), [#320](https://github.com/ContextualWisdomLab/inkspan/pull/320), [#318](https://github.com/ContextualWisdomLab/inkspan/pull/318) | Integrate one bounded format at a time with realistic fixtures and exact package evidence |
| P2 | Host-supplied writing diagnostics are not shipped | Existing stacked PRs already own the bounded diagnostics architecture and implementation | [#248](https://github.com/ContextualWisdomLab/inkspan/pull/248) and its stack | Resolve stack evidence and integrate dependency-first without adding model/provider authority |

## Design and standards interpretation

### Web Annotation is an interchange model, not an Inkspan database mandate

Inkspan can project review targets through W3C annotation selectors while the
host retains bodies, identities, authorization, persistence, legal hold, and
notification. A review package should therefore validate and render bounded
host-supplied data rather than creating hidden application authority.

### Input Events is an evolving interoperability reference

The composition lifecycle from Input Events Level 2 should guide tests and
contract wording. Because the document is a Working Draft, Inkspan must pin the
browser behavior it actually verifies and publish known divergences. It must not
claim standards certification merely because event names match a draft.

### Pointer and accessibility standards constrain mobile UI

Pointer Events supports mouse, touch, and pen through one event model. WCAG 2.2
SC 2.5.8 constrains the size or spacing of Inkspan-owned interactive targets.
These standards do not prove that a desktop emulation reproduces a real mobile
IME; real-device evidence remains a separate support requirement.

### Event Timing supplies measurements, not favorable budgets

Event Timing can collect trusted input latency. Initial Inkspan benchmarks must
determine the supported document profiles and budgets. A later regression may
not be hidden by silently increasing a threshold; a deliberate budget change
requires evidence and buyer-impact review.

## Deliberate non-gaps and exclusions

The research does not recommend the following as product-completion work:

- an Inkspan-owned application database, identity provider, tenant directory,
  notification service, or durable annotation store;
- an embedded collaboration credential, room-authorization service, or
  provider-specific runtime;
- an embedded LLM provider, API key, model router, prompt store, or semantic
  fallback for writing diagnostics;
- a new server-side PDF service merely because print output exists. Accepted
  ADR 0021 deliberately limits protected Inkspan to its shipped CSS paged-media
  boundary; durable PDF authority requires a separate buyer requirement and a
  superseding ADR;
- duplicate DOCX, HWP/HWPX, spreadsheet, diagnostics, release, or stacked-CI
  Issues while existing active owners remain open;
- a Figma File ID that does not correspond to an actual Figma artifact. If
  accepted UI design work uses Figma, the accepting ADR must record the real
  File ID before calling that design contract complete;
- Rust, GPU, or a new compute service without profiling evidence for an
  Inkspan-owned workload, an architecture decision, portability analysis, and
  parity tests.

## Canonical-document impact of future implementation

Every issue above must update only the canonical records its durable contract
changes:

- #374: PRD, TRD, contracts, architecture, data model, threat model,
  accessibility, package distribution, UML, Storybook inventory, and a new ADR;
- #375: operability, test strategy, performance evidence, support matrix,
  release acceptance, and an ADR defining budgets and change control;
- #376: accessibility, browser/device support, collaboration/autosave behavior,
  test strategy, Storybook responsive states, and an input-lifecycle ADR;
- #377: package distribution, integration guide, architecture ownership diagram,
  operability, test strategy, and the executable example itself.

No issue may mark a protected capability complete merely because its design
record or local tests exist. Protected integration, exact-head governance, and
published artifact evidence remain separate gates.

## References — APA 7th

CKEditor. (n.d.). *Revision history*. Retrieved August 20, 2026, from
https://ckeditor.com/docs/ckeditor5/latest/features/collaboration/revision-history/revision-history.html

CKEditor. (n.d.). *Track changes*. Retrieved August 20, 2026, from
https://ckeditor.com/docs/ckeditor5/latest/features/collaboration/track-changes/track-changes.html

Isik, P. (2025, June 24). *Faster, lighter, and more reliable DOCX import/export
with Tiptap*. Tiptap. https://tiptap.dev/blog/release-notes/faster-lighter-and-more-reliable-docx-import-export-with-tiptap

Tiptap. (n.d.). *Tracked changes with comments*. Retrieved August 20, 2026, from
https://tiptap.dev/docs/tracked-changes/guides/comments-integration

World Wide Web Consortium. (2017). *Web Annotation Data Model*.
https://www.w3.org/TR/annotation-model/

World Wide Web Consortium. (2024). *Web Content Accessibility Guidelines
(WCAG) 2.2*. https://www.w3.org/TR/WCAG22/

World Wide Web Consortium. (2026, March 19). *Event Timing API* (Working Draft).
https://www.w3.org/TR/event-timing/

World Wide Web Consortium. (2026, May 1). *Input Events Level 2* (Working Draft).
https://www.w3.org/TR/input-events-2/

World Wide Web Consortium. (2026, June 30). *Pointer Events Level 3*.
https://www.w3.org/TR/pointerevents3/
