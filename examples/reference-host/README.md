# Inkspan reference host

Status: Active PR / partial reference-host implementation

This directory is buyer-facing integration evidence for issue #377. It is intentionally **host code**, not a new Inkspan runtime surface. Protected `main` remains the shipped product authority, and this example is not production-ready until its remaining SSR/package/collaboration/accessibility/Office acceptance work is implemented and the release boundary permits integration.

The current slice contains four executable, deterministic fixtures, two public-package presentation entrypoints, and one buyer-facing native-form host component:

- `synthetic-document-repository.mjs` demonstrates host-owned strong-validator / `If-Match` persistence behavior. `ambiguous_failure` models a pre-commit failure, while `ambiguous_commit_failure` commits durable state but returns the same ambiguous error without a replacement validator. After either ambiguous outcome, re-read durable state before retrying instead of advancing or blindly reusing the caller's last known validator. A stale validator returns a conflict. A confirmed failure can be retried with the unchanged current validator. A restore is a normal confirmed save against the current validator and advances it only after success. A fork requires the current validator, copies the current document into an independent reference repository, and starts that fork at a fresh validator.
- `delayed-proposal.mjs` demonstrates a provider-free delayed proposal captured against one expected revision. If the current revision changes before application, the proposal returns a conflict instead of overwriting newer content. Host apply callback failures are normalized to a stable payload-free error rather than reflecting private causes through the proposal boundary.
- `autosave-view-model.mjs` projects Inkspan autosave lifecycle snapshots into host-localizable `clean`, `saving`, `queued`, `conflict`, `failed`, `retrying`, `recovered`, `closing`, and `closed` presentation states. Recovery presentation is derived from observed blocked → saving → idle transitions, and validators are never returned as UI data.
- `collaboration-provider-lifecycle.mjs` demonstrates that the embedding host creates one real `Y.Doc`, reuses that same document across provider reconnects, and owns provider/document teardown. The deterministic provider fixture has no provider SDK or network transport and does not treat room or actor identifiers as authorization evidence.
- `presentation-full.css` imports Inkspan's public `styles.css` and complete multilingual `fonts.css` subpaths for hosts that want the bundled offline multilingual font set.
- `presentation-latin.css` imports the same public editor stylesheet plus the smaller public `fonts-latin.css` option for Latin-only hosts.
- `native-form-host.tsx` demonstrates public-package native-form integration: Inkspan synchronizes `message_body` through `formFieldName`, reset behavior is expressed through `formResetValue`, the host reads `FormData` only on submit, and authorization plus durable persistence remain behind the injected `onAuthorizedSubmit` host boundary rather than being embedded in the component.

All executable fixtures are marked `REFERENCE_ONLY`, require no service, database, credential, provider SDK, or network connection for their self-tests, and are exercised by repository tests. The presentation and native-form examples reference only public package entrypoints. The complete reference-host directory is deliberately outside the package `files` inventory so example host logic cannot silently become published Inkspan runtime authority.

## Copy this, replace that

| Reference element | Buyer action |
| --- | --- |
| synthetic document repository | Replace with an authorized atomic durable store that enforces the host's RFC 9110 `If-Match` policy, preserves caller validators across confirmed failures, reconciles authoritative state after ambiguous transport outcomes, supports explicit retry/restore/fork recovery under current-validator checks, isolates fork history, and returns a new strong validator only after confirmed success. |
| deterministic delayed proposal | Replace proposal generation with a host-approved model gateway and data-use policy while preserving exact-revision conflict checks and payload-redacted callback-failure handling before applying untrusted proposal data. |
| autosave presentation projection | Wire the packed Inkspan autosave session observer into localized host UI and authenticated recovery actions; do not display revision or durable validators as user-facing status. |
| collaboration lifecycle fixture | Keep host-owned `Y.Doc` lifecycle control and replace the deterministic provider factory with the host's authorized Yjs transport provider while preserving reconnect, teardown, credential, and room-authorization policy. |
| presentation entrypoints | Choose the complete multilingual or Latin-only font entrypoint, keep imports on published package subpaths, and apply any host theme overrides without weakening Inkspan accessibility states. |
| native form host | Keep Inkspan's `formFieldName` / `formResetValue` serialization boundary, then connect `onAuthorizedSubmit` to host-owned authorization and atomic durable persistence. Do not add a second hidden-field serializer or treat submitted form content as authorization evidence. |
| synthetic document and revision identifiers | Replace with authenticated/authorized host context; never infer tenant or actor authority from an Inkspan digest, form value, or example identifier. |
| reference error handling | Map stable machine outcomes to localized host UX and audited host operations without copying document bodies, prompts, credentials, or private causes into generic telemetry. |

## Ownership map

```mermaid
flowchart LR
    User[Author / reviewer] --> Host[Embedding host]
    Host --> Inkspan[Inkspan editor + deterministic evidence]
    Host --> Repo[Host document repository]
    Host --> Provider[Host collaboration provider]
    Host --> Model[Host-approved model gateway]
    Inkspan --> Proposal[Untrusted proposal data]
    Proposal --> Host
    Repo -->|strong validator / conflict| Host

    classDef host stroke-width:2px;
    class Host,Repo,Provider,Model host;
```

Inkspan owns deterministic editor/revision/autosave/conversion/package behavior. The host owns authenticated transport, authorization, tenancy, durable persistence, `Y.Doc` and collaboration-provider lifecycle, credentials, model policy, retention, deployment, and durable audit. A successful local editor operation, native-form submission, Yjs update, model response, or status check is not durable authorization or persistence evidence.

## Executable fixture checks

From a clean repository checkout with the supported Node runtime, these reference-only fixtures can be exercised directly:

```sh
node examples/reference-host/synthetic-document-repository.mjs --self-test
node examples/reference-host/delayed-proposal.mjs --self-test
node examples/reference-host/autosave-view-model.mjs --self-test
node examples/reference-host/collaboration-provider-lifecycle.mjs --self-test
```

The root test suite independently invokes those commands and asserts the expected stale-write conflict, failure-safe retry, ambiguous pre-commit and post-commit reconciliation, restore, fork isolation, lifecycle recovery, real host-created `Y.Doc`, reconnect, teardown, proposal-failure redaction, public presentation-package behavior, and the native-form example's published-package/host-authority contract. These commands do **not** yet satisfy #377's complete packed-tarball application acceptance.

## Deliberate omissions in this partial slice

Still required before #377 can close: a packed-artifact application (preferably a supported Next.js App Router host), deterministic SSR/hydration proof, packed-artifact/browser execution of the native-form journey, packed-package wiring of the autosave observer, an authorized transport-provider integration journey around the demonstrated host-owned `Y.Doc` lifecycle, real Chromium/Firefox/WebKit acceptance, read-only and forced-colors/print/narrow-viewport journeys, converter/Office handoff, and one documented clean-checkout command that builds the tarball before installing it into the example.

Do not use the synthetic repository, synthetic identifiers, deterministic proposal fixture, presentation projection, deterministic collaboration provider, or native-form example callback as a production persistence, authentication, collaboration, or model implementation.
