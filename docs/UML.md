# Inkspan Runtime Diagrams

Status: Protected-main canonical baseline

These diagrams describe the accepted product boundary. Protected `main` remains implementation authority; elements owned by open PRs are Proposed until integrated.

## Bounded-context and component topology

```mermaid
flowchart LR
  User[Author or reviewer]
  HostApp[Standalone host or naruon compose / ui.panel]
  EditorCore[Inkspan TipTap / ProseMirror editor]
  ClipboardBoundary[Safe rich clipboard]
  EvidenceCore[Envelope revision selection text-position transition evidence]
  AutosaveCore[Bounded local autosave]
  ConversionCore[Deterministic Markdown / HTML conversion]
  OfficeRenderer[Deterministic Office renderer]
  CollaborationAdapter[Provider-neutral Yjs adapter]
  HostProvider[Host-owned Yjs provider]
  HostStore[Host persistence / audit]
  ModelGateway[Host-approved contextual-orchestrator or model gateway]
  ControlPlane[ContextualWisdomLab/.github control plane]

  User --> HostApp
  HostApp --> EditorCore
  EditorCore --> ClipboardBoundary
  EditorCore --> EvidenceCore
  EditorCore --> AutosaveCore
  EditorCore --> ConversionCore
  ConversionCore --> OfficeRenderer
  EditorCore <--> CollaborationAdapter
  CollaborationAdapter <--> HostProvider
  AutosaveCore --> HostStore
  HostApp --> ModelGateway
  ControlPlane -. CI-only; not runtime: security review provenance release policy .-> EditorCore
```

The host owns transport, authentication, authorization, tenant isolation, persistence, credentials, provider lifecycle, retention, deployment, durable audit, and model-use policy. Inkspan owns deterministic local editor/conversion/evidence behavior only.

A named editor-chrome theme-token catalog and Storybook inventory are Active PR / Proposed. Hosts override `--cwl-*` on `.cwl-editor` after checking WCAG 2.2 contrast for body text and active toolbar text (`--cwl-accent` on `--cwl-accent-soft`). CSS remains runtime presentation authority. Storybook previews a class-level chrome sample (including `:focus-visible`) and a live shipped Toolbar. It does not mount `CwlEditor`. Print-media remaps live in `@media print`; forced-colors mode does not assign those custom properties. Figma Variables, brand certification, and design-tool sync remain host-owned.

## Rich paste sequence

```mermaid
sequenceDiagram
  participant UserClipboard
  participant PastePipeline
  participant SafeClipboard
  participant EditorState
  UserClipboard->>PastePipeline: rich HTML
  PastePipeline->>SafeClipboard: transform pasted HTML
  SafeClipboard->>SafeClipboard: bounded inert parse and semantic allowlist
  alt accepted
    SafeClipboard-->>PastePipeline: sanitized supported content
    PastePipeline->>EditorState: parse and transact accepted content
  else malformed, active, hidden, resource-bearing, or over limit
    SafeClipboard-->>PastePipeline: bounded failure / safe omission
  end
```

Security-relevant browser fragment semantics require the same hostile corpus under Chromium, Firefox, and WebKit before the relevant release line.

## Cross-engine browser-semantic release assurance

```mermaid
flowchart TB
  Head[One exact protected release-candidate head]
  Corpus[Committed synthetic adversarial clipboard corpus]
  Lock[Immutable package lock and Playwright/browser revisions]
  Packed[Exact packed npm artifact + SHA-256]
  Run[Fresh run identity]
  Chromium[Chromium project]
  Firefox[Firefox project]
  WebKit[WebKit project]
  Semantic{Security-semantic result agrees?}
  Difference{Serialization difference only?}
  Basis[Focused standards basis + threat analysis + rollback note]
  Repair[Repair sanitizer/integration test-first]
  ReleaseGate[Rich-clipboard release assurance eligible]
  Blocked[Release blocked; unrelated work may continue]

  Head --> Corpus
  Head --> Lock
  Head --> Packed
  Head --> Run
  Corpus --> Chromium
  Corpus --> Firefox
  Corpus --> WebKit
  Lock --> Chromium
  Lock --> Firefox
  Lock --> WebKit
  Packed --> Chromium
  Packed --> Firefox
  Packed --> WebKit
  Run --> Chromium
  Run --> Firefox
  Run --> WebKit
  Chromium --> Semantic
  Firefox --> Semantic
  WebKit --> Semantic
  Semantic -->|yes| ReleaseGate
  Semantic -->|no| Difference
  Difference -->|proven safe standards-permitted difference| Basis --> ReleaseGate
  Difference -->|unsafe, unexplained, missing browser, skipped or failed| Repair --> Blocked
```

