# Provider-neutral review contract

Status: Active PR / Proposed; not protected-main implementation authority

## Scope

The active review line adds a framework-independent `review` package surface and
an eventual controlled editor integration for inline comments, thread state, and
deterministic insert/delete suggestions. This document describes the target
contract; only the packed core contract and its source tests are evidence on the
current branch.

Inkspan owns deterministic projection interpretation, bounded validation,
revision binding, exact-once local operation state, and compact before/after
transition evidence. The host owns comment bodies, durable thread and
suggestion records, identity, authorization, tenant isolation, persistence,
notifications, collaboration-provider lifecycle, audit, and cross-revision
re-anchoring.

## Versioned core

`@contextualwisdomlab/cwl-editor/review` exposes
`https://inkspan.io/schemas/review/v1`. A target contains one immutable SHA-256
document revision, the existing W3C `TextPositionSelector` shape, and the
`inkspan-prosemirror-text` projection identity. Insert suggestions require an
empty range; delete suggestions require a non-empty range. Identifiers, text,
thread counts, and reply counts are bounded. Accessors, exotic prototypes,
unsupported projections, malformed revisions, and invalid state transitions
fail closed with redacted error codes.

Accepting a pending suggestion must change the editor document. Rejecting one
must preserve the document revision. If the observed revision differs from the
suggestion's expected revision, the operation returns `stale` without silently
re-anchoring. Operation results contain revisions and compact transition
evidence, never document or comment bodies.

The projection helper is intentionally not an editor transaction. The editor
integration must capture one immutable revision, apply a deterministic
ProseMirror transaction, and bind the resulting envelope pair through the
operation-result helper. Host persistence remains outside this contract.

## Interactive target

The planned React surface accepts host-supplied thread/suggestion metadata and
host callbacks for refresh, operation result handling, and failures. Inline
markers and a review panel must expose state without color alone, support
keyboard navigation and screen-reader names, remain usable at narrow/mobile
widths, and hide non-document controls in print output. Stale operations are
disabled or reported as stale; they are never locally re-anchored.

The acceptance slice must include exact-once accept/reject behavior, undo/redo,
concurrent stale protection, keyboard and Chromium/Firefox/WebKit checks,
packed consumers, a React-free core, and full statement/branch/function/line
coverage plus public TSDoc. The repository-rendered equivalent fixture is
`src/components/ReviewPanel.fixture.tsx`, with pending insert/delete, resolved,
and empty states covered by `ReviewPanel.fixture.test.tsx`. The pinned
cross-engine browser harness exercises the actual panel through
`tests/browser/specs/review.browser.spec.ts`. No Figma artifact is claimed
because no Figma file was used for this implementation.

## Research and standards basis

The W3C model treats a text-position selector as an inclusive-start,
exclusive-end range and warns that position selectors are brittle when the
underlying resource changes; Inkspan therefore binds the selector to an exact
revision and refuses implicit re-anchoring (World Wide Web Consortium, 2017).
Current editor products demonstrate the buyer expectation of sidebar/inline
review surfaces and individually accept/rejectable suggestions, but their
server, comments, and collaboration services are not Inkspan dependencies
(CKSource, n.d.; Tiptap, n.d.-a, n.d.-b).

### References

CKSource. (n.d.). *Track changes overview*. CKEditor 5 documentation. Retrieved
August 20, 2026, from
https://ckeditor.com/docs/ckeditor5/latest/features/collaboration/track-changes/track-changes.html

Tiptap. (n.d.-a). *Integrate comments into your editor*. Retrieved August 20,
2026, from https://tiptap.dev/docs/editor/extensions/functionality/comments

Tiptap. (n.d.-b). *Comments*. Retrieved August 20, 2026, from
https://tiptap.dev/docs/comments/getting-started/overview

World Wide Web Consortium. (2017, February 23). *Web Annotation Data Model*.
https://www.w3.org/TR/annotation-model/
