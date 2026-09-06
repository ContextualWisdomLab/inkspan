# Canonical encoder source reconciliation

Status: Active PR / Proposed. Recorded 2026-09-05; not protected-main or release evidence.

## Problem and retained change

Performance PR #379 retained commit `9258bdbdf8ec8ca87ab25b576fe2599c88ba9040`, which reused the native UTF-8 encoder. Canonical source owner #176 subsequently added bounded output and hostile-option validation to the same function. Their merge preflight reported one conflict in `src/documentEnvelopeCanonical.ts`.

The source owner now incorporates the original reuse delta while preserving both output-size checks and the complete option/Unicode validation paths. The public encoder, revision generation and editor byte export share that internal boundary. Benchmark infrastructure remains in #379; it does not move into the source owner. Reconciliation uses ordinary history and explicit source resolution, not a force push or dropped delta.

## Safety and alternatives

WHATWG's Encoding Standard specifies per-call output and no streaming scalar buffer for `TextEncoder`. Reusing the encoder therefore needs no document cache, shared output buffer, extra dependency or custom codec. Native `encode()` still returns a separate byte array per call. Reuse occurs within each loaded module instance, not across workers or processes.

Retaining per-call construction would drop the earlier accepted optimization; importing the whole performance branch into the source owner would mix unrelated responsibilities. A shared byte-buffer pool was rejected because it could corrupt outstanding digest input and adds lifetime coordination absent from native encoding. Import-time construction assumes the native Encoding API available in the supported runtime; packed ESM/CJS/SSR and actual browser checks must verify that boundary.

The added regression first failed on different encoder receiver identities. It also checks identical canonical bytes, distinct output buffers and preservation of the second result after mutating the first. Existing tests retain early oversize rejection before byte allocation, exact UTF-8 byte limits, hostile option descriptors, lone surrogates, canonical ordering and revision parity.

## Evidence limits and continuation

The [original retained experiment](https://github.com/ContextualWisdomLab/inkspan/pull/379#issuecomment-5547196070) reported an 8.7% lower median p95 for its locked synthetic **no-op** transition on the earlier unbounded source. This is historical local evidence only. It does not transfer to the current bounded implementation, changed-transition scenario, real editor interaction, protected hardware or the 20 ms target. The separate rejected container-concatenation experiment remains rejected.

After normal owner integration, #379 must inherit the owner and reacquire clean exact-source, artifact and scenario-bound evidence. Reviews/checks and parent-before-child protected integration remain required; source reconciliation is not product acceptance.

## References

WHATWG. (2026, May 21). *Encoding: Interface TextEncoder* [Living standard]. https://encoding.spec.whatwg.org/#interface-textencoder
