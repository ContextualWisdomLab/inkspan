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

New JavaScript latency samples use `contractVersion: 2` to identify this
first-invocation method. The summarizer preserves that version in JSON and
prints `contract_version` in its text receipt. Version 1 inputs remain readable
as legacy evidence, including Office output, but the comparator rejects a
version 1 / version 2 pair before calculating any improvement or regression.
Older version-1-only consumers reject new samples; update the evidence tools
together. Do not relabel historical samples or assume their invocation
accounting. The suite inventory and corpus locks retain their independent
version 1 contracts; this version change does not alter their shapes or the
published editor API.

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
