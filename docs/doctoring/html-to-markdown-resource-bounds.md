# HTML-to-Markdown resource bounds

Status: Implemented on active PR

## Purpose

Inkspan's standalone `htmlToMarkdown()` boundary accepts caller-provided HTML and
parses it through either a detached browser template or Turndown's browserless
parser. Protected `main@50ac98cfa0ad9e8dd75f93ca437a5679fed4d804` has no
conversion-level input ceiling before that parser materialization. This active
PR adds a bounded reliability contract without changing transport, persistence,
credentials, models, tenancy, authorization, collaboration-provider, or network
authority.

## Active-PR contract

`HtmlToMarkdownOptions.maxHtmlBytes` is an optional positive safe integer. The
active implementation defaults to 16 MiB and rejects configured values above a
64 MiB hard maximum. Inkspan first compares JavaScript UTF-16 code-unit length
to the selected byte ceiling. Because each code unit contributes at least one
UTF-8 byte, that check can reject inputs that are certainly oversized without
allocating a complete encoded buffer. Inputs not rejected by that lower bound
receive an exact UTF-8 byte-length check before any browser DOM or browserless
Turndown parser is reached.

Oversized input raises a stable redacted error with name
`HtmlToMarkdownResourceError`, code `input_too_large`, and no caller-controlled
HTML in its message. Invalid resource-limit configuration fails closed with code
`invalid_configuration`. Existing safe-link, strict inline-raster, image-alt,
normalization, browserless-package, and deterministic conversion semantics stay
unchanged for accepted inputs.

## Verification

The active PR carries machine tests that prove:

- obvious oversize does not invoke `TextEncoder.encode()` or browser template
  creation;
- non-ASCII input still uses exact UTF-8 byte accounting;
- exact-boundary input remains accepted;
- wrong-type, fractional, zero, and above-maximum limits fail closed without
  reflecting input content; and
- the packed ESM runtime and strict TypeScript consumer exercise the new public
  option while retaining the no-network/no-credential package authority check.

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
