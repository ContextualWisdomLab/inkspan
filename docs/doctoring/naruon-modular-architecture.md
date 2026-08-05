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
  release evidence cross trust boundaries;
- how to prevent cross-document state reuse when a host changes the authorized
  document, workspace, or tenant context in an existing client tree; and
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
server-selected strong validators, bounded host save callbacks, accessible
conflict recovery through `session.resume(...)`, instance-unique panel labels,
exact-head release evidence, and one opaque editing-context lifecycle boundary
that remounts the editor, autosave session, pending digest state, and status state
together. Document identifiers are encoded before transport and remain subject
to host-side authorization and route validation.

## Architectural consequences

### Positive

- Standalone adopters receive a complete boundary without installing naruon or
  contextual-orchestrator.
- CWL hosts can compose common infrastructure without moving editor-owned
  validation or deterministic conversion into the host.
- Server-side secrets, tenant authorization, persistence, and model-use policy
  remain outside the browser editor package.
- Integrators receive a concrete fail-closed autosave and conflict sequence with
  a bounded request and explicit authenticated recovery handoff.
- A host-selected opaque editing-context key prevents uncontrolled editor state,
  durable validators, and in-flight digest completion from crossing authorized
  document boundaries.
- Multiple panels on one page retain separate accessible heading relationships.
- Acquisition reviewers can distinguish reproducible product evidence from
  restricted customer or deployment evidence.
- The diagrams are version-controlled, text-reviewable, and render directly in
  GitHub without an external design artifact.

### Trade-offs

- The guide is an architecture contract rather than a ready-made naruon
  persistence adapter. Host implementations still need their own authenticated
  APIs and database transactions.
- The editing-context key deliberately discards client-local editor and autosave
  state on an authorized context transition. A host that permits drafts across
  transitions must persist and reauthorize those drafts outside Inkspan before
  issuing the new context.
- The example's ten-second deadline is illustrative. Each host must derive a
  bounded timeout, retry, and idempotency policy from its operating environment.
- Mermaid rendering is useful for review but is not a substitute for accessible
  prose; every diagram is accompanied by equivalent text and tables.
- Documentation tests can prove fenced example structure, required ordering, and
  required statements remain present, but they do not prove a deployed host is
  secure, accessible, reliable, or conformant.

## Security boundary

The decision follows the least-authority split recommended for modular systems:

- the editor receives document state and non-secret presentation configuration;
- the host resolves identity, tenant membership, provider credentials, and
  durable storage authority;
- the host issues a fresh opaque editing-context lifecycle value after each
  authorized load or context transition;
- the host bounds every durable save callback with a fresh timeout or abort
  signal and treats timeout or abort as ambiguous rather than successful;
- conflict recovery supplies a server-selected strong validator only after an
  authenticated reload, merge, fork, discard, or equivalent confirmed decision;
- the persistence service selects and atomically enforces strong entity tags;
- the collaboration host owns room authorization, update persistence, and
  provider lifecycle;
- contextual-orchestrator owns only host-approved provider-neutral model
  execution; and
- the central `.github` repository owns reusable CI, security, review,
  provenance, and release policy rather than runtime data authority.

The editing-context value is not an authorization grant, tenant identifier,
durable validator, audit identifier, or credential. It must not be derived from
a document body or treated as server-side access evidence. Its sole purpose is to
provide a non-secret client lifecycle identity so React destroys the entire
stateful subtree when the authorized editing context changes. The host still
validates every document identifier and every write independently.

The architecture does not claim compliance with OWASP ASVS 5.0.0, NIST SP
800-204, NIST SP 800-204D, WCAG 2.2, or RFC 9110 by documentation alone. Those
sources inform the boundary and verification plan. Conformance and assurance
must be assessed on the complete deployed host and its operating controls.

## Accessibility boundary

The naruon `ui.panel` guide requires keyboard-operable conflict actions,
labelled status and conflict regions, controlled focus movement, restrained
live-region announcements, and a unique React-generated heading relationship for
each panel instance. This supports WCAG 2.2-oriented integration, but the host
remains responsible for testing the complete page, all responsive states, and
third-party content before making a conformance claim.

An editing-context remount also replaces focusable editor DOM. The host therefore
owns deterministic focus placement after the newly authorized panel is mounted
and must not leave focus on a removed node or announce private document content.

## SSR and hydration boundary

The React hydrateRoot API attaches an interactive tree to server-generated markup.
Next.js App Router separates Server and Client Components and uses `'use client'`
to declare the client module boundary. The integration therefore keeps Inkspan,
browser-only providers, event handlers, and `Y.Doc` creation in the narrow
client panel while authorization, credential access, and initial durable loading
remain server-side.

