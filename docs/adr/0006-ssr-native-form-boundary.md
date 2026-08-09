# ADR 0006: SSR and native form client-controlled boundary

Status: Proposed

## Context

Inkspan must support server-rendered shells and optional native form integration without instantiating a browser editor on the server or treating a hidden field as trusted server state. Hydration must not lose the chosen initial value, and form serialization must stay synchronized once the editor becomes authoritative.

## Alternatives considered

- Construct TipTap/ProseMirror during server rendering. Rejected because editor-view behavior depends on browser/DOM capabilities and risks hydration divergence.
- Treat the native form field as a durable/authenticated document channel. Rejected because browser-controlled fields are untrusted request input.
- Omit all native-form support. Rejected because standards-based host forms benefit from an optional synchronized submission surface.
- Emit an escaped client-controlled field only when explicitly enabled, then mirror editor transactions after hydration. Selected.

## Decision

Server rendering never constructs a TipTap/ProseMirror editor view. When `formFieldName` is explicitly enabled, Inkspan emits the selected controlled Markdown/HTML serialization as an escaped read-only native input value through SSR and matching hydration. Once the editor is authoritative, document transactions synchronously mirror the current serialization into the native field. The submitted value is client-controlled input only.

## Consequences

SSR hosts can participate in native form flows while preserving hydration continuity. Hosts remain responsible for authentication, authorization, CSRF defenses, tenant isolation, request validation/limits, durable concurrency, persistence, and acceptance. Hosts that cannot place a document body in server HTML must not enable this field.

## Failure and recovery

Invalid or stale client values never become authorization or durable evidence. Native resets cannot silently desynchronize a configured field from an editor the host intentionally retains. If SSR/form integration proves unsafe for a host, omit the field and use an explicit host transport after independent server validation.

## Security and privacy impact

The native field is intentionally treated as attacker-controlled request data. Inkspan escapes serialized content and does not assign authentication, CSRF, tenant, signature, integrity, or durable-write authority to it. Because enabling the field can place the document body in HTML/form submission, hosts with stricter disclosure or retention requirements must opt out and use their own authorized transport.

## Compatibility and migration

`formFieldName` remains opt-in, so existing consumers keep their current transport behavior. Hosts adopting it must validate and authorize the submitted value exactly as any other client input. Future changes to field naming, serialization mode, hydration, or reset semantics require SSR/hydration compatibility tests and migration guidance; rollback is to remove the optional field without changing canonical document semantics.

## Verification

Use `renderToString`/SSR tests, controlled-over-default precedence, escaping cases, hydration continuity, synchronous transaction-to-`FormData` tests, reset behavior, opt-out non-disclosure, no server editor construction, and documentation contracts.

## Rollback or supersession

Rollback disables `formFieldName` or returns the host to explicit client transport without changing canonical document semantics. Supersession requires equivalent SSR safety, client-controlled-input treatment, compatibility tests, and a migration/rollback note.
