# Performance evidence development harness

This harness is research infrastructure, not a published latency or supported
document-size guarantee. The generated corpus is synthetic and suitable for
repeatable regression probes and harness contract tests. It does not establish
buyer-workload performance, real-device input behavior, or the 20 ms target.
Envelope fixtures contain plain paragraphs; Markdown list, table, and image
syntax inside those paragraphs is not a rich editor document tree.

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