A queued, pending, skipped, cancelled, absent or failed required browser is not passing evidence. Differences are never normalized merely to make engines agree; any admitted difference is a reviewed compatibility artifact. ADR 0016 governs the protected-main release decision. Every later release candidate must generate fresh source/lock/run/browser evidence and prove the exact packed npm artifact rather than reuse predecessor or feature-branch evidence.

## Author-to-model proposal sequence

```mermaid
sequenceDiagram
  participant Author
  participant Host as Host / naruon
  participant Gateway as Host-approved model gateway
  participant Editor as Inkspan editor
  participant Validator as Deterministic Inkspan validation

  Author->>Host: request assistance for explicit document scope
  Host->>Host: authorize tenant and external model use
  Host->>Gateway: send host-approved bounded context
  Gateway-->>Host: untrusted proposed content
  Host->>Editor: present proposal without durable apply
  Editor->>Validator: parse / sanitize / convert / validate proposal
  Validator-->>Author: diff and validation result
  alt author / host approves
    Author->>Editor: apply proposal to local document state
  else rejected or invalid
    Author-->>Editor: keep current document
  end
```

Model output never bypasses deterministic validation, host authorization, user review, or durable save concurrency.

## Review suggestion decision (Active PR / Proposed)

```mermaid
sequenceDiagram
  participant Host
  participant Handle as CwlEditorHandle
  participant State as Captured EditorState
  participant History as ProseMirror history
  Host->>Handle: authorized suggestion + accept/reject
  Handle->>State: validate proposal and canonical revision
  alt live state changed or selector unsupported
    Handle-->>Host: stale/invalid result; no mutation
  else reject
    Handle-->>Host: revision-only rejected result; no history entry
  else accept
    Handle->>History: dispatch one insert/delete transaction
    Handle-->>Host: before/after revision transition
  end
```

The host remains identity, authorization, persistence, durable exact-once decision, audit, and cross-revision re-anchoring authority. Local undo/redo reverses or reapplies the editor transaction only; it does not rewrite host review records.

## Import and export flow

```mermaid
flowchart LR
  Source[Supported Markdown / HTML or versioned envelope]
  Validate[Strict bounded validation]
  Editor[Inkspan editor state]
  ExportChoice{Requested deterministic output}
  Markdown[Markdown]
  Html[HTML]
  OfficeRequest[Versioned Office render request]
  Office[DOCX / XLSX / PPTX artifact]

  Source --> Validate --> Editor --> ExportChoice
  ExportChoice --> Markdown
  ExportChoice --> Html
  ExportChoice --> OfficeRequest --> Office
```

Unsupported or lossy constructs are surfaced by the relevant contract instead of being advertised as lossless round-trip fidelity.

## Envelope identity and host-owned migration routing

```mermaid
sequenceDiagram
  participant Host
  participant Inspector as Protected bounded identity inspector
  participant Registry as Host migration registry
  participant Migration as Host-owned version migration
  participant StrictParser as Current-schema strict parser
  participant Inkspan

  Host->>Inspector: complete untrusted envelope
  Inspector->>Inspector: bounded JSON/UTF-8/duplicate-name/descriptor validation
  alt identity invalid
    Inspector-->>Host: stable redacted failure
  else identity valid
    Inspector-->>Host: frozen schemaId + schemaVersion only
    Host->>Registry: select authorized migration route
    alt current supported identity
      Host->>StrictParser: validate current envelope
    else registered legacy/future route
      Registry->>Migration: run version-specific host migration
      Migration-->>Host: candidate current-schema envelope
      Host->>StrictParser: strict current-schema validation
    else no route
      Registry-->>Host: unsupported version; preserve original source
    end
    StrictParser-->>Inkspan: canonical document only after strict success
  end
```

The identity result does not contain the document body and does not prove migration, authorization, persistence or durable success. ADR 0015 governs this protected-main routing aid. The host continues to own schema registry, migration execution, persistence, audit and rollback.

## Office render and file publication sequence

