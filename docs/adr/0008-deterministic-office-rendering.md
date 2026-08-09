# ADR 0008: Deterministic Office rendering boundary

Status: Proposed

## Context

Enterprise buyers need DOCX, XLSX, and PPTX output that is reproducible and testable without model inference, Desktop Office automation, macros, or hidden network access. Office formats also introduce formula injection, XML/package validity, resource exhaustion, and file-publication hazards.

## Alternatives considered

- Automate Desktop Office/LibreOffice during production rendering. Rejected because it adds desktop-runtime, macro, platform, and hidden-network authority and weakens deterministic packaging.
- Let an LLM emit Office XML/packages directly. Rejected because output structure and safety would become model-dependent and difficult to bound or reproduce.
- Render a strict versioned JSON-compatible request through bounded local libraries and explicit publication semantics. Selected because it keeps supported fidelity testable and deterministic.

## Decision

The Office renderer consumes a strict versioned JSON-compatible contract and produces deterministic DOCX/XLSX/PPTX artifacts locally. It is network-free, macro-free, model-free, and Desktop-Office-free. Validate XML 1.0 content, resource/container/depth limits, worksheet names, freeze panes, supported structures, and spreadsheet formula-injection boundaries before successful publication. Output publication is race-safe with explicit overwrite semantics.

## Consequences

Rendering remains independently deployable and auditable. Fidelity claims are limited to tested supported constructs rather than broad Office compatibility claims. Hosts retain storage, authorization, content classification, retention, and downstream viewer policy.

## Failure and recovery

Invalid or unsupported input fails closed with bounded diagnostics. Partial or failed output is not successful evidence and must not replace unrelated files. A caller requesting overwrite does so explicitly. Recovery rebuilds from the exact validated source rather than editing a partially generated package.

## Security and privacy impact

The renderer does not fetch external resources, execute macros, invoke a model, or require Desktop Office. Spreadsheet strings are neutralized according to the supported literal-text contract so untrusted content cannot silently become a formula. Bounded validation reduces XML/package and resource-exhaustion risk. Callers still own authorization, storage location, document classification, retention, distribution, and downstream-viewer policy.

## Compatibility and migration

Supported DOCX/XLSX/PPTX constructs and the JSON request schema are explicit compatibility surfaces. New structures require schema/version updates and real document-fidelity fixtures; unsupported constructs must not be silently advertised as lossless. Python runtime/package support must remain aligned across metadata, CI, README, wheel evidence, and release guidance. Rollback restores the last verified renderer contract and rebuilds artifacts from source.

## Verification

Run supported Python-version tests, exact statement/branch coverage, complete public docstrings, realistic DOCX/XLSX/PPTX package inspection, formula-prefix regressions, XML-invalid character cases, cyclic/depth/container limits, worksheet/freeze-pane cases, publication-race tests, wheel/package inspection, license checks, and deterministic digest/evidence checks where applicable.

## Rollback or supersession

Rollback restores the last verified renderer contract and rebuilds artifacts without mutating host files outside the explicit target. Supersession requires a versioned input/output contract, migration/fidelity analysis, equivalent no-network/no-macro guarantees, and fresh package/release evidence.
