# ADR 0007: Provider-neutral collaboration and host ownership

Status: Proposed

## Context

Inkspan needs collaborative editing compatibility without choosing a network provider, room identity, tenant authority, credential, persistence store, retention policy, or audit system. Coupling those responsibilities to the editor would make standalone operation weaker and create hidden privilege.

## Decision

Inkspan may bind editor state to host-supplied Yjs-compatible document and awareness surfaces. The host creates, authenticates, authorizes, monitors, reconnects, persists, expires, and destroys the collaboration provider. Inkspan does not create or destroy that provider and does not interpret awareness or update receipt as authorization or durable persistence evidence.

## Consequences

Standalone and enterprise hosts can select their own collaboration transport and deployment model. Provider lifecycle and tenant security remain testable in the host rather than buried in the editor. Inkspan must keep its collaboration adapter narrow and must tolerate provider-independent mounting/unmounting.

## Failure and recovery

Provider outage, authorization failure, room loss, or awareness-policy failure is surfaced to the host. The host decides whether the editor remains locally writable, becomes read-only, reconnects, forks, or blocks. Detaching Inkspan must not destroy a provider shared with other product surfaces or erase the host-owned Yjs document.

## Verification

Use provider-neutral integration tests with supplied Yjs state, lifecycle/remount tests, awareness non-authority/privacy contracts, package-dependency checks, and architecture documentation tests. No test should require a production provider credential or network connection to prove the adapter contract.

## Rollback or supersession

Rollback detaches the collaboration adapter while preserving local document operation and the host-owned Yjs state/provider. Supersession requires an explicit versioned collaboration contract with equivalent host authority separation, migration/rollback, privacy, and operability evidence.
