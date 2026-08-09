# ADR 0013: Atomic file publication and explicit overwrite semantics

Status: Proposed

## Context

Deterministic Office rendering produces binary artifacts that may be published to caller-selected filesystem paths. A naïve check-then-write sequence can race another writer, expose partial files, or unexpectedly replace an existing artifact. Publication semantics therefore belong to the renderer's correctness and security contract, not only to operational convenience.

## Alternatives considered

- Write directly to the destination path. Rejected because consumers can observe partially written artifacts and a failed render can corrupt the target.
- Check whether the destination exists and then rename a temporary file into place. Rejected for non-overwrite mode because the check and publication are separate operations and can race another writer.
- Publish a complete same-directory temporary artifact through race-safe non-overwrite semantics, with a separate explicit overwrite mode using atomic replacement. Selected because partial output never becomes success and overwrite intent is unambiguous.

## Decision

Inkspan Office builds and validates the complete artifact before publication. Publication uses a securely created same-directory temporary file. The default non-overwrite path must atomically fail if the target already exists rather than replacing it after a check-then-act race. Replacement of an existing target is permitted only when the caller explicitly selects overwrite behavior, and that replacement must be atomic for the supported filesystem contract.

Temporary/partial output is never returned as a successful `conversion_artifact`. Cleanup is bounded to the renderer's own temporary artifact and must not delete or rewrite unrelated caller files.

## Consequences

Callers get deterministic conflict behavior and never need to infer whether an existing artifact was replaced. Same-directory temporary publication has filesystem constraints and may cost an additional write/rename step, but it makes the success boundary reviewable and protects consumers from partial output.

## Failure and recovery

Validation, build, temporary-write, publication, destination-conflict, or replacement failure returns a bounded failure and leaves no successful-artifact claim. In default mode an existing destination is preserved. Recovery is to choose a new output path, remove/rename the target under caller authority, or explicitly request overwrite. Retrying must rebuild or reuse only a fully validated candidate under the documented contract.

## Security and privacy impact

Race-safe non-overwrite behavior reduces unintended clobbering and symlink/check-then-act style publication hazards within the supported path contract. Secure temporary files reduce exposure of predictable intermediate names. Inkspan does not broaden filesystem authority, traverse unrelated storage for cleanup, or infer that overwrite is safe from content identity. Hosts remain responsible for directory permissions, tenant path isolation, quotas, retention, encryption at rest, and downstream distribution.

## Compatibility and migration

Default non-overwrite behavior is a stable safety contract. Changing default replacement semantics would be breaking. Existing callers that intentionally replace files must continue to opt in explicitly. Any future object-store or remote-publication adapter requires a separate versioned compare/create/replace contract with equivalent conflict, partial-success, and rollback semantics rather than pretending filesystem atomicity applies remotely.

## Verification

Maintain tests for existing-target conflicts, explicit overwrite, simultaneous publication attempts, temporary-write/build failure, cleanup of only owned temporary artifacts, extension mismatch, and successful round-trip package integrity. Use concurrency regressions that prove the default path has no check-then-replace window and that a consumer never observes a partially published success artifact.

## Rollback or supersession

Rollback restores the last verified publication implementation without weakening default non-overwrite behavior. Supersession requires an explicit storage-specific atomicity model, conflict semantics, security review, concurrency tests, migration guidance, and a rollback that preserves already published caller artifacts.