React associates state with a component's position in the render tree and
supports an explicit `key` to reset a stateful subtree. The host-facing wrapper
therefore keys an inner client-session component with the opaque authorized
editing-context value. The autosave coordinator is retained in lazy React state
inside that keyed component. It is not created with `useMemo`, because React
documents `useMemo` as a performance optimization rather than a semantic
identity guarantee and may discard its cached value. The initializer has no
transport, timer, credential, persistence, or storage side effects; cleanup
closes the retained session when the keyed subtree is removed.

The server-facing boundary receives only serializable data. A host-owned client
composition creates the conflict-recovery callback inside the client boundary
rather than attempting to serialize a function from a Server Component.

This is an architectural recommendation, not a dependency on Next.js. A
traditional React SSR host may apply the same separation with its own server and
client entry points.

## Optimistic-concurrency boundary

RFC 9110 defines validators and conditional request semantics. Inkspan validates
strong entity-tag syntax and coordinates local single-flight ordering, but the
host persistence transaction remains authoritative. The host must compare the
`If-Match` value atomically with the durable representation and return a new
server-selected strong `ETag` after an accepted write.

A timeout, disconnect, abort, or malformed response is ambiguous. The host does
not advance the durable validator or automatically retry unless separate
idempotency evidence establishes the prior outcome. After an authenticated
conflict decision, the client recovery boundary calls `session.resume(...)` so
the validated replacement tag is installed immediately before retained work
continues.

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

The editing-context key is intentionally non-secret, but it remains local product
state and should not be promoted into logs, analytics dimensions, support
artifacts, or acquisition evidence. Reproducible tests prove the lifecycle
contract without recording a tenant-derived value.

## Verification

`src/architectureDocumentation.test.ts` extracts the fenced TSX example and fails
unless:

- the root architecture contains the standalone and modular ownership boundary;
- the CWL repositories and host responsibilities are named;
- both deployment and optimistic-concurrency Mermaid diagrams exist;
- the naruon guide includes client-boundary, strong-validator, accessible
  conflict, provider-lifecycle, credential, and evidence contracts;
- the complete editor/autosave subtree is keyed by an opaque editing-context
  value, uses lazy component state rather than `useMemo` for session identity,
  and encodes the document identifier before transport;
- each panel creates an instance-unique heading ID and binds its own
  `aria-labelledby` relationship;
- the host save callback supplies a fresh bounded abort signal;
- the latest-generation capture, digest, first guard, enqueue, and second guard
  remain in the required order;
- the conflict path exposes a host recovery callback that invokes
  `session.resume(...)` with the recovered strong validator;
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

### Reuse one client panel across authorized document contexts

Rejected because an uncontrolled editor, autosave validator, pending digest, and
status state can remain associated with the same React tree position after props
change. That creates a credible cross-document state reuse path in which content
from the previous document may be sent to the next document route. Keying the
whole inner session prevents partial reset and binds cleanup to one authorized
editing context.

### Use `useMemo` as the autosave session identity boundary

Rejected because React defines memoization as a performance optimization rather
than a semantic guarantee. A mutable coordinator with explicit cleanup belongs
in state owned by the keyed session subtree. The host changes the key, not a
memoization dependency, to replace the complete authorized editing context.

### Leave durable save callbacks unbounded

Rejected because an unresolved host callback retains the single-flight request
and prevents later enqueue, flush, and close operations from completing. The
host must provide a finite timeout or abort boundary and preserve ambiguous-write
semantics.

### Reuse one static accessible heading ID

Rejected because multiple panels could produce duplicate IDs and cause
`aria-labelledby` to reference the wrong heading. Each mounted panel creates its
own React-generated ID.

### Display a conflict without exposing a recovery handoff

Rejected because status text alone cannot install the authenticated replacement
validator or resume retained work. The host client boundary must receive a
bounded recovery callback tied to the exact autosave session.

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

A host that has implemented the opaque editing-context boundary must not remove
that boundary merely because this documentation slice is rolled back. It should
retain or replace the protection with an independently verified equivalent that
prevents state and validator reuse across authorized document contexts.

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

Meta Platforms, Inc. (n.d.). *Preserving and resetting state*. React. Retrieved
August 5, 2026, from https://react.dev/learn/preserving-and-resetting-state

Meta Platforms, Inc. (n.d.). *useMemo*. React. Retrieved August 5, 2026, from
https://react.dev/reference/react/useMemo

Meta Platforms, Inc. (n.d.). *useState*. React. Retrieved August 5, 2026, from
https://react.dev/reference/react/useState

Open Worldwide Application Security Project Foundation. (2025). *OWASP
Application Security Verification Standard 5.0.0*.
https://owasp.org/www-project-application-security-verification-standard/

Vercel. (2026, March 16). *Server and Client Components*. Next.js.
https://nextjs.org/docs/app/getting-started/server-and-client-components

World Wide Web Consortium. (2024, December 12). *Web Content Accessibility
Guidelines (WCAG) 2.2*. https://www.w3.org/TR/WCAG22/
