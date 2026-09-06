# Captured-input identity for performance evidence

Status: Research only; active PR #379, not protected-main implementation  
Date: 2026-09-06  
Owner: [performance support-envelope issue #375](https://github.com/ContextualWisdomLab/inkspan/issues/375)

## Problem and decision

A document profile alone does not identify the workload. The direct latency
commands accepted different input files under the same profile while their
receipts identified only the source, artifact, runtime and reference hardware.
Two such summaries could therefore appear comparable despite measuring different
documents. The locked synthetic suite already checked its fixtures; this defect
was at the direct producer/summary/comparison boundary.

Version 3 derives an input SHA-256 from the already bounded read before calling
the measured operation. Changed transitions retain ordered previous and resulting
input identities. The summarizer preserves them and the comparator rejects a
mismatch before computing a regression or improvement. SHA-256 identifies bytes;
it does not establish workload realism, confidentiality, authenticity or runtime
correctness (National Institute of Standards and Technology [NIST], 2015).

The implementation reuses the existing Node crypto module. Its hash API accepts
byte buffers directly, avoiding a decode/re-encode step that could discard a
UTF-8 byte-order mark (Node.js, n.d.). Hashing is outside the existing timer;
first-invocation accounting, sample counts and scenario assertions are unchanged.

## Alternatives and failure prevention

- Caller-supplied digests were rejected because they repeat the unverified claim.
- Hashing a second file read was rejected because the file can change after the
  operation's input is captured. A regression test replaces it during module
  loading and requires the original captured identity.
- Adding optional fields to version 2 was rejected because old readers could
  compare evidence without enforcing input identity. Versions 1 and 2 keep their
  original shapes and meanings; cross-version comparisons remain prohibited.
- No-file autosave hashes the actual prepared synthetic revision-evidence payload
  (envelope plus revision). Hashing just its envelope would confuse this distinct
  preparation with file-mode envelope input. A fixture captures the value passed
  to the queue and verifies its identity.

Malformed, missing, extra, legacy-backfilled and identical changed-transition
identities fail closed. No document contents or paths are added to receipts.
Digests are not anonymization: private or guessable inputs must not be published
merely because their content was replaced by a hash.

## Evidence lineage

Local retained evidence directory:
`/private/tmp/inkspan-input-identity-evidence.3O7Jac`.

| Source revision | Experiment | Result and scope |
| --- | --- | --- |
| `69bdcc5c4d8ba757fb84d6e96c77fb2704cecf7c` | Three producer contracts | 6 failed identity checks, 29 passed; `producers-identity-red-69bd.log` |
| `ce48badc22ecf45cec8ff3f14e40a323deaae0fc` | Five-file chain RED | 27 failed, 58 passed; 7 failures were incorrect new directory-absence assertions, subsequently corrected to require no evidence files; `chain-identity-red.log` |
| `c4fba276b1ea8725a61f354bc0c3e26c58aa6c54` | Six focused files | 86 passed; `chain-identity-green.log` |
| `b866a1d5815bdbd2d6f3ba4091bd945b30f43cdc` | Captured/prepared input distinction | 1 synthetic-payload identity failure, 13 passed; `captured-input-red.log` |
| `c7d829d91057d2d307133f3038c818ab5f602283` | Same captured/prepared checks | 14 passed; `captured-input-green.log`; TypeScript check also passed |
| `c7d829d91057d2d307133f3038c818ab5f602283` | All 41 performance files, two workers | 158 passed, 8 failed, 1 worker RPC error; `all-performance-c7d829.log`, 325.70 seconds. Failures include unchanged test/subprocess deadlines and three null child exit statuses; this is not complete acceptance |

These are harness correctness experiments, not latency improvements. Broader
acceptance must use the final exact head and retain every failed denominator.
Historical samples are neither rewritten nor backfilled. The immutable source
commits preserve the changes even if the local temporary evidence expires.

Run the directly affected checks from the repository root:

```sh
pnpm exec vitest run src/performanceMarkdownMeasurementContract.test.ts src/performanceRevisionMeasurementContract.test.ts src/performanceAutosaveMeasurementContract.test.ts src/performanceHtmlSerializationMeasurement.test.ts src/performanceMeasurementStatisticsContract.test.ts src/performanceRegressionComparatorContract.test.ts --maxWorkers=2
```

## Remaining work and authority

A real-workload corpus, fresh same-generation baselines, profiling and verified
optimizations remain necessary. This change does not prove the 20 ms target,
supported document sizes, browser interaction latency or release acceptance.
The corpus lock and suite inventory keep their independent version 1 contracts.
No editor API, host authority or accepted ADR changes. See the
[harness contract](../../benchmarks/README.md), [TRD](../TRD.md) and
[buyer gap](../product-technical-gap-baseline.md).

## References

National Institute of Standards and Technology. (2015). *Secure Hash Standard
(SHS)* (FIPS PUB 180-4). https://doi.org/10.6028/NIST.FIPS.180-4

Node.js. (n.d.). *Crypto: Hash update and digest*. Node.js v24 documentation.
Retrieved September 6, 2026, from https://nodejs.org/docs/latest-v24.x/api/crypto.html#hashupdatedata-inputencoding
