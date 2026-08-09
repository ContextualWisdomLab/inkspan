# ADR 0006: SSR and native form client-controlled boundary

Status: Proposed

## Context

Inkspan must support server-rendered shells and optional native form integration without instantiating a browser editor on the server or treating a hidden field as trusted server state. Hydration must not lose the chosen initial value, and form serialization must stay synchronized once the editor becomes authoritative.

## Decision

Server rendering never constructs a TipTap/ProseMirror editor view. When `formFieldName` is explicitly enabled, Inkspan emits the selected controlled Markdown/HTML serialization as an escaped read-only native input value through SSR and matching hydration. Once the editor is authoritative, document transactions synchronously mirror the current serialization into the native field. The submitted value is client-controlled input only.

## Consequences

SSR hosts can participate in native form flows while preserving hydration continuity. Hosts remain responsible for authentication, authorization, CSRF defenses, tenant isolation, request validation/limits, durable concurrency, persistence, and acceptance. Hosts that cannot place a document body in server HTML must not enable this field.

## Failure and recovery

Invalid or stale client values never become authorization or durable evidence. Native resets cannot silently desynchronize a configured field from an editor the host intentionally retains. If SSR/form integration proves unsafe for a host, omit the field and use an explicit host transport after independent server validation.

## Verification

Use `renderToString`/SSR tests, controlled-over-default precedence, escaping cases, hydration continuity, synchronous transaction-to-`FormData` tests, reset behavior, opt-out non-disclosure, no server editor construction, and documentation contracts.

## Rollback or supersession

Rollback disables `formFieldName` or returns the host to explicit client transport without changing canonical document semantics. Supersession requires equivalent SSR safety, client-controlled-input treatment, compatibility tests, and a migration/rollback note.
