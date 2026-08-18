# Doctoring record: Durable ETag resource boundary

**Date:** 2026-08-11  
**Status:** Active PR / Proposed  
**Protected-main authority:** The current protected implementation validates RFC 9110 strong entity-tag syntax but does not yet apply the resource ceiling described below.  
**Scope:** Provider-neutral durable autosave validator validation only.

## Buyer-visible gap

Inkspan's durable autosave session accepts server-issued strong entity tags at three local trust boundaries: initial session creation, successful durable-save callback results, and explicit conflict/failure recovery. Protected `main` validates the RFC 9110 character grammar with a regular expression, but the validator has no Inkspan-owned input ceiling. An arbitrarily large syntactically valid string can therefore force an unbounded regex scan before classification and, when accepted, become retained session/snapshot metadata.

The host still owns transport and server field-size policy. Inkspan nevertheless owns the local validator predicate and retained local session state, so it must place a bounded resource policy before its own parser/regex boundary.

## Decision

The active implementation proposal caps the complete quoted strong entity tag at **64 Ki UTF-16 code units**. Values above that ceiling fail closed before the RFC grammar regular expression is evaluated. Values at or below the ceiling still have to satisfy the existing strong entity-tag grammar.

This 64 Ki ceiling is an Inkspan local reliability/resource policy. RFC 9110 defines entity-tag syntax and comparison semantics; this record does **not** claim that RFC 9110 defines a 64 Ki entity-tag or HTTP-field maximum.

One public predicate, `isStrongHttpEntityTag()`, remains the validation authority. Using the same predicate for initial options, returned replacement validators, and recovered validators prevents those entry points from drifting to different size or grammar rules.

## Alternatives considered

1. **Keep grammar-only validation.** Rejected because the local regex and retained snapshot state remain attacker/caller-amplifiable.
2. **Apply a host-configurable limit.** Rejected for the standalone predicate because every caller would need to re-establish a safe default, weakening deterministic package behavior. Hosts with different version-token protocols already have the lower-level autosave queue escape hatch.
3. **Use an HTTP transport/server limit as the only bound.** Rejected because standalone Inkspan has no transport authority and callers can invoke the public validator directly.
4. **Use UTF-8 byte counting.** Not selected for this boundary because the accepted HTTP `etagc` grammar is already restricted to ASCII plus `obs-text`; a constant-time JavaScript string-length preflight is sufficient to prevent the regex scan and directly bounds retained JS string size in code units. This does not change any host transport byte limit.

## Failure and privacy semantics

Oversized initial validators continue to surface only the redacted `invalid_options` category. Oversized recovery validators surface only `invalid_recovery_validator`. Oversized callback replacement validators are treated as an invalid save result and leave the previously accepted durable validator intact. None of those public failures copy the rejected validator into the error message.

The accepted durable validator remains tenant-correlatable metadata. Existing guidance prohibiting public URLs, unauthenticated logs, analytics dimensions, and high-cardinality metric labels remains unchanged.

## Ownership boundary

Inkspan owns the resource-bounded local predicate and deterministic local validator handoff. The host continues to own authentication, authorization, tenancy, network transport, HTTP server configuration, persistence, atomic `If-Match` comparison/commit, credentials, migration, retention, durable audit, retry/idempotency policy, and conflict UX. No network, database, model, credential, or durable PDF/print authority is added.

## Verification contract

The change is accepted only when exact-head evidence proves all of the following:

- a test-only predecessor fails because an oversized otherwise-valid tag reaches the old grammar-only path;
- the repaired predicate rejects oversized input before regex evaluation;
- ASCII and `obs-text` values at the exact local ceiling remain accepted when syntactically valid;
- the first otherwise-valid code unit beyond the ceiling is rejected;
- initial-session, replacement-result, and recovery boundaries all fail closed without retaining the oversized value;
- public errors remain payload-redacted;
- the framework-free autosave package surface preserves the same behavior;
- owned production statement, branch, function, and line coverage remains exactly 100%; and
- applicable CI, security, package, browser, Office, provenance/release-policy and review gates pass on one unchanged exact head.

Until that active PR reaches protected `main`, the behavior in this record is proposed and must not be described as shipped.

## References (APA 7th edition)

Fielding, R., Nottingham, M., & Reschke, J. (2022). *HTTP semantics* (RFC 9110). RFC Editor. https://doi.org/10.17487/RFC9110

International Organization for Standardization. (2023). *Systems and software engineering—Systems and software quality requirements and evaluation (SQuaRE)—Product quality model* (ISO/IEC 25010:2023). https://www.iso.org/standard/78176.html
