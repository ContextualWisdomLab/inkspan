# TipTap v2 ProseMirror paste adapter

## Decision

Inkspan registers SafeClipboard through a TipTap v2 extension whose
`addProseMirrorPlugins` hook returns a ProseMirror `Plugin` with a
`transformPastedHTML` editor property. That property receives rich clipboard
HTML before ProseMirror parses it into an editor document.

The adapter is shared by the standalone `CwlEditor` and provider-neutral Yjs
`CollaborativeCwlEditor` surfaces. The pure sanitizer remains independently
callable for headless conversion and verification. This preserves the ownership
boundary: Inkspan owns deterministic editor and conversion behavior, while a
host owns transport, authorization, tenant isolation, persistence, credentials,
retention, migration, and model-use policy.

## Root cause

Inkspan locks `@tiptap/core 2.27.2`. The first implementation placed a
`transformPastedHTML` field directly on a TipTap extension configuration and its
unit tests invoked that field manually. That appeared consistent with current
TipTap documentation, but it did not prove registration in the installed v2
runtime.

The exact versioned `ExtensionManager.ts` for 2.27.2 is decisive. Its plugin
assembly reads `addProseMirrorPlugins` and appends the returned ProseMirror
plugins. It does not collect an arbitrary direct extension
`transformPastedHTML` field into editor props. The locked source is authoritative
for the installed runtime, while current mutable documentation is useful design
context but not evidence that an API existed in this historical dependency
version.

The practical result was a false assurance gap: direct sanitizer unit tests were
green, but the real `editor.view` paste pipeline had no SafeClipboard
`transformPastedHTML` property and could parse hostile HTML without the intended
pre-parse reconstruction.

## Test-first evidence

Commit `2e1d634bd819686b298256f9bac161e4f6e90067` changed the standalone
integration tests to invoke the complete ProseMirror editor-property chain via
`editor.view.someProp("transformPastedHTML", ...)` instead of calling an
extension configuration method directly.

CI run `31172315841` failed all three standalone clipboard integration tests with
the deterministic message that the SafeClipboard paste transform was not
installed. This is the RED evidence for the actual runtime defect.

The repair adds `SafeClipboardExtension.ts`, registers one ProseMirror plugin,
and exercises the same editor-property chain on standalone and collaborative
surfaces. A competing host plugin appends a script and a tracking image before
the safety plugin runs; the final HTML contains neither resource-bearing markup
nor fallback secret text.

Repository CI remains authoritative. A predecessor-head test or locally reasoned
result is not completion evidence for a later exact head.

## Ordering and residual host boundary

TipTap v2.27.2 sorts extension priorities from higher to lower when resolving
extensions and again when assembling ProseMirror plugins. ProseMirror checks
plugin-provided editor properties in plugin order. SafeClipboard therefore uses
a deliberately low priority so ordinary host transforms run first and the
sanitizer is the final supported HTML transform before ProseMirror parses the
fragment.

This is a modular-composition guarantee, not a sandbox against the host. A host
that deliberately installs a plugin with an even lower priority, replaces
editor props after construction, or bypasses the shared Inkspan extension kit
can execute after the sanitizer. Such a host already controls the editor
process and must be treated as part of the trusted integration boundary.
Inkspan's tests protect against accidental ordinary extension composition, not a
malicious host with arbitrary code execution.

## Fail-closed behavior

The adapter preserves the original nested `ClipboardConfig` object and validates
it only at rich-paste time. Accessor, proxy, symbol-key, non-enumerable-key, and
unknown-key failures are converted to stable redacted product errors. The
adapter returns an empty string when sanitization fails, and a throwing host
observer cannot restore or disclose rejected source HTML.

Plain-text paste remains outside this HTML reconstruction path. HTML images and
other resource-bearing elements remain dropped rather than fetched or converted.
No network, persistence, credential, tenant, model, database, or authorization
responsibility is added to Inkspan.

## Compatibility and rollback

The public package exports the registered SafeClipboard adapter and its
`PluginKey`; the pure sanitizer and redacted error types remain available as
separate deterministic surfaces. Packed-package, strict TypeScript, ESM,
CommonJS, SSR-import, demo, and collaborative tests must continue to pass.

A rollback must restore an equivalent pre-parse ProseMirror editor property and
real-pipeline tests. Reverting only the adapter while retaining direct sanitizer
unit tests would recreate the original false assurance condition.

No formal TipTap, ProseMirror, W3C, OWASP, or NIST conformance is claimed.

## APA 7 references

Haverbeke, M. (n.d.). *ProseMirror reference manual: Editor props*. Retrieved
August 7, 2026, from https://prosemirror.net/docs/ref/

TipTap GmbH. (n.d.). *Extension API*. TipTap Editor Docs. Retrieved August 7,
2026, from
https://tiptap.dev/docs/editor/extensions/custom-extensions/create-new/extension

TipTap GmbH. (2025). *ExtensionManager.ts (Version 2.27.2)* [Source code].
GitHub. Retrieved August 7, 2026, from
https://github.com/ueberdosis/tiptap/blob/%40tiptap/core%402.27.2/packages/core/src/ExtensionManager.ts
