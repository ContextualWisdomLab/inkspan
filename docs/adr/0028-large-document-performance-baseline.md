# ADR 0028: Large-document performance baseline before support budgets

- Status: Proposed
- Date: 2026-08-21
- Owners: Inkspan editor/conversion maintainers
- Scope: Issue #375 PR-CI baseline only

## Context

Inkspan has correctness, package, browser, coverage, and deterministic
conversion checks, but protected `main` does not publish a measured large-
document latency or memory envelope. A favorable threshold chosen before a
reproducible baseline would be an unsupported buyer claim and could hide a
regression.

## Alternatives considered

1. Publish a document-size or 100 ms budget immediately. Rejected because no
   repeated exact-head hardware/runtime baseline exists.
2. Add an unbounded benchmark that records complete document bodies or host
   metadata. Rejected because benchmark evidence must remain synthetic and
   privacy-minimized.
3. Add a bounded synthetic browser smoke and defer budgets until measurements
   exist. Selected because it establishes the executable path with minimal new
   authority.

## Decision

The initial performance lane uses a versioned synthetic multilingual corpus and
the packed-package browser harness to measure editor mount, detached snapshot,
canonical envelope serialization, and revision derivation in Chromium, Firefox,
and WebKit. It records only profile/count/length/timing metadata in test
attachments. The smoke requires finite non-negative measurements and successful
revision derivation but accepts no performance threshold.

Future budgets require repeated samples, named hardware and runtime profiles,
operation-specific p50/p75/p95/maximum values, peak-memory methodology where
trustworthy, and an explicit regression rule. They must be proposed in a later
ADR update rather than inferred from this smoke.

## Consequences

The repository gains a repeatable multilingual browser measurement path without
making a new runtime or package API. Buyers receive an executable baseline
signal, while a supported large-document envelope remains intentionally
unclaimed until stronger evidence exists.

## Failure and recovery

An unavailable benchmark operation must fail the active evidence run rather
than become an unmeasured success. A runner failure is an evidence failure, not
proof that Inkspan supports the profile. Maintainers rerun the same exact
source and corpus or record the environment defect before changing the
contract.

## Security and privacy impact

Inkspan owns deterministic local measurement of its editor/conversion calls.
Hosts own production telemetry, document classification, tenant policy,
authorization, retention, and any durable benchmark storage. The corpus and
attachments contain no customer content, credentials, prompts, comment bodies,
revision digests, or network authority. No benchmark code adds transport,
persistence, model, provider, or database authority.

## Compatibility and migration

The smoke uses existing public editor handles and does not change runtime
document semantics or package exports. A browser runner that cannot execute the
probe fails the active PR check; it is not treated as an unmeasured success. If
the corpus or measured operation changes, increment the corpus/contract record
and regenerate evidence on the exact source head. No document-schema or package
migration is introduced by this baseline.

## Verification

- `tests/browser/performanceCorpus.ts` is deterministic and multilingual.
- `tests/browser/harness.ts` measures the real `CwlEditor` and handle path.
- `tests/browser/specs/performance.browser.spec.ts` runs the profiles through
  dependency-locked Chromium, Firefox, and WebKit with external requests
  blocked.
- Existing TypeScript, Vitest, package, and release browser documentation
  contracts remain required.

## Rollback or supersession

Remove or supersede this Proposed baseline if a later accepted performance
contract replaces it. Rolling back the smoke must not be described as evidence
of a supported performance envelope; the remaining correctness and release
gates continue to apply.

## Research basis

World Wide Web Consortium. (2026, March 19). *Event Timing API* (Working
Draft). https://www.w3.org/TR/event-timing/

Isik, P. (2025, June 24). *Faster, lighter, and more reliable DOCX
import/export with Tiptap*. Tiptap. https://tiptap.dev/blog/release-notes/faster-lighter-and-more-reliable-docx-import-export-with-tiptap
