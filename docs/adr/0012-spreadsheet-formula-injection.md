# ADR 0012: Spreadsheet formula-injection handling

Status: Proposed

## Context

Inkspan Office accepts AI-authored or otherwise untrusted JSON-like spreadsheet values and produces XLSX files. Spreadsheet applications can interpret text beginning with formula-significant prefixes such as `=`, `+`, `-`, or `@` as executable formulas or formula-like expressions if a renderer writes them with formula semantics. The 0.1 renderer contract does not include formula generation.

## Alternatives considered

- Preserve formula-looking strings as formulas. Rejected because untrusted text could gain executable spreadsheet semantics and formula generation is outside the current contract.
- Prefix every suspicious string with a visible apostrophe. Rejected as the primary contract because it mutates the user's textual value and can create avoidable fidelity differences.
- Write supported string values as literal text cells and verify that formula-significant prefixes remain data, while rejecting values that cannot be represented safely. Selected because it preserves user text without granting formula authority.

## Decision

String inputs are rendered as literal text by default, including values whose first non-whitespace character is `=`, `+`, `-`, or `@`. Inkspan Office does not infer or generate spreadsheet formulas in the current contract. Numeric and textual limits are validated before publication, and callers must supply identifiers or high-precision digit sequences as strings when exact textual representation matters.

A future formula feature must use a distinct explicit schema field or versioned contract; it may not reinterpret existing string cells as formulas.

## Consequences

AI-authored and pasted content cannot silently become a formula merely because its text begins with a formula-significant prefix. Consumers that intentionally need formulas must wait for or adopt a future explicit formula contract rather than relying on implicit spreadsheet-library behavior.

## Failure and recovery

If a value cannot be represented under the safe literal/numeric contract, validation fails before successful artifact publication. The renderer must not fall back from rejected text to formula semantics. Recovery is to provide a supported literal representation or adopt a future explicit formula schema after its security review.

## Security and privacy impact

This boundary removes a common path from untrusted document content to spreadsheet formula execution, external-link behavior, or application-specific formula side effects. It does not make downstream spreadsheet viewers universally safe; hosts remain responsible for distribution policy, viewer hardening, authorization, and document classification. Formula-significant source strings are content and should not be copied into generic security logs solely because they were neutralized.

## Compatibility and migration

Existing string cells retain literal-text semantics across compatible releases. Introducing intentional formulas is a breaking semantic expansion unless represented by a new explicit versioned shape that coexists without changing old strings. Migration must distinguish literal historical values from intentional formulas and provide rollback to the literal-only renderer.

## Verification

Maintain regression fixtures for leading `=`, `+`, `-`, and `@`, including whitespace-prefixed variants and ordinary literal strings. Inspect generated XLSX cell types/values with the supported library and realistic package round-trips. Keep numeric-precision, string-length, worksheet-limit, package, coverage, and deterministic-render tests green on every supported Python runtime.

## Rollback or supersession

Rollback restores the last verified literal-only spreadsheet contract and rebuilds artifacts from exact source. Supersession requires an explicit formula schema, threat analysis, injection regressions, compatibility/migration rules, downstream-viewer considerations, and a safe rollback that never reinterprets historical literal strings.