```mermaid
sequenceDiagram
  participant Caller
  participant Renderer as Deterministic Office renderer
  participant Validator
  participant Builder
  participant Publisher as Race-safe file publication
  participant Artifact

  Caller->>Renderer: versioned JSON render request
  Renderer->>Validator: validate schema, XML, limits, names, freeze panes, values
  Validator->>Validator: neutralize supported untrusted formula-significant strings
  alt invalid or unsupported
    Validator-->>Caller: bounded failure, no successful artifact
  else valid
    Validator->>Builder: validated inert model
    Builder->>Builder: build network-free macro-free Office package
    Builder->>Publisher: complete candidate artifact
    alt publication succeeds under explicit overwrite policy
      Publisher-->>Artifact: committed DOCX / XLSX / PPTX
      Artifact-->>Caller: deterministic artifact result
    else publication fails or conflicts
      Publisher-->>Caller: bounded failure, partial output is not success
    end
  end
```

## File publication state machine

```mermaid
stateDiagram-v2
  [*] --> validating
  validating --> rejected: invalid / unsupported / over limit
  validating --> building: validated request
  building --> failed: build failure
  building --> publishing: complete candidate package
  publishing --> committed: publication succeeds
  publishing --> conflicted: existing target without approved overwrite
  publishing --> failed: write / race / validation failure
  committed --> [*]
  rejected --> [*]
  conflicted --> [*]
  failed --> [*]
```

No failed or partial file publication becomes a successful conversion artifact.

## Autosave sequence and no-op observer rule

```mermaid
sequenceDiagram
  participant Host
  participant Queue
  participant DurableSave
  Host->>Queue: enqueue immutable revision evidence
  Queue-->>Host: saving snapshot when observer exists
  Queue->>DurableSave: one active save with host strong validator
  DurableSave-->>Queue: saved or conflict / ambiguous failure
  alt saved
    Queue-->>Host: next distinct lifecycle snapshot and coherent replacement validator
  else blocked
    Queue-->>Host: blocked snapshot
    Host->>Queue: authenticated recovery / resume
    alt resume changes state
      Queue-->>Host: next distinct lifecycle snapshot
    else resume is false / no-op
      Queue-->>Host: no observer notification
    end
  end
```

## Autosave state machine

```mermaid
stateDiagram-v2
  [*] --> idle
  idle --> saving: enqueue
  saving --> idle: saved without pending
  saving --> saving: continue pending
  saving --> blocked: conflict or failure
  blocked --> saving: resume with pending
  blocked --> idle: resume without pending
  idle --> closed: close
  blocked --> closed: close
  saving --> closing: close during active save
  closing --> closed: active save settles
```

## SSR and native form sequence

```mermaid
sequenceDiagram
  participant Server
  participant Browser
  participant Editor
  participant NativeForm
  participant Host
  Server-->>Browser: escaped controlled native field value
  Browser->>Editor: client hydration and editor creation
  Editor->>NativeForm: mirror serialization on document transaction
  NativeForm-->>Host: untrusted submitted value
  Host->>Host: authenticate, authorize, validate, enforce tenant and concurrency policy
```

## Selection and revision capture

```mermaid
sequenceDiagram
  participant Caller
  participant EditorState
  participant RevisionDerivation
  Caller->>EditorState: request selection revision evidence
  EditorState->>EditorState: capture one immutable state and structural selection
  EditorState->>RevisionDerivation: canonical envelope from same state
  RevisionDerivation-->>Caller: frozen revision and structural coordinates
```

## Revision-scoped W3C text-position selector evidence

```mermaid
sequenceDiagram
  participant Caller
  participant EditorState as Immutable EditorState
  participant Projection as inkspan-prosemirror-text v1
  participant Grapheme as Intl.Segmenter grapheme validator
  participant Revision as Revision derivation
  participant Host as Host annotation service

  Caller->>EditorState: request text-position selector evidence
  EditorState->>EditorState: capture doc + selection once
  EditorState->>Projection: logical document + structural selection
  Projection->>Projection: project LF block separators + U+FFFC leaves
  Projection->>Grapheme: validate start/end boundaries
  alt grapheme segmentation unavailable or boundary invalid
    Grapheme-->>Caller: segmenter_unavailable or grapheme_boundary
  else valid boundaries
    Grapheme-->>Projection: valid boundaries
    Projection->>Projection: count Unicode code points
    EditorState->>Revision: canonical envelope from same captured doc
    Revision-->>Caller: exact strong revision
    Projection-->>Caller: frozen TextPositionSelector + projection identity
    Caller->>Host: revision + selector + projection under host policy
    Host->>Host: authorize source, persist/publish, re-anchor only if required
  end
```

