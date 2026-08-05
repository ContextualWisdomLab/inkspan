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
  revision evidence, an explicitly server-issued initial durable validator, and
  the host save callback;
- after a successful durable write, the example adopts the host response's
  strong entity tag and fails closed when that validator is absent, weak, or
  malformed;
- the example states the host-owned authorization, tenant isolation, persistence,
  credentials, migration, retention, audit, retry, and conflict-policy boundary;
- npm keywords describe autosave, document persistence, and optimistic
  concurrency; and
- a deterministic repository test prevents a later package or documentation edit
  from silently hiding either persistence-oriented public subpath or replacing
  the durable validator with local-only revision evidence.

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

GitHub repository README guidance identifies the README as the first place many
visitors learn what a project does, why it is useful, and how to get started. The
root README therefore carries a concise, copyable onboarding path, while the
existing `docs/document-autosave.md` remains the complete operator contract.

RFC 9110 defines an entity tag as a server-selected opaque validator. A validator
sent after a successful state-changing request identifies the selected
representation resulting from that request. Inkspan's deterministic revision
evidence is local equality evidence and may use a different derivation or
representation boundary. The example therefore does not assume that
`evidence.revision.strongEntityTag` is the durable HTTP entity tag. Its initial
`loadedStrongEntityTag` must come from the durable service, and each accepted
write adopts the strong `ETag` returned by that service.

The copyable example validates RFC 9110 quoted opaque-tag syntax, explicitly
rejects the `W/` weak prefix, and fails closed for missing or malformed values.
The host remains responsible for issuing a validator that represents the durable
selected representation, exposing the `ETag` response header through CORS where
applicable, and performing authenticated comparison atomically inside the durable
write transaction.

## Verification

`src/packageDiscovery.test.ts` reads the repository artifacts as data and proves:

- both persistence-oriented export keys exist and are named in the README;
- the README contains the copyable autosave import and explicit durable-host
  boundary;
- the initial base validator is server-issued rather than derived from local
  Inkspan revision evidence;
- successful writes adopt a server-issued strong `ETag`, reject missing, weak, or
  malformed validators using quoted opaque-tag syntax, and never substitute
  local revision evidence;
- npm metadata contains all three persistence discovery keywords; and
- the unreleased changelog and this doctoring record remain present.

The test introduces no production statements or branches. Existing repository
CI remains authoritative for 100% production statement and branch coverage,
package builds and packed consumers, Office package gates, security scans, and
independent exact-head review.

## References

Fielding, R. T., Nottingham, M., & Reschke, J. (2022). *HTTP semantics*
(RFC 9110). RFC Editor. https://doi.org/10.17487/RFC9110

GitHub, Inc. (n.d.). *About the repository README file*. GitHub Docs. Retrieved
August 5, 2026, from
https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-readmes

npm, Inc. (2026). *package.json* (npm CLI version 12.0.1) [Software
documentation]. https://docs.npmjs.com/cli/configuring-npm/package-json/

OpenJS Foundation. (2026). *Modules: Packages* (Node.js v26.5.0 documentation)
[Software documentation]. https://nodejs.org/api/packages.html
