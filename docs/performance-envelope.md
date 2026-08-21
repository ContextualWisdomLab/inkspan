# Large-document performance baseline

Status: Proposed active-PR baseline for Issue #375; not a protected-main support claim

Protected `main` remains the implementation authority. This first slice adds a
deterministic, synthetic browser smoke for editor mount, snapshot, canonical
envelope serialization, and SHA-256 revision derivation across Chromium,
Firefox, and WebKit. It deliberately does not publish a maximum document size,
latency budget, memory ceiling, device support statement, or Office conversion
budget before repeated exact-head measurements exist.

## Corpus and privacy boundary

`tests/browser/performanceCorpus.ts` defines the versioned
`inkspan-large-document-v1` corpus with English, Korean, Japanese, Simplified
and Traditional Chinese, Vietnamese, headings, and deterministic paragraph
profiles. It contains no customer content, tenant identifiers, prompts,
credentials, comment bodies, or network-loaded resources.

The browser probe reports only profile identity, paragraph count, source length,
snapshot length, revision availability, and bounded elapsed-time measurements.
It never records document text, serialized envelopes, revision digests, or host
identity. Playwright attachments are measurement artifacts for the active run,
not release or telemetry authority.

## Measured operations

For each profile and browser engine, the smoke records:

- React editor mount through `CwlEditor`;
- detached snapshot generation;
- canonical envelope JSON serialization; and
- SHA-256 revision derivation.

The current gate checks that measurements are finite, non-negative, revision
derivation succeeds, and snapshot output is non-empty. It does not compare
against an invented threshold. A later baseline PR must add repeated samples,
p50/p75/p95/maximum aggregation, trusted input and IME operations, autosave,
collaboration, print, and Office measurements before proposing support budgets.

## Evidence boundary and next step

This is PR-CI smoke evidence only. It is not the protected release browser
evidence contract, and it does not establish support for a browser, device,
Node runtime, Python runtime, document size, or memory envelope. The next
version must bind repeated measurements to exact hardware/runtime/browser
identity and immutable fixture hashes, then propose an accepted ADR and
regression rule from observed data.

Event Timing is used only as standards context for why input latency should be
measured; its current document is a W3C Working Draft, not an Inkspan
certification threshold (World Wide Web Consortium, 2026). Tiptap's public DOCX
performance report is market evidence that large-document conversion warrants
measurement, not an Inkspan performance claim (Isik, 2025).

## References

Isik, P. (2025, June 24). *Faster, lighter, and more reliable DOCX
import/export with Tiptap*. Tiptap. https://tiptap.dev/blog/release-notes/faster-lighter-and-more-reliable-docx-import-export-with-tiptap

World Wide Web Consortium. (2026, March 19). *Event Timing API* (Working
Draft). https://www.w3.org/TR/event-timing/
