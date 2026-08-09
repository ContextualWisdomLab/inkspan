# AGENTS.md

## Canonical product and architecture authority

Protected `main` is Inkspan's implementation authority. Before changing product behavior, public contracts, architecture, security boundaries, tests, release behavior, or integration guidance, start from `docs/README.md` and keep `docs/PRD.md`, `docs/TRD.md`, and `docs/CONTRACTS.md` aligned with the current implementation and accepted ADRs.

Inkspan owns deterministic editor/conversion behavior, versioned document/evidence contracts, local autosave coordination, accessibility metadata, package behavior, and provider-neutral adapters. Hosts retain transport, authentication, authorization, tenant isolation, durable persistence, credentials, migration execution, retention, deployment, durable audit, collaboration-provider authority, and model-use policy unless an accepted versioned contract explicitly changes that boundary.

Do not infer shipped behavior from conversation history, PR bodies, model output, or predecessor-head evidence. Keep Proposed/Active-PR behavior distinct from implementation on Protected `main`, preserve fail-closed security and deterministic conversion boundaries, and update the smallest affected canonical documents plus tests when a durable contract changes.

## Code-owner review gates — disabled (on hold)

As of 2026-08-04, code-owner review requirements (`require_code_owner_reviews` in branch
protection, `require_code_owner_review` in rulesets) are disabled across the ContextualWisdomLab
org: there is a single maintainer (solo developer), so a code-owner approval gate can never be
satisfied. This is ON HOLD until the org has multiple maintainers — do NOT re-enable these
settings or add CODEOWNERS-based merge gates before then.
