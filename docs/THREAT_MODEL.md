# Inkspan Threat Model

Status: Protected-main canonical baseline

## Scope and trust boundary

Inkspan owns deterministic editor, conversion, canonical document-envelope, local revision/evidence, local autosave-ordering, accessibility metadata, and provider-neutral collaboration adapter behavior. A host owns network transport, authentication, authorization, tenant isolation, durable persistence, credentials, migrations, retention, deployment, audit storage, collaboration-provider lifecycle, and model-use policy.

Protected `main` is the implementation authority. Open pull requests are evidence of proposed or active work only and must not be treated as shipped security controls until protected integration.

## Protected assets

- document bodies and versioned `document_envelope` values;
- tenant-confidential equality metadata such as local revisions and durable strong entity tags;
- deterministic conversion artifacts and release packages;
- local lifecycle, selection, transition, and collaboration metadata;
- host-supplied callbacks, provider bindings, and authorization context that Inkspan must not reinterpret;
- package/release provenance and exact-head verification evidence.

Document bodies are content, not authorization. Revisions and strong validators are concurrency/equality evidence, not bearer credentials, signatures, tenant identifiers, or permission grants.

## Threat actors and inputs

Threats include malicious or malformed clipboard HTML, links, images, document envelopes, JSON/UTF-8 bytes, host callbacks, DOM capabilities, JavaScript proxies/accessors, form submissions, collaboration updates/awareness, Office-renderer input, package/release state, and compromised or misconfigured embedding hosts. Ordinary author mistakes and concurrent edits are treated as reliability threats when they can cause data loss or false durable-success claims.

## Principal threat scenarios

### Rich clipboard and active content

Untrusted clipboard HTML can attempt script execution, external resource fetches, hidden-content smuggling, SVG/MathML or embedded active content, malformed tree reconstruction, unsafe links, resource exhaustion, or browser-parser differentials. The supported contract is fail-closed bounded semantic sanitization in the actual TipTap/ProseMirror paste pipeline. Cross-engine Chromium, Firefox, and WebKit differential evidence is a release-assurance requirement for the richer sanitizer line; deterministic jsdom evidence alone must not be represented as universal browser conformance.

### Links, images, and external resources

URLs or image-like content can exfiltrate document context, induce unexpected network access, or smuggle executable/active payloads. Inkspan validates only supported local semantics and does not grant network authority. Hosts remain responsible for downstream CSP, fetch policy, proxy/egress controls, content serving, and tenant authorization.

### Spreadsheet formula injection

XLSX cell values beginning with formula-significant prefixes can become executable spreadsheet formulas when opened by a user. Deterministic Office rendering must preserve the documented formula-injection neutralization boundary and never silently convert untrusted strings into formulas. No macro, network, or Desktop Office execution is part of the renderer contract.

### Malformed Office structures and publication races

DOCX/XLSX/PPTX generation must reject unsupported or malformed structures, invalid XML 1.0 content, excessive nesting/container growth, invalid worksheet names, invalid freeze panes, and package-bound violations. File publication must be race-safe, deterministic, and explicit about overwrite behavior. A successful local build is not durable release publication authority.

### SSR and native forms

A hidden/native form field contains client-controlled submission data. It is not authentication, authorization, CSRF protection, tenant identity, integrity proof, or durable-write evidence. Server rendering must not construct the browser editor. Hosts must validate and authorize submitted values independently.

### Revision, selection, transition, and autosave evidence

Local SHA-256 revisions identify deterministic content equality only. Selection coordinates are structural positions bound to one exact editor state and are not durable cross-revision anchors. Transition evidence does not prove actor, time, authorization, or durable persistence. Autosave observers must emit only document-free lifecycle metadata; observer failures cannot alter ordering or save outcomes. Durable compare-and-swap requires a host/server-selected strong validator under RFC 9110 semantics and must not be replaced with a local content digest.

### Concurrency and stale state

Concurrent editors, delayed digests, stale selections, ambiguous transport failure, or stale durable validators can cause lost updates or false success. Inkspan must bind asynchronous evidence to one immutable local state, keep autosave single-flight with bounded pending work, fail closed on ambiguous durable outcomes, and require explicit recovery from blocked conflict/failure states. Hosts own atomic persistence transactions and durable conflict resolution.

### Collaboration and Yjs

Inkspan may bind to Yjs-compatible document/awareness surfaces but does not own provider creation, room authorization, tenant identity, persistence, retention, or durable audit. Yjs updates and awareness metadata can contain sensitive tenant information. Host providers must authenticate rooms, authorize membership, bound awareness disclosure, and apply retention/encryption policy. Inkspan must not silently create a network provider or elevate an awareness update into authorization.

### Model-assisted authoring

Model output is untrusted proposed content. Deterministic editor/conversion validation remains authoritative. Inkspan must not own or expose model credentials, route models, authorize external data use, or treat model output as approved durable content. Hosts own model policy, redaction, routing, logging, retention, user approval, and tenant disclosure decisions.

### Release and supply chain

Stale draft assets, digest mismatch, mutable dependency/workflow references, absent SBOM/provenance, package drift, or stale exact-head checks can produce unverifiable releases. Publication must fail closed on ambiguous artifact inventory or digest mismatch. Exact-head CI/security/package/provenance evidence does not transfer after source movement. Automated comments/statuses are not formal approval.

## Security invariants

1. No Inkspan code path acquires host transport, tenant, credential, durable-storage, or model-routing authority implicitly.
2. Untrusted document/clipboard/form/Office input is validated before it reaches privileged or durable boundaries.
3. Public failures are bounded and redacted; document bodies, secrets, private exception causes, and tenant values are not reflected into generic diagnostics.
4. Resource ceilings apply before expensive traversal, parsing, hashing, rendering, or packaging where practical.
5. Provider-neutral collaboration cannot create or destroy the host provider.
6. Lifecycle and evidence metadata remains document-free unless an explicit versioned contract says otherwise.
7. Deterministic conversion is separate from model-assisted authoring.
8. Release authority requires exact integrated protected-head evidence and repository policy, not local or predecessor evidence.

## Verification and residual risk

Verification uses exact owned production coverage, hostile-input regression tests, packed ESM/CommonJS/strict-TypeScript consumers, SSR tests, deterministic Office renderer tests, security scanning, package inspection, documentation contracts, and release evidence. Real-browser parser differential testing is required where the browser itself materially participates in security semantics.

Residual risk remains in embedding-host policy, browser engine behavior, downstream renderers/viewers, provider implementations, host persistence/authorization, model providers, and deployment configuration. Those risks must be addressed by host controls rather than by expanding Inkspan authority.

## Rollback

A security feature that proves unsafe is removed or disabled at the narrow Inkspan boundary while preserving canonical document readability and host-owned durable state. Rollback must not rewrite tenant persistence, weaken host authorization, or reinterpret release evidence. Material security-boundary changes require an ADR and fresh exact-head verification.
