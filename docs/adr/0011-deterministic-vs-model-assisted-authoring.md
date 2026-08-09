# ADR 0011: Deterministic conversion versus model-assisted authoring

Status: Proposed

## Context

Inkspan supports deterministic editing/conversion surfaces and may be embedded in products that offer model-assisted writing. A generated proposal is probabilistic, provider-dependent content; deterministic document validation, conversion, revision, and persistence evidence must not inherit model authority or availability.

## Alternatives considered

- Let model output directly mutate or persist canonical documents. Rejected because provider behavior would become document authority and could bypass deterministic validation, host authorization, and user intent.
- Put model invocation inside deterministic conversion APIs. Rejected because conversion would gain network, credential, availability, privacy, and reproducibility dependencies.
- Keep model assistance as a host-authorized proposal path that rejoins Inkspan only through ordinary deterministic validation and explicit acceptance. Selected because it preserves offline-capable core behavior and a clear trust boundary.

## Decision

Deterministic editing, import/export, canonical envelope handling, revision evidence, autosave coordination, and Office rendering remain authoritative without an LLM or network dependency. Model-backed authoring is an optional host-owned capability. Model output is untrusted proposed content until an authorized host/user accepts it and the resulting content passes the same deterministic Inkspan parsing, sanitization, schema, conversion, and persistence boundaries as manually authored content.

No model result authorizes a save, selects a tenant, advances a durable validator, bypasses clipboard or Office safety, changes a release gate, or becomes formal review evidence merely because the provider returned successfully.

## Consequences

Inkspan remains usable when model infrastructure is absent or degraded. Hosts can select providers and product UX independently. Model-assisted workflows incur an explicit proposal/diff/acceptance step and must maintain their own prompt/data governance and audit evidence.

## Failure and recovery

Provider timeout, quota exhaustion, malformed output, policy rejection, or unavailable credentials disables only the optional proposal path. Existing deterministic authoring and conversion remain available according to host policy. Invalid proposed content is rejected or sanitized through the normal deterministic boundary; it is never promoted to success by a fallback that skips validation.

## Security and privacy impact

The host owns model credentials, provider selection, external-data-use approval, prompt construction, redaction/minimization, retention, tenant authorization, and human approval. Inkspan must not rematerialize raw provider secrets after model execution or place prompts, model outputs, tenant data, or credentials into generic diagnostics. Model output is treated as attacker-controlled/untrusted content at every deterministic ingress.

## Compatibility and migration

Deterministic package APIs cannot acquire a required provider/network dependency in a compatible minor change. A future model-assistance SDK must remain optional and versioned separately from deterministic document/conversion contracts. Hosts may migrate model providers without changing canonical Inkspan document semantics. Rollback disables model assistance without document migration.

## Verification

Package-consumer tests prove deterministic subpaths work without model SDKs or credentials. Editor/conversion security tests exercise model-proposed content through the same sanitization/schema boundaries as other untrusted input. Host integration evidence must prove authorization and explicit acceptance before durable persistence. Outage tests verify deterministic authoring remains functional when the model path is unavailable.

## Rollback or supersession

Rollback removes or disables the optional proposal integration while preserving canonical documents and deterministic APIs. Supersession requires an explicit versioned trust-boundary ADR showing why any model-derived authority is necessary, with privacy, security, offline/degraded-mode, compatibility, migration, and rollback evidence.