ProseMirror structural positions and W3C text positions are distinct coordinate systems. The selector remains valid only for the exact revision and named projection. Inkspan does not include selected quote text in ordinary evidence and does not own annotation identifiers/bodies, source-resource IRI policy, authentication, authorization, tenancy, durable persistence, audit, publication, or cross-revision re-anchoring. ADR 0018 governs this protected-main authority.

## Provider-neutral Yjs collaboration sequence

```mermaid
sequenceDiagram
  participant Host
  participant Provider as Host-owned Yjs provider
  participant YDoc as Host-supplied Yjs document
  participant Inkspan
  participant Awareness as Host-governed awareness

  Host->>Provider: authenticate / authorize room and create lifecycle
  Provider<->>YDoc: synchronize host-owned updates
  Host->>Inkspan: mount with supplied YDoc / awareness binding
  Inkspan<->>YDoc: deterministic editor binding
  Inkspan<->>Awareness: bounded awareness presentation
  Note over Inkspan,Provider: Inkspan does not own credentials, room authorization, persistence, retention, or provider destruction
  Host->>Inkspan: unmount panel / editor
  Host->>Provider: retain or destroy provider according to host lifecycle
```

## naruon modular composition

```mermaid
flowchart TB
  Route[naruon route / product shell]
  Panel[naruon compose / ui.panel client boundary]
  Inkspan[Inkspan editor module]
  HostApi[Authenticated host API]
  Persistence[Host persistence and audit]
  Yjs[Host-owned Yjs provider]
  Orchestrator[Optional contextual-orchestrator]

  Route --> Panel --> Inkspan
  Panel --> HostApi --> Persistence
  Inkspan <--> Yjs
  Panel --> Orchestrator
  Orchestrator -. untrusted proposal .-> Panel
```

Inkspan remains importable without naruon or contextual-orchestrator.

## Deployment topology

```mermaid
flowchart LR
  Browser[Browser / desktop webview]
  InkspanJs[Inkspan JS/TS package]
  OfficeProcess[Optional deterministic Office renderer process/library]
  HostBackend[Host backend]
  HostDb[Host durable store]
  HostYjs[Host collaboration provider]
  HostModel[Host model gateway]

  Browser --> InkspanJs
  InkspanJs -->|host callback / application API| HostBackend
  HostBackend --> HostDb
  Browser <--> HostYjs
  HostBackend --> HostModel
  InkspanJs -->|explicit conversion request in supported deployment| OfficeProcess
```

The diagram does not imply a required network service owned by Inkspan. The Office renderer may be used as an independent library/tool under its package contract.

## Failure and degraded modes

```mermaid
flowchart TD
  Event{Failure boundary}
  Event -->|clipboard / import invalid| LocalReject[Reject safely; editor remains usable]
  Event -->|text-position evidence invalid or segmenter unavailable| SelectorReject[No selector evidence; document remains unchanged]
  Event -->|durable save conflict / ambiguity| SaveBlocked[Blocked until explicit host recovery]
  Event -->|Yjs provider unavailable| CollabDegraded[Host chooses local edit / read-only / reconnect / block]
  Event -->|model gateway unavailable| ManualMode[Deterministic manual editing continues]
  Event -->|Office render invalid / publication fails| RenderFailed[No successful artifact; source document preserved]
  Event -->|release evidence stale / incomplete| ReleaseBlocked[No publication]
```

## Authority and release evidence flow

```mermaid
flowchart TB
  InkspanAuthority[Inkspan deterministic authority] --> EditorSemantics[Editor / conversion / revision / selector semantics]
  HostAuthority[Host authority] --> HostServices[Transport / identity / tenancy / persistence / annotation / audit / model policy]
  MachineEvidence[Exact-head CI / security / package / browser / Office / provenance] --> ProtectedMerge[Protected merge]
  IndependentReview[Independent formal review where required] --> ProtectedMerge
  ProtectedMerge --> ReleaseAuthority[Exact protected release authority]
```
