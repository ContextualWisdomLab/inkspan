# Doctoring record: naruon modular architecture

- **Status:** Accepted
- **Decision date:** 2026-08-05
- **Scope:** Repository architecture, naruon composition, acquisition evidence,
  and operator-facing integration guidance
- **Runtime change:** None

## Problem

Inkspan already had strong implementation-level boundaries for editing,
collaboration, deterministic conversion, revision evidence, and durable autosave,
but those boundaries were distributed across feature-specific documents. A
buyer, naruon integrator, or new operator could not review one authoritative
system view that explained:

- how standalone use differs from modular CWL composition;
- which responsibilities remain with Inkspan and which belong to the host;
- how `ContextualWisdomLab/.github`, `ContextualWisdomLab/naruon`, and
  `ContextualWisdomLab/contextual-orchestrator` fit together;
- where SSR, Yjs provider lifecycle, strong HTTP validators, accessibility, and
  release evidence cross trust boundaries; and
- which evidence may be shared during support, procurement, or acquisition
  diligence without disclosing tenant data.

That gap increased integration error risk even though the underlying package
contracts were already provider-neutral.

## Decision

Add one authoritative root `ARCHITECTURE.md` and one beginner-readable naruon
`compose` / `ui.panel` integration guide.

The architecture explicitly states:

> Inkspan owns editor and deterministic conversion surfaces.

> Hosts own transport, authorization, tenant isolation, persistence,
> credentials, migration, retention, and model-use policy.

The documentation uses reviewable Mermaid diagrams for the modular component
map and RFC 9110 optimistic-concurrency sequence. It defines local versus
shareable evidence, host-owned Yjs provider lifecycle, narrow client hydration,
server-selected strong validators, accessible conflict handling, and exact-head
release evidence.

## Architectural consequences

### Positive

- Standalone adopters receive a complete boundary without installing naruon or
  contextual-orchestrator.
- CWL hosts can compose common infrastructure without moving editor-owned
  validation or deterministic conversion into the host.
- Server-side secrets, tenant authorization, persistence, and model-use policy
  remain outside the browser editor package.
- Integrators receive a concrete fail-closed autosave and conflict sequence.
- Acquisition reviewers can distinguish reproducible product evidence from
  restricted customer or deployment evidence.
- The diagrams are version-controlled, text-reviewable, and render directly in
  GitHub without an external design artifact.

### Trade-offs

- The guide is an architecture contract rather than a ready-made naruon
  persistence adapter. Host implementations still need their own authenticated
  APIs and database transactions.
- Mermaid rendering is useful for review but is not a substitute for accessible
  prose; every diagram is accompanied by equivalent text and tables.
- Documentation tests can prove required statements remain present, but they do
  not prove a deployed host is secure, accessible, or conformant.

## Security boundary

The decision follows the least-authority split recommended for modular systems:

- the editor receives document state and non-secret presentation configuration;
- the host resolves identity, tenant membership, provider credentials, and
  durable storage authority;
- the persistence service selects and atomically enforces strong entity tags;
- the collaboration host owns room authorization, update persistence, and
  provider lifecycle;
- contextual-orchestrator owns only host-approved provider-neutral model
  execution; and
- the central `.github` repository owns reusable CI, security, review,
  provenance, and release policy rather than runtime data authority.

The architecture does not claim compliance with OWASP ASVS 5.0.0, NIST SP
800-204, NIST SP 800-204D, WCAG 2.2, or RFC 9110 by documentation alone. Those
sources inform the boundary and verification plan. Conformance and assurance
must be assessed on the complete deployed host and its operating controls.

## Accessibility boundary

The naruon `ui.panel` guide requires keyboard-operable conflict actions,
labelled status and conflict regions, controlled focus movement, and restrained
live-region announcements. This supports WCAG 2.2-oriented integration, but the
host remains responsible for testing the complete page, all responsive states,
and third-party content before making a conformance claim.

## SSR and hydration boundary

React hydrateRoot attaches an interactive tree to server-generated markup.
Next.js App Router separates Server and Client Components and uses `'use client'`
to declare the client module boundary. The integration therefore keeps Inkspan,
browser-only providers, event handlers, and `Y.Doc` creation in the narrow
client panel while authorization, credential access, and initial durable loading
remain server-side.

This is an architectural recommendation, not a dependency on Next.js. A
traditional React SSR host may apply the same separation with its own server and
client entry points.

