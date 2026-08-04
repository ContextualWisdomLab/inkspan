# Doctoring record: Framework-independent revision-evidence package boundary

**Date:** 2026-08-04  
**Target release:** Inkspan 0.5.26  
**Decision owner:** ContextualWisdomLab  
**Scope:** Dependency-free npm subpath for server, worker, queue, migration, and storage consumers.

## Review finding

The first revision-evidence implementation was logically independent of React,
TipTap, ProseMirror, and Yjs, but it was exported only from Inkspan's root npm
entrypoint. The root entrypoint is deliberately the complete interactive editor
bundle and externalizes React and TipTap. A direct Node.js import of a named pure
function still evaluates the root module graph and therefore requires those
framework packages to resolve.

Installing the npm tarball together with every declared dependency proved that
the root package worked, but it did not prove the buyer-facing claim that a
server or worker could use the pure API without loading the editor framework.
The packaging boundary therefore contradicted the implementation boundary.

## Selected design

Inkspan now publishes `@contextualwisdomlab/cwl-editor/revision-evidence` as a
separate ESM, CommonJS, and declaration entrypoint. Its source graph is limited
to:

- versioned document-envelope parsing and resource limits;
- RFC 8785 canonical JSON and strict UTF-8 encoding;
- SHA-256 strong revision derivation; and
- frozen revision-envelope evidence pairing.

The subpath has no editor component, React hook, TipTap, ProseMirror, Yjs,
transport, database, credential, or provider-SDK import. The existing root
exports remain for backward compatibility, while non-editor consumers use the
explicit subpath.

## Verification evidence

The release gate builds the dedicated bundle and packs the exact npm artifact.
A second consumer test extracts that tarball into an operating-system temporary
`node_modules` tree containing only the Inkspan package—no React, React DOM,
TipTap, ProseMirror, Yjs, or other package dependency is installed. It then:

1. imports and executes the revision-evidence subpath through ESM;
2. requires and executes the same subpath through CommonJS;
3. verifies both resolutions point at the dedicated packed bundle;
4. creates real object and strict UTF-8 evidence with injected SHA-256-compatible
   providers; and
5. compiles a strict TypeScript consumer against the packed declaration subpath.

Any accidental framework import, missing subpath export, declaration reference
to editor types, or repository-level dependency fallthrough makes this gate
fail. The ordinary full-package consumer verification remains in place for the
interactive editor, collaboration, and converter surfaces.

## MSA and security boundary

This subpath is a deterministic library boundary rather than a service or
persistence implementation. Inkspan owns parsing, normalization,
canonicalization, digest-provider validation, and immutable evidence pairing.
CWL and naruon services retain authenticated transport, tenant isolation,
atomic durable compare-and-swap, encryption and signing, key management,
retention, residency, audit, retry, conflict UX, and model-use policy.

A revision-evidence envelope contains the complete client-controlled document.
It must not be copied into ordinary logs, metrics labels, analytics events,
exception messages, public URLs, or compact revision metadata. The SHA-256
revision is an equality validator, not a signature, authorization token, tenant
identifier, or proof of durable persistence.

No database object is introduced. Future persistence objects must use at least
two descriptive words and `snake_case` by default, or valid CamelCase/PascalCase
where required by an ecosystem convention.

## Alternatives rejected

### Rely on bundler tree shaking

Rejected because Node.js and many worker runtimes evaluate the selected package
entrypoint before an application bundler can remove unrelated editor exports.
A commercial package contract must be correct for direct ESM and CommonJS
consumers, not only for an optimizing downstream build.

### Keep only root exports and document required peer dependencies

Rejected because it would preserve the framework coupling and contradict the
server/worker product claim. It also increases installation size and attack
surface for processes that never render an editor.

### Split revision evidence into a separate npm package immediately

Rejected for this release because a verified subpath provides the required
runtime isolation without introducing new registry ownership, version
coordination, publication credentials, or procurement artifacts. A separate
package can be reconsidered if independent release cadence becomes valuable.

## Release decision

Inkspan 0.5.26 may merge only when the exact head contains the dedicated
subpath, the dependency-free extracted-tarball ESM/CommonJS/TypeScript gate,
updated package exports and build configuration, complete documentation, 100%
production coverage and docstrings, Office Python gates, SAST, Security Scan,
CodeRabbit, and no unresolved review finding.

## References (APA 7th edition)

OpenJS Foundation. (n.d.). *Packages: Package entry points*. Node.js. Retrieved
August 4, 2026, from https://nodejs.org/api/packages.html#package-entry-points

Rundgren, A., Jordan, B., & Erdtman, S. (2020). *JSON Canonicalization Scheme
(JCS)* (RFC 8785). RFC Editor. https://doi.org/10.17487/RFC8785

Fielding, R., Nottingham, M., & Reschke, J. (2022). *HTTP semantics* (RFC
9110). RFC Editor. https://doi.org/10.17487/RFC9110

World Wide Web Consortium. (2017). *Web Cryptography API* (W3C
Recommendation). https://www.w3.org/TR/2017/REC-WebCryptoAPI-20170126/
