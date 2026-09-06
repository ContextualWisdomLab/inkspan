# Performance evidence development harness

This harness is research infrastructure, not a published latency or supported
document-size guarantee. The generated corpus is synthetic and suitable for
repeatable regression probes and harness contract tests. It does not establish
buyer-workload performance, real-device input behavior, or the 20 ms target.
Envelope fixtures contain plain paragraphs; Markdown list, table, and image
syntax inside those paragraphs is not a rich editor document tree.

## First-invocation accounting

The revision, Markdown/HTML, and autosave latency producers record the first
operation invocation and every subsequent requested sample, without an
unrecorded warmup invocation. Each result must pass its scenario checks before
samples can be published. Module loading and input preparation remain outside
the timer; autosave queue setup and coalescing-scenario preparation retain
their existing timer boundaries. This is not process-startup latency.

Samples recorded before this change retain their original meaning. Start a
new baseline for the new measurement method; a difference between those
generations is not evidence of a product speedup. Keep each generation's raw
samples and exact source revision. Office rendering and the separate memory
settling analysis are unchanged.

Version 2 introduced this first-invocation method. New JavaScript latency samples
use `contractVersion: 3` and additionally identify the captured input bytes with
`inputSha256`. The digest is derived before measurement from the same bounded
read used by the operation, not a caller-supplied claim or a later file read.
Changed transitions also record `resultingInputSha256` in its distinct resulting
role. Autosave with no input file hashes the UTF-8 JSON representation of its
fixed synthetic envelope; that input remains synthetic regardless of profile.
Input digests are workload identifiers, not anonymization or authenticity proofs.

The summarizer preserves these identities in JSON and text. The comparator
rejects different versions or input identities before calculating a verdict,
even when document profiles match. Versions 1 and 2 remain readable with their
original meanings; Office output remains version 1. Do not backfill identities,
relabel historical samples, or present a cross-generation difference as a
speedup. Update producers and evidence readers together. The suite inventory and
corpus locks retain their independent version 1 contracts; published editor APIs
and timer boundaries are unchanged. This does not establish a real-world corpus.

## Transition scenarios

| Operation | Inputs | Required result | Metric prefix |
| --- | --- | --- | --- |
| `transition` | Same captured envelope twice | Unchanged, equal revision digests | `transition-evidence` |
| `transition-changed` | Explicit previous and resulting envelopes | Changed, unequal revision digests | `transition-changed-evidence` |

The profile suffix remains `small`, `medium`, `large`, or `stress`. Existing
transition samples retain their no-op meaning. Never compare the two scenarios
as an optimization result; the comparison tool rejects mismatched metric IDs.

For `measure-revision-evidence.mjs`, append
`--operation transition-changed --resulting-input <resulting-envelope.json>`
immediately before `--output`. Other operations reject `--resulting-input`.
Both inputs use the same bounded, non-symlink file reader. An output cannot
overwrite either input, including through a hard link. Invalid results publish
no sample file, and sample output contains neither document content nor paths.

The packed `run-current-suite.mjs` accepts `--resulting-input` immediately before
`--output`, with or without `--html-input`. It verifies the resulting fixture
against `changedEnvelopeBytes` and `changedEnvelopeSha256` in `corpus.lock.json`.
The generator adds one plain paragraph to produce each
`<profile>.changed.envelope.json`; all earlier fixture bytes and digests remain
unchanged. Omitting the new flag preserves the earlier suite. The
`performance-evidence.yml` workflow exercises both transition scenarios.

Commit a clean source checkout and rebuild the package before recording evidence.
Keep raw samples with the exact source SHA, packed-artifact digest, Node runtime,
hardware identity, and sample count. A new scenario starts a separate baseline;
synthetic smoke evidence cannot close the realistic-workload support-envelope gap.
