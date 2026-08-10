# ADR 0020: Framework-neutral deterministic Markdown package boundary

Status: Accepted

## Context

Inkspan owns deterministic Markdown, HTML, email-HTML, and plain-text conversion, while the protected root package also evaluates the interactive React/TipTap editor graph. Server workers, email composition jobs, conversion services, and CWL/naruon backend adapters need the same deterministic conversion authority without inheriting React, TipTap UI, Yjs, browser globals, credentials, network transport, a database, or model runtime authority.

Issue #112 was implemented and integrated through PR #114. The explicit `@contextualwisdomlab/cwl-editor/markdown` package subpath is now implemented on protected `main`. Its ESM/CommonJS/TypeScript packed-consumer boundary, shared framework-neutral URI/image policies, browserless Node conversion path, and emitted-module authority checks are protected product behavior rather than active-PR architecture.

Node.js package `exports` provides the explicit public-subpath mechanism, while Vite library mode supports dedicated library entries and ESM/CommonJS library outputs. Those mechanisms do not by themselves prove runtime isolation, so Inkspan also requires packed-artifact dependency-boundary verification.

## Alternatives considered

### Keep conversion only on the root entrypoint

Rejected. It forces non-editor consumers to resolve the interactive dependency graph and undermines Inkspan's modular MSA boundary.

### Duplicate serializers into a second package implementation

Rejected. Two implementations would create behavioral and security drift between interactive and headless conversion.

### Publish a second repository/package

Rejected for the current boundary. The deterministic serializers, URI policy, image policy, tests, and release provenance already belong to Inkspan; a second repository would split one authority without buyer benefit.

### Explicit framework-neutral subpath backed by shared policy modules

Selected and implemented on protected `main`. The root package and the headless subpath share one deterministic implementation and one security-policy authority while exposing different dependency graphs.

## Decision

Inkspan exposes deterministic text/document serialization through the protected framework-neutral `@contextualwisdomlab/cwl-editor/markdown` package subpath.

The subpath:

1. exports the supported Markdown/HTML/email/plain-text conversion functions and public option types without forking their behavior;
2. reuses framework-neutral link and inline-image policy modules also consumed by the interactive editor adapters;
3. ships explicit ESM, CommonJS, and declaration targets through the package `exports` map;
4. remains consumable in browserless/server contexts without evaluating React, React DOM, TipTap UI/editor extensions, ProseMirror view, Yjs, naruon, contextual-orchestrator, model SDKs, database clients, credentials, or ambient network authority;
5. preserves root-package source compatibility;
6. preserves strict safe-link, strict inline-raster image, full-document email language/direction, and deterministic plain-text semantics; and
7. proves the released boundary from the packed npm artifact rather than from source imports alone.

The subpath is conversion authority only. It does not own MIME delivery, recipients, authentication, authorization, tenancy, persistence, collaboration, model calls, or durable workflow state.

## Consequences

- Workers and backend adapters can use Inkspan conversion without loading the interactive editor graph.
- Security policy stays centralized rather than being copied into a headless implementation.
- Package verification remains important because a source-level import graph can differ from emitted library bundles.
- The repository now carries another public subpath that must be versioned and release-tested as part of Inkspan's compatibility surface.

## Failure and recovery

A bundle that imports or dynamically loads forbidden interactive/runtime dependencies fails package acceptance. A browserless conversion failure is a product defect, not permission to add an ambient DOM/network dependency silently.

If a future refactor breaks the one-authority serializer/policy boundary, the release must fail while unrelated Inkspan work continues. Recovery is to narrow the dependency graph or restore shared deterministic policy; it is not to duplicate serializers or weaken packed-consumer verification.

## Security and privacy impact

The subpath does not gain credentials, network transport, tenant identity, persistence, model execution, or generic telemetry authority. Inputs remain untrusted content and retain the same deterministic URI/image validation boundaries as the interactive package.

A headless package boundary reduces accidental exposure to unnecessary interactive dependencies, but it is not an authorization or sandbox boundary by itself. Embedding hosts remain responsible for authorization, tenant isolation, data classification, transport, retention, and external delivery.

## Compatibility and migration

The change is additive. Existing root imports remain valid. Consumers may migrate deterministic conversion imports to the narrow subpath without changing document semantics.

Any future breaking change to exported conversion semantics or dependency guarantees requires normal package-version compatibility treatment and, if authority changes materially, a superseding ADR.

## Verification and acceptance evidence

The Accepted decision is backed by protected PR #114 integration and exact-head evidence that included:

- the explicit package subpath on protected `main`;
- ESM, CommonJS, and strict TypeScript packed consumers outside the source tree;
- semantic emitted-module authority checks for forbidden runtime imports/loaders and malformed JavaScript;
- browserless Node `htmlToMarkdown()` without ambient `document` access;
- the existing root conversion suite remaining the behavioral authority;
- exact owned production statement/branch/function/line coverage;
- successful exact-head CI, Security Scan, SAST, package verification, Office Python 3.11–3.14, and real-browser gates; and
- protected integration at commit `4b7b7a8335d66fb3af76b9f2470b04e846b104f2`.

Current source and canonical documentation, not that historical SHA alone, remain the ongoing authority. The SHA is retained only as acceptance lineage.

## Rollback or supersession

Removal of the protected subpath is a public package compatibility change and requires versioned migration guidance. A package-only rollback may restore the previous protected release while preserving root conversion semantics; it must not silently publish a release that advertises a missing export.

A future independent conversion package or service may supersede this ADR only if it preserves deterministic behavior, security-policy ownership, package provenance, and standalone operation without introducing hidden host/runtime coupling.

## References — APA 7th

Node.js. (n.d.). *Modules: Packages*. Retrieved August 10, 2026, from https://nodejs.org/api/packages.html

Vite. (n.d.). *Building for production: Library mode*. Retrieved August 10, 2026, from https://vite.dev/guide/build.html#library-mode
