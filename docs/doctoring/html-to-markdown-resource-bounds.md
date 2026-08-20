# HTML-to-Markdown resource bounds

Status: Implemented on active PR

## Purpose

Inkspan's standalone `htmlToMarkdown()` boundary accepts caller-provided HTML and
parses it through either a detached browser template or Turndown's browserless
parser. Protected shipped truth is currently
`main@3b38ead2d00f44eb578d0689087b9293b3dabe1e`; this active PR carries the
next-release bounded reliability contract and remains unintegrated. The contract
does not change transport, persistence, credentials, models, tenancy,
authorization, collaboration-provider, or network authority.

## Active-PR contract

`HtmlToMarkdownOptions.maxHtmlBytes` is an optional positive safe integer. The
active implementation defaults to 16 MiB and rejects configured values above a
64 MiB hard maximum. The public runtime option bag is snapshotted before source
sizing or parser work: only ordinary/null-prototype enumerable data properties
for `includeImageAlt` and `maxHtmlBytes` are accepted. Accessor-backed options
are rejected without invoking their getters. Exotic prototypes, symbol or
unknown keys, non-enumerable properties, malformed `includeImageAlt`, and
hostile reflection failures also fail closed through the stable resource error.

JavaScript Proxy meta-object traps are a distinct boundary: inspecting an
untrusted option object's prototype/descriptors necessarily performs language
reflection and can execute a Proxy `getPrototypeOf`, `ownKeys`, or
`getOwnPropertyDescriptor` trap. Inkspan does not claim otherwise. A thrown or
malformed reflection result is normalized to the payload-redacted
`HtmlToMarkdownResourceError` contract and is never reflected to diagnostics;
callers that require a no-caller-code boundary must pass ordinary or
null-prototype data objects rather than Proxies.

The HTML source itself must be a primitive string. Non-string runtime input is
rejected before reading caller properties, `TextEncoder` coercion, browser DOM
materialization, or browserless parsing. For accepted strings, Inkspan first
compares JavaScript UTF-16 code-unit length to the selected byte ceiling. Because
each code unit contributes at least one UTF-8 byte, that check can reject inputs
that are certainly oversized without allocating a complete encoded buffer.
Inputs not rejected by that lower bound receive an exact UTF-8 byte-length check
before any browser DOM or browserless Turndown parser is reached.

Oversized input raises a stable redacted error with name
`HtmlToMarkdownResourceError`, code `input_too_large`, and no caller-controlled
HTML in its message. Non-string input uses code `invalid_input`; malformed
runtime options/resource-limit configuration use code `invalid_configuration`.
Accepted safe-link, strict inline-raster, image-alt, normalization,
browserless-package, and deterministic conversion semantics remain unchanged.

## Verification

The active PR carries machine tests that prove:

- obvious oversize does not invoke `TextEncoder.encode()` or browser template
  creation;
- hostile non-string input is rejected before caller property access, encoding,
  or parser work and without leaking caller-thrown values;
- non-ASCII input still uses exact UTF-8 byte accounting;
- exact-boundary input remains accepted;
- accessor-backed option properties are rejected without executing their
  getters, while a hostile Proxy prototype-reflection trap is explicitly proven
  to execute once and its private thrown value is normalized/redacted;
- malformed option bags and wrong-type, fractional, zero, and above-maximum
  limits fail closed without reflecting input content; and
- the packed ESM runtime and strict TypeScript consumer exercise the public
  resource-bound surface while retaining the no-network/no-credential package
  authority check.

This document is active-PR truth only. It must not be represented as protected
behavior until the implementation is integrated into protected `main`. Issue
#118 continues to own the exact `0.6.0` protected release-candidate operational
boundary, so this next-release lane remains Draft and unmerged while that
identity is active.

## Rollback

Before protected integration, rollback removes this active-PR option, resource
policy module, regression tests, packed-consumer assertions, and this doctoring
record together. After integration, reducing the documented hard ceiling or
changing error codes/messages is a public compatibility decision and requires
versioned release treatment.
