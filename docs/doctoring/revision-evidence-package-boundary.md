# Doctoring record: Framework-independent revision-evidence package boundary

**Date:** 2026-08-04  
**Target release:** Inkspan 0.5.26  
**Decision owner:** ContextualWisdomLab  
**Scope:** Framework-free runtime subpath for server, worker, queue, migration, and storage consumers.

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

A later packaging review found a second isolation gap in the full-package
consumer. It copied the repository's complete pnpm `node_modules` tree into the
temporary consumer and verified required package paths, but left undeclared
repository-only development packages visible at the consumer's top level. A
publishable tarball with an accidental undeclared import could therefore pass by
resolving a package that the consumer manifest did not declare.

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

A subpath does not change npm's package-level dependency installation model.
Normal installation of `@contextualwisdomlab/cwl-editor` still installs the
package dependencies declared for the interactive editor. The guarantee in this
release is that evaluating `/revision-evidence` loads no framework module. A
separately published package would be required for dependency-graph isolation,
independent procurement, or a smaller installed software bill of materials.

The full-package consumer now uses one composed staging operation. It copies the
frozen-lockfile-verified pnpm virtual store, then removes every undeclared
consumer-level package link before inserting the exact packed Inkspan artifact.
Only dependencies named by the temporary consumer manifest remain directly
resolvable; pnpm's hidden virtual store remains available solely for their exact
transitive closure. The composition prevents future verifier code from copying
the repository dependency tree while accidentally omitting the fail-closed
pruning step.

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
interactive editor, collaboration, and converter surfaces. The dependency-free
extraction is deliberately stricter than normal package installation and proves
the loaded subpath graph, not the package manager's installation graph.

A deterministic Node test builds a synthetic pnpm-style dependency tree with one
declared and one undeclared top-level package. The composed staging helper must
retain the declared package and hidden virtual store while removing the
undeclared package. The production verifier calls that same helper with the
exact direct dependencies recorded in its generated consumer manifest, then
asserts that each permitted dependency resolves inside the operating-system
temporary consumer tree.

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

Rejected because it would preserve module-evaluation coupling and contradict the
server/worker runtime claim. Processes that never render an editor should not
execute its framework graph.

### Keep every repository package visible in the temporary full-package consumer

Rejected because path-containment checks alone do not prove dependency
declaration completeness. Repository-only development dependencies can resolve
inside the temporary tree and conceal an import that a buyer's clean install
cannot satisfy. Exact transitive storage may remain, but undeclared top-level
links must be pruned.

### Split revision evidence into a separate npm package immediately

Deferred rather than rejected permanently. A verified subpath provides the
required runtime isolation without introducing new registry ownership, version
coordination, publication credentials, or procurement artifacts. It does not
reduce package-level dependency installation. A separate package should be
reconsidered if installed size, SBOM minimization, independent release cadence,
or procurement isolation becomes a buyer requirement.

## Release decision

Inkspan 0.5.26 may merge only when the exact head contains the dedicated
subpath, the dependency-free extracted-tarball ESM/CommonJS/TypeScript runtime
gate, the declared-dependency-only full-package consumer, updated package
exports and build configuration, complete documentation, 100% production
coverage and docstrings, Office Python gates, SAST, Security Scan, CodeRabbit,
and no unresolved review finding.

## References (APA 7th edition)

Fielding, R., Nottingham, M., & Reschke, J. (2022). *HTTP semantics* (RFC
9110). RFC Editor. https://doi.org/10.17487/RFC9110

OpenJS Foundation. (n.d.). *Packages: Package entry points*. Node.js. Retrieved
August 4, 2026, from https://nodejs.org/api/packages.html#package-entry-points

Rundgren, A., Jordan, B., & Erdtman, S. (2020). *JSON Canonicalization Scheme
(JCS)* (RFC 8785). RFC Editor. https://doi.org/10.17487/RFC8785

World Wide Web Consortium. (2017). *Web Cryptography API* (W3C
Recommendation). https://www.w3.org/TR/2017/REC-WebCryptoAPI-20170126/