## Optimistic-concurrency boundary

RFC 9110 defines validators and conditional request semantics. Inkspan validates
strong entity-tag syntax and coordinates local single-flight ordering, but the
host persistence transaction remains authoritative. The host must compare the
`If-Match` value atomically with the durable representation and return a new
server-selected strong `ETag` after an accepted write.

A local Inkspan SHA-256 revision remains equality evidence for local deterministic
operations. It is not substituted for a durable HTTP validator, authorization
decision, signature, tenant identifier, or audit record.

## Acquisition evidence boundary

Shareable evidence is deliberately reproducible from source and non-customer
fixtures: exact-head CI, security results, package hashes, SBOMs, provenance,
licenses, public declarations, deterministic conversion fixtures, operator
records, migration contracts, and rollback procedures.

Restricted evidence includes document envelopes, conflict bodies, Yjs updates,
awareness state, prompts, model outputs, provider credentials, tenant-scoped
validators, authorization claims, and deployment-specific exploitable findings.
Hashing, canonicalization, encryption, or successful CI does not automatically
make restricted evidence shareable.

## Verification

`src/architectureDocumentation.test.ts` fails unless:

- the root architecture contains the standalone and modular ownership boundary;
- the CWL repositories and host responsibilities are named;
- both deployment and optimistic-concurrency Mermaid diagrams exist;
- the naruon guide includes client-boundary, strong-validator, accessible
  conflict, provider-lifecycle, credential, and evidence contracts;
- this doctoring record retains the authoritative standards references; and
- `CHANGELOG.md` records the unreleased buyer-visible documentation slice.

The repository-wide TypeScript, 100% production statement/branch/function/line
coverage, package, Office, security, SAST, review, and exact-head branch
protection gates remain authoritative.

## Rejected alternatives

### Put naruon-specific behavior inside Inkspan

Rejected because it would break standalone operation, make the editor own host
transport and identity concerns, and couple releases to one product shell.

### Publish a complete persistence adapter in this slice

Rejected because transport, authorization, tenant isolation, database schema,
migration, retention, and credential policy are host responsibilities. A sample
adapter could accidentally become an insecure de facto production contract.

### Store provider credentials in panel props or environment-reading editor code

Rejected because browser props are observable and package-level environment
resolution would violate the host-owned secret boundary.

### Treat local SHA-256 evidence as the server validator

Rejected because the server is responsible for representation selection and
atomic conditional writes. Local equality evidence cannot prove durable commit
success.

### Use an external drawing-only artifact

Rejected for the authoritative record because a binary or hosted-only diagram is
harder to diff, review, version, and validate in repository CI. Figma remains
appropriate for interaction design when visual fidelity materially improves a
future UI slice; the current architecture is better represented as text and
Mermaid.

## Rollback

Rollback removes `ARCHITECTURE.md`, `docs/naruon-compose-ui-panel.md`, this
record, and the associated documentation contract test, then removes the
unreleased changelog entry. No runtime, package export, dependency, database,
credential, workflow, or published version rollback is required.

## APA 7 references

Chandramouli, R. (2019). *Security strategies for microservices-based
application systems* (NIST Special Publication 800-204). National Institute of
Standards and Technology. https://doi.org/10.6028/NIST.SP.800-204

Chandramouli, R., Kautz, F., & Torres-Arias, S. (2024). *Strategies for the
integration of software supply chain security in DevSecOps CI/CD pipelines*
(NIST Special Publication 800-204D). National Institute of Standards and
Technology. https://doi.org/10.6028/NIST.SP.800-204D

Fielding, R., Nottingham, M., & Reschke, J. (2022). *HTTP semantics* (RFC 9110;
STD 97). RFC Editor. https://doi.org/10.17487/RFC9110

Meta Platforms, Inc. (n.d.). *Client React DOM APIs: hydrateRoot*. React.
Retrieved August 5, 2026, from https://react.dev/reference/react-dom/client

Open Worldwide Application Security Project Foundation. (2025). *OWASP
Application Security Verification Standard 5.0.0*.
https://owasp.org/www-project-application-security-verification-standard/

Vercel. (2026, March 16). *Server and Client Components*. Next.js.
https://nextjs.org/docs/app/getting-started/server-and-client-components

World Wide Web Consortium. (2024, December 12). *Web Content Accessibility
Guidelines (WCAG) 2.2*. https://www.w3.org/TR/WCAG22/
