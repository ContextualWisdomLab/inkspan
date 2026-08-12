# Writing Diagnostics v1 Implementation Plan Errata

Status: Required companion to `2026-08-12-writing-diagnostics-implementation.md`

ADR 0028 resolves two contradictions discovered after the original atomic implementation plan was written. Every remaining task and acceptance review must apply this errata. Task 10 must fold these corrections into the canonical ADR, design, plan, PRD, TRD, contracts, threat model, operability, traceability, and CHANGELOG so the final protected-main documentation has no parallel instruction set.

## Global lifecycle correction

The following rule replaces every original-plan or design clause that permits transaction-local preservation, mapping, remapping, repair, or re-admission of an existing diagnostic:

> Any local or collaborative transaction with `docChanged === true` invalidates the complete active diagnostic generation. Version 1 never preserves or remaps a diagnostic across changed document content. A host must submit a new set bound to the new exact revision.

ProseMirror mapping may be used internally for ordinary editor behavior, but it is not evidence that a model judgment still targets the same meaning and is not diagnostic admission authority.

## Task 3 correction: decoration attributes

Replace the proposed attribute set with:

```text
class="cwl-writing-diagnostic cwl-writing-diagnostic--{priority}"
data-cwl-diagnostic-id="opaque-id"
```

Do not add `aria-invalid`, spelling/grammar state, category semantics, title, explanation, replacement, confidence, provenance, model output, or HTML to decoration attributes. `categoryCode` remains opaque; it cannot be matched against words such as `spelling`, `grammar`, or `mechanics` to derive behavior or ARIA state.

Task 3 tests must include attacker-controlled, multilingual, and lookalike category codes and prove identical semantic-neutral decoration handling.

## Task 4 correction: controller state

The controller's transaction subscriber invalidates both `verifying` and `active` generations before stale asynchronous work can publish. It does not map verified ranges after any document change. All old digest/selector completions are generation-fenced and discarded.

## Task 5 correction: accessible panel

The named panel is the semantic accessibility surface. It exposes category, priority, title, explanation, count, ordered position, affected-range navigation, and explicit Apply/Ignore/Dismiss/Explain actions as React text and native controls.

- Do not infer semantic ARIA state from `categoryCode` or any other host text.
- Do not place selected source text in action names or attributes.
- New asynchronous diagnostics do not move focus.
- Previous/next navigation is explicit and roving; no undocumented global shortcut is added.
- Ordinary action completion uses a polite status region.
- An assertive alert is reserved for an actual application conflict.
- Information remains available without color, hover, pointer input, animation, or generated CSS content.

## Task 6 correction: application

Apply rechecks the exact current document revision immediately before the ordinary ProseMirror transaction. A stale generation cannot be rescued through range mapping or text search. A successful application invalidates all remaining diagnostics and produces a newly derived resulting revision.

## Task 7 correction: collaboration

Every remote Yjs document change invalidates the complete local diagnostic generation. A relative position or mapped ProseMirror position is not proof that the host judgment remains semantically current. Awareness payloads never carry diagnostics or review state.

## Task 9 correction: assurance

Cross-engine and hostile-input evidence must prove:

- strict invalidation after every local or remote document change;
- no nearest-text, quote, keyword, category, or transaction-mapping recovery;
- no semantic ARIA derivation from opaque host fields;
- accessible information remains present through the panel and native actions;
- no diagnostics are produced when the host supplies none.

## Task 10 reconciliation requirement

Before the feature stack can become Ready, the original ADR 0027 and design/plan prose must be edited so they directly express ADR 0028. This errata is temporary planning evidence, not the desired final duplicate source of truth. The final documentation contract tests must fail if either of the superseded claims reappears:

1. a diagnostic can survive `docChanged` through transaction mapping; or
2. Inkspan derives `aria-invalid` or other semantic state from an opaque category string.

## Acceptance impact

Existing Task 1–4 runtime direction is compatible with this correction. Downstream Task 5–12 branches must be based on exact predecessor heads that contain or explicitly consume this errata, and all exact-head CI/review evidence must be regenerated after any affected branch is refreshed.
