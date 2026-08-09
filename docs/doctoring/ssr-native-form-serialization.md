# SSR native form serialization

## Decision

When a standalone `CwlEditor` host explicitly supplies `formFieldName`, Inkspan
renders the selected Markdown or HTML prop value into the native hidden form
field in the server-generated shell. A controlled `value` takes precedence over
`defaultValue`, matching the document source selected for initial TipTap
construction. React owns attribute escaping, so source HTML is serialized as an
ordinary form-control value rather than injected as markup.

The field is rendered as a `readOnly` controlled React input. Before TipTap is
authoritative, its controlled value is the selected server/client prop value.
After TipTap becomes authoritative, the existing transaction subscriber stores
the current serialization in the shared value ref and writes it directly to
`HTMLInputElement.value` before a transaction returns. Subsequent React renders
read that same serialization rather than restoring an older server/default
value. This preserves synchronous `FormData` and native-submission behavior
without waiting for a React state update.

If `formFieldName` is absent, no document-bearing hidden input is rendered. A
reset-only unnamed field remains empty. `CollaborativeCwlEditor` does not place
Yjs content into server markup because its authoritative document becomes
available only after the host-owned client collaboration lifecycle is bound.

## Root cause and test-first evidence

The pre-existing SSR shell rendered a named hidden input but gave it no server
value because the TipTap editor is intentionally `null` until client hydration.
The browser later received a synchronized value, but an enterprise host reading
or submitting server HTML before JavaScript ran could not receive the configured
document value.

Commit `fb37cd9a4344a3b369553c49eb4bf557c082c7da` introduced a Node
`renderToString` regression first. CI run `31177509823` failed because the
server output contained the expected hidden input, `name`, and external `form`
association but omitted the escaped `value` attribute. The implementation then
added the explicit pre-hydration handoff and focused browser-DOM tests for
initial-value retention, pre-editor prop updates, and reset-only non-disclosure.

A later review found that this doctoring record described the field as an
uncontrolled `defaultValue` input even though the implementation deliberately
uses a `readOnly` controlled `value` backed by the same serialization ref that
serves synchronous DOM writes. A deterministic documentation contract was added
first to reject that mismatch, then this record was corrected without changing
runtime behavior.

## HTML and hydration contract

The WHATWG HTML Standard defines a hidden input as a submittable
form-associated element whose data is an arbitrary string. Its `name` supplies
the form-entry name, its `form` attribute can associate it with an external form,
and its value supplies the submitted value unless the control is disabled or
otherwise excluded by the form-data construction algorithm.

React server APIs generate the initial HTML representation. `hydrateRoot`
expects the first client render to match that server output, so Inkspan renders
the same controlled value on the server and during hydration. The field is
`readOnly`: user editing is not an input path. Before TipTap initialization, prop
updates remain authoritative. Once the editor is initialized, synchronous
imperative writes and the shared serialization ref keep the native field aligned
with editor transactions; a later React render therefore consumes the latest
serialized value rather than a stale initial prop.

This contract applies to `renderToString` and to streaming React server APIs
because the component tree emits the same input element. It does not claim that
a server renderer has created or validated a TipTap document.

## Security and privacy boundary

A hidden field is hidden from ordinary layout, not secret. Its value is present
in page source, the DOM, browser developer tools, form submission, extensions,
and any intermediary that can observe the response or request. Hosts must not
use `formFieldName` when server markup must omit the document body. They must
apply appropriate response caching, content classification, transport security,
and tenant authorization before rendering private content.

Every hidden-field value is client-controlled submission data. The server must
revalidate document syntax and resource limits, authenticate the request,
authorize the actor and tenant, enforce CSRF protections, and perform durable
concurrency and persistence checks. The field is not an authorization grant,
signature, CSRF token, tenant identifier, integrity proof, strong entity tag, or
proof that the browser submitted an unchanged server value.

OWASP documents hidden fields as one possible transport for synchronized CSRF
tokens, while also requiring server validation and protecting those tokens from
logs and URLs. Inkspan does not generate, store, or validate CSRF tokens; that
responsibility remains host-owned and separate from the document field.

Inkspan owns deterministic value selection, safe React serialization, hydration
continuity, and synchronous post-hydration mirroring. Hosts retain form action
and method, authentication, authorization, tenant isolation, CSRF defenses,
request-size limits, persistence, credentials, migration, retention, audit,
conflict policy, and model-use policy.

## Standalone and modular MSA behavior

The feature requires no transport, database, environment variable, provider,
model, or collaboration dependency. A standalone application can submit the
native field directly. A naruon `compose` or `ui.panel` host can associate the
field with its own form through `formId`, including when the form is outside the
editor subtree.

Server-selected data and authorization remain host concerns. Inkspan does not
create a database object. A host persistence object introduced for submitted
editor data should use at least two descriptive words and `snake_case` by
default, or a valid ecosystem-required CamelCase/PascalCase form.

## Verification and rollback

Exact-head tests require:

- controlled `value` precedence over `defaultValue` in server markup;
- `readOnly` controlled-field semantics across SSR, hydration, and rerenders;
- safe HTML-attribute escaping by React;
- preservation of native `name` and external `form` association;
- no TipTap/ProseMirror server construction;
- no document-bearing field when form serialization is not configured;
- retention and updates before the editor exists;
- empty reset-only unnamed fields;
- existing synchronous transaction-to-`FormData`, disabled-field, mode-change,
  reset, external-form, and collaborative client contracts; and
- repository-wide 100% production statement, branch, function, and line
  coverage plus packaging and SSR-import evidence.

Rollback removes the initial-value prop path and this evidence. No stored-data,
database, tenant, credential, migration, or release rollback is required.
Before rollback, hosts relying on no-JavaScript form submission must provide an
equivalent server-owned field or accept that the initial form entry is empty.

No formal WHATWG, React, OWASP, accessibility, security, or privacy conformance
is claimed.

## APA 7 references

Meta Platforms, Inc. (n.d.). *hydrateRoot*. React. Retrieved August 7, 2026,
from https://react.dev/reference/react-dom/client/hydrateRoot

Meta Platforms, Inc. (n.d.). *renderToString*. React. Retrieved August 7, 2026,
from https://react.dev/reference/react-dom/server/renderToString

OWASP Foundation. (n.d.). *Cross-site request forgery prevention cheat sheet*.
OWASP Cheat Sheet Series. Retrieved August 7, 2026, from
https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html

WHATWG. (2026). *HTML Standard: Form control infrastructure*. Retrieved August
7, 2026, from
https://html.spec.whatwg.org/multipage/form-control-infrastructure.html

WHATWG. (2026). *HTML Standard: The input element*. Retrieved August 7, 2026,
from https://html.spec.whatwg.org/multipage/input.html
