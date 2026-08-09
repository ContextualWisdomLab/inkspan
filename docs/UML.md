# Inkspan Runtime Diagrams

Status: Proposed canonical baseline

## Component topology

```mermaid
flowchart LR
  HostApp[Host application] --> EditorCore[Inkspan editor]
  EditorCore --> ConversionCore[Deterministic conversion]
  EditorCore --> ClipboardBoundary[Safe clipboard]
  EditorCore --> EvidenceCore[Revision and selection evidence]
  EditorCore --> AutosaveCore[Local autosave coordinator]
  EditorCore --> CollaborationAdapter[Provider-neutral collaboration adapter]
  AutosaveCore --> HostSave[Host durable save callback]
  CollaborationAdapter --> HostProvider[Host collaboration provider]
  HostApp --> HostAuthority[Host auth tenancy persistence audit]
```

## Paste sequence

```mermaid
sequenceDiagram
  participant UserClipboard
  participant PastePipeline
  participant SafeClipboard
  participant EditorState
  UserClipboard->>PastePipeline: rich HTML
  PastePipeline->>SafeClipboard: transform pasted HTML
  SafeClipboard->>SafeClipboard: bounded inert parse and allowlist
  SafeClipboard-->>PastePipeline: sanitized content or bounded failure
  PastePipeline->>EditorState: parse and transact only accepted content
```

## Autosave sequence and no-op rule

```mermaid
sequenceDiagram
  participant Host
  participant Queue
  participant DurableSave
  Host->>Queue: enqueue revision evidence
  Queue-->>Host: saving snapshot when observer exists
  Queue->>DurableSave: one active save
  DurableSave-->>Queue: saved or conflict/failure
  alt saved
    Queue-->>Host: next distinct lifecycle snapshot
  else blocked
    Queue-->>Host: blocked snapshot
    Host->>Queue: resume
    alt resume changes state
      Queue-->>Host: next distinct lifecycle snapshot
    else resume is false/no-op
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
  Server-->>Browser: escaped controlled native field value
  Browser->>Editor: client hydration and editor creation
  Editor->>NativeForm: mirror serialization on document transaction
  NativeForm-->>Host: untrusted submitted value
```

## Selection and revision capture

```mermaid
sequenceDiagram
  participant Caller
  participant EditorState
  participant RevisionDerivation
  Caller->>EditorState: request selection revision evidence
  EditorState->>EditorState: capture one immutable state and selection
  EditorState->>RevisionDerivation: canonical envelope from same state
  RevisionDerivation-->>Caller: frozen revision and structural coordinates
```

## Authority boundaries

```mermaid
flowchart TB
  InkspanAuthority[Inkspan deterministic authority] --> EditorSemantics[Editor conversion revision semantics]
  HostAuthority[Host authority] --> HostServices[Transport identity tenancy persistence audit]
  MachineEvidence[CI security package provenance] --> ProtectedMerge[Protected merge]
  IndependentReview[Independent formal review where required] --> ProtectedMerge
  ProtectedMerge --> ReleaseAuthority[Release authority]
```
