# Autosave product-surface discovery

## Decision

Inkspan exposes deterministic revision evidence and provider-neutral autosave as
public Node.js package subpaths. The root README and npm metadata must therefore
name those capabilities directly instead of requiring a prospective adopter to
infer them from the export map or search implementation files.

The buyer-visible contract is intentionally small:

- the distribution table lists `revision-evidence` and `autosave` beside the
  existing editor, collaboration, converter, style, font, and Office surfaces;
- one copyable autosave example demonstrates the public import, immutable
  revision evidence, explicit initial durable revision, and host save callback;
- the example states the host-owned authorization, tenant isolation, persistence,
  credentials, migration, retention, audit, retry, and conflict-policy boundary;
- npm keywords describe autosave, document persistence, and optimistic
  concurrency; and
- a deterministic repository test prevents a later package or documentation edit
  from silently hiding either persistence-oriented public subpath.

No runtime API, transport, persistence adapter, provider, credential path,
tenancy rule, database object, release version, or model-use policy changes.
Inkspan remains responsible only for editor and deterministic conversion or local
coordination surfaces. Hosts remain responsible for authenticated durable RFC
9110 `If-Match` enforcement and all service-side policy.

## Rationale

Node.js package subpath exports are the authoritative machine-readable boundary
for a package with multiple entry points. Node.js documents the `exports` field
as the modern mechanism for defining and encapsulating a package's public
interface. The export map already contained both persistence surfaces, so this
slice changes discovery rather than package resolution.

npm documents `description` and `keywords` as inputs to npm search. Adding exact
persistence terms therefore improves registry discovery without changing package
identity or semantic versioning.

GitHub documents the repository README as the first place many visitors learn
what a project does, why it is useful, and how to get started. The root README
therefore carries a concise, copyable onboarding path, while the existing
`docs/document-autosave.md` remains the complete operator contract.

## Verification

`src/packageDiscovery.test.ts` reads the repository artifacts as data and proves:

- both persistence-oriented export keys exist and are named in the README;
- the README contains the copyable autosave import and explicit durable-host
  boundary;
- npm metadata contains all three persistence discovery keywords; and
- the unreleased changelog and this doctoring record remain present.

The test introduces no production statements or branches. Existing repository
CI remains authoritative for 100% production statement and branch coverage,
package builds and packed consumers, Office package gates, security scans, and
independent exact-head review.

## References

GitHub, Inc. (n.d.). *About the repository README file*. GitHub Docs. Retrieved
August 5, 2026, from
https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-readmes

npm, Inc. (2026). *package.json* (npm CLI version 12.0.1) [Software
documentation]. https://docs.npmjs.com/cli/configuring-npm/package-json/

OpenJS Foundation. (2026). *Modules: Packages* (Node.js v26.5.0 documentation)
[Software documentation]. https://nodejs.org/api/packages.html
