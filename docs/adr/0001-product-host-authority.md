# ADR 0001: Product and host authority boundary

Status: Proposed

## Context

Inkspan must work as a standalone authoring/conversion product and as a module inside naruon or another CWL host. Mixing host transport, tenant, identity, persistence, credential, deployment, retention, audit, or model-routing authority into the editor package would make standalone use harder and create hidden security coupling.

## Alternatives considered

- Let Inkspan own transport, persistence, tenancy, credentials, and collaboration-provider lifecycle. Rejected because it creates hidden privilege and makes independent package use depend on one deployment architecture.
- Provide separate standalone and CWL-host product forks. Rejected because duplicated implementations would drift on document, conversion, and security semantics.
- Keep Inkspan deterministic and capability-bounded while hosts inject explicitly owned services. Selected because it preserves standalone reuse and makes authority reviewable at integration boundaries.

## Decision

Inkspan owns deterministic editor, conversion, canonical envelope, local evidence, local autosave ordering, accessibility metadata, package, and provider-neutral adapter behavior. Hosts own transport, authentication, authorization, tenant isolation, durable persistence, credentials, migrations, retention, deployment, durable audit storage, collaboration-provider lifecycle, and model-use policy.

## Consequences

The same package can be embedded or used independently. Host failures remain explicit adapter failures rather than becoming implicit editor state. Some end-to-end properties, such as tenant authorization and durable atomic writes, cannot be proven by Inkspan alone and require host verification.

## Failure and recovery

If an Inkspan change begins to create network providers, choose tenants, store secrets, authorize model calls, or claim durable persistence success, fail the architecture contract and revert the authority expansion. Host integration defects are repaired at the host boundary rather than by granting Inkspan broader privilege.

## Security and privacy impact

Least privilege is explicit: Inkspan receives only capabilities necessary for deterministic local behavior and does not acquire tenant credentials or durable authorization authority. Document bodies and host-confidential metadata remain subject to host purpose, access, encryption, logging, retention, and deletion policy rather than being copied into a new Inkspan control plane.

## Compatibility and migration

Existing standalone package consumers require no host service. Host integrations evolve additively through explicit capabilities and versioned public contracts. Any future transfer of persistence, tenant, credential, provider, or deployment ownership into Inkspan is a breaking architecture change requiring an accepted ADR, migration and rollback plan, revised threat model, and compatibility evidence for standalone consumers.

## Verification

Canonical Architecture/PRD/TRD ownership language, integration tests, package-consumer isolation, provider-neutral collaboration tests, and documentation contracts must agree. Protected `main` remains the implementation authority.

## Rollback or supersession

Rollback removes the authority-expanding path while preserving deterministic document compatibility. Supersession requires a material architecture proposal with threat model, migration/rollback, deployment, and tenant-ownership evidence.
