# ADR 0020: Framework-neutral deterministic Markdown package boundary

Status: Proposed

## Context

Inkspan owns deterministic Markdown, HTML, email-HTML, and plain-text conversion, but the protected root package currently evaluates the interactive React/TipTap editor graph. Server workers, email composition jobs, conversion services, and CWL/naruon backend adapters need the deterministic conversion authority without inheriting React, TipTap UI, Yjs, browser globals, credentials, network transport, a database, or model runtime authority.

Issue #112 and active PR #114 implement this gap through an explicit `@contextualwisdomlab/cwl-editor/markdown` package subpath. Because #114 is not yet protected-main authority, this ADR records the intended durable package boundary as Proposed rather than shipped behavior.

Node.js package `exports` provides the explicit public-subpath mechanism, while Vite library mode supports dedicated library entries and ESM/CommonJS library outputs. Those mechanisms do not by themselves prove runtime isolation, so Inkspan also requires packed-artifact dependency-boundary verification.

## Alternatives considered

### Keep conversion only on the root entrypoint

Rejected. It forces non-editor consumers to resolve the interactive dependency graph and undermines Inkspan's modular MSA boundary.

### Duplicate serializers into a second package implementation

Rejected. Two implementations would create behavioral and security drift between interactive and headless conversion.

### Publish a second repository/package

Rejected for the current boundary. The deterministic serializers, URI policy, image policy, tests, and release provenance already belong to Inkspan; a second repository would split one authority without buyer benefit.

### Explicit framework-neutral subpath backed by shared policy modules

Selected. The root package and the headless subpath share one deterministic implementation and one security-policy authority while exposing different dependency graphs.

## Decision

Inkspan will expose deterministic text/document serialization through one explicit framework-neutral package subpath when PR #114 or a verified successor reaches protected `main`.

The subpath must:

1. export the supported Markdown/HTML/email/plain-text conversion functions and public option types without forking their behavior;
2. reuse framework-neutral link and inline-image policy modules also consumed by the interactive editor adapters;
3. ship explicit ESM, CommonJS, and declaration targets through the package `exports` map;
4. remain consumable in browserless/server contexts without evaluating React, React DOM, TipTap UI/editor extensions, ProseMirror view, Yjs, naruon, contextual-orchestrator, model SDKs, database clients, credentials, or ambient network authority;
5. preserve root-package source compatibility;
6. preserve strict safe-link, strict inline-raster image, full-document email language/direction, and deterministic plain-text semantics; and
7. prove the released boundary from the packed npm artifact rather than from source imports alone.

The subpath is conversion authority only. It does not own MIME delivery, recipients, authentication, authorization, tenancy, persistence, collaboration, model calls, or durable workflow state.

## Consequences

- Workers and backend adapters can use Inkspan conversion without loading the interactive editor graph.
- Security policy stays centralized rather than being copied into a headless implementation.
- Package verification becomes more important because a source-level import graph can differ from emitted library bundles.
- The repository carries another public subpath that must be versioned and release-tested as part of Inkspan's compatibility surface.

## Failure and recovery

A bundle that imports or dynamically loads forbidden interactive/runtime dependencies fails package acceptance. A browserless conversion failure is a product defect, not permission to add an ambient DOM/network dependency silently.

If the active implementation cannot preserve one shared policy/serializer authority, the feature remains unmerged while unrelated Inkspan work continues. Recovery is to narrow the dependency graph or refactor shared deterministic policy; it is not to duplicate serializers or weaken packed-consumer verification.

## Security and privacy impact

The subpath must not gain credentials, network transport, tenant identity, persistence, model execution, or generic telemetry authority. Inputs remain untrusted content and retain the same deterministic URI/image validation boundaries as the interactive package.

A headless package boundary reduces accidental exposure to unnecessary interactive dependencies, but it is not an authorization or sandbox boundary by itself. Embedding hosts remain responsible for authorization, tenant isolation, data classification, transport, retention, and external delivery.

## Compatibility and migration

The change is additive. Existing root imports remain valid. Consumers may migrate deterministic conversion imports to the narrow subpath without changing document semantics.

Any future breaking change to exported conversion semantics or dependency guarantees requires normal package-version compatibility treatment and, if authority changes materially, a superseding ADR.

## Verification and acceptance evidence

Before this ADR becomes Accepted:

- the explicit package subpath must be present on protected `main`;
- ESM, CommonJS, and strict TypeScript packed consumers must pass outside the source tree;
- emitted bundles must be checked for forbidden runtime imports/loaders and ambient authority;
- existing root conversion tests must remain behaviorally authoritative;
- exact owned production coverage and public documentation gates must pass;
- exact-head CI, Security Scan, SAST, package verification, review, and protected integration must pass; and
- canonical PRD/TRD/Architecture/contracts/UML/documentation-fitness records must be reconciled without describing active-PR behavior as shipped.

## Rollback or supersession

Before protected integration, rollback is closing/superseding the active implementation while leaving root conversion unchanged. After integration, removal of the subpath is a public package compatibility change and requires versioned migration guidance.

A future independent conversion package or service may supersede this ADR only if it preserves deterministic behavior, security-policy ownership, package provenance, and standalone operation without introducing hidden host/runtime coupling.

## References — APA 7th

Node.js. (n.d.). *Modules: Packages*. Retrieved August 10, 2026, from https://nodejs.org/api/packages.html

Vite. (n.d.). *Building for production: Library mode*. Retrieved August 10, 2026, from https://vite.dev/guide/build.html#library-mode
