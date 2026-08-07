# Doctoring record: toolbar shortcut discoverability

## Decision

Inkspan exposes only keyboard shortcuts that the configured editor actually implements through the WAI-ARIA `aria-keyshortcuts` state on the corresponding native toolbar button. The public contract remains descriptive rather than behavioral: the attribute makes existing editor commands programmatically discoverable but does not create, intercept, authorize, or remap keyboard input.

The exact built-in shortcut alternatives are:

- bold: `Control+B Meta+B`;
- italic: `Control+I Meta+I`;
- undo: `Control+Z Meta+Z`; and
- redo: `Control+Shift+Z Meta+Shift+Z`.

The link control intentionally has no `aria-keyshortcuts` value. The configured Tiptap Link extension does not bind a keyboard shortcut, and Inkspan's `SafeLink` extension adds URI validation plus transaction filtering without adding an `addKeyboardShortcuts` implementation. The toolbar therefore no longer labels link editing as `Ctrl/Cmd+K`. Controls for which Inkspan does not implement a stable keyboard shortcut do not emit `aria-keyshortcuts`.

## Buyer-visible gap and bounded scope

Before this slice, implemented bold, italic, undo, and redo shortcuts appeared in toolbar titles while assistive technology received no programmatic shortcut metadata. That asymmetry weakened accessible command discovery in enterprise authoring workflows.

The first implementation pass also treated the pre-existing `Ctrl/Cmd+K` link title as proof that a link shortcut existed. Current authoritative Tiptap documentation explicitly identifies the Link extension as having no keyboard shortcut, and repository inspection confirms `SafeLink` does not add one. Advertising `Control+K Meta+K` would therefore have created false accessibility metadata and retained a misleading visible tooltip. The repair removes that false claim rather than inventing a new keyboard behavior inside an accessibility-metadata change.

This repair changes only the editor-owned presentation and accessibility surface. It does not alter document semantics, implemented shortcut execution, transport, authorization, tenant isolation, persistence, credentials, migration, retention, audit policy, model-use policy, collaboration ownership, or release authority. Hosts still own application-level shortcut conflict management and any host-added link shortcut.

## Test-first evidence

The slice was implemented test-first from protected `main` `ca49a3249403be88ba3cb7c9589b3652f820e17c`.

1. RED commit `303149b4d3e586ba32c1306d1a7d98542142d9d3` added the initial shortcut metadata contract before production support.
2. GREEN commit `29d8c156e40eb0975687ee83053bedf3de7d77a5` added the optional, documented `keyShortcuts` button property and emitted it through `aria-keyshortcuts`.
3. Documentation contract commit `513dcdc26a5cbaef333cf822a2e191f43a3eda70` added deterministic assertions for the public accessibility contract, standards evidence, doctoring lineage, and changelog traceability before the corresponding documentation was written.
4. Independent source verification then found that the link shortcut assumption was invalid: Tiptap's Link extension does not bind a shortcut, and Inkspan's configured `SafeLink` adds none. RED commit `57f5ef8e21f8351fa04c122e700b43777c9ea57e` changed the accessibility regression to reject `aria-keyshortcuts` and `Ctrl/Cmd+K` on the link button while production still advertised both.
5. GREEN production commit `e89f51e87e84552247c7080aa61800c7da813e40` removed only the false link shortcut metadata and visible shortcut label while preserving the link button's existing prompt-driven command.
6. Documentation RED commit `251d660ed9b0aebbffaa0ca715b33eb39aa93729` bound the public contract to the implemented-shortcut boundary and official Tiptap Link documentation before the explanatory documents were corrected.

All exact-head CI, 100% production statement/branch/function/line coverage, security, packaging, review, and branch-protection evidence remains release-gated; no predecessor-head or local-only result is acceptance evidence.

## Standards analysis

WAI-ARIA 1.2 defines `aria-keyshortcuts` as a way to indicate keyboard shortcuts that an author has implemented. Its value is a space-separated list of shortcuts; each shortcut combines zero or more modifier keys and exactly one non-modifier key with plus signs. The normative modifier token is `Control`; `Meta` represents the Meta key and maps to Command on macOS. This supports expressing Windows/Linux and macOS alternatives without inventing the presentation-only `Ctrl/Cmd` abbreviation inside accessibility metadata.

The ARIA Authoring Practices Guide toolbar pattern recommends a single toolbar tab stop with directional movement among controls, with Home/End available as optional navigation. Inkspan already implements that composite interaction. Adding shortcut metadata is therefore complementary: it improves command discoverability without disturbing roving focus, native button activation, disabled-control behavior, or `aria-pressed` state.

Tiptap's official Link extension documentation states that the extension provides no keyboard shortcut and suggests that applications may choose to open custom link UI from their own `Mod-k` binding. Inkspan does not currently implement such a binding. Descriptive ARIA metadata must follow the shipped behavior rather than imply a future or host-specific shortcut.

## Security, privacy, and ownership boundary

`aria-keyshortcuts` contains only static command metadata. It carries no document content, selection text, tenant identifier, credentials, provider information, persistence validator, local path, or user-specific shortcut history. The values are safe to expose in rendered markup and release evidence.

Inkspan does not use shortcut metadata as an authorization signal. A host that disables, shadows, intercepts, or adds a shortcut remains responsible for its own accessible interaction design. No host may infer document permission or durable operation authority from the presence of a toolbar button or its accessibility state.

## Compatibility and rollback

The property is optional within Inkspan's internal toolbar-button contract and serializes to an ordinary ARIA attribute only on the four mapped built-in shortcut buttons. Browsers or assistive technologies that do not surface the state continue to receive the same native button labels, focus behavior, and command implementation as before. Link editing retains its existing button and prompt-driven command; only the unsupported shortcut claim is removed.

Rollback is bounded: remove the four `keyShortcuts` assignments, the optional property and emitted `aria-keyshortcuts` state, the focused regression tests, and this doctoring entry. No persisted document, schema, migration, host protocol, or package subpath requires conversion.

## Evidence boundary

Shareable evidence may include the static shortcut values, committed tests and documentation, exact commit identifiers, and CI/review status. Local assistive-technology recordings, user documents, host application keymaps, tenant policies, credentials, or private interaction telemetry are not required for this repository-level acceptance slice and must not be copied into public release evidence.

## APA 7 references

Tiptap. (n.d.). *Link extension*. Tiptap Editor Docs. Retrieved August 8, 2026, from https://tiptap.dev/docs/editor/extensions/marks/link

World Wide Web Consortium. (2023, June 6). *Accessible Rich Internet Applications (WAI-ARIA) 1.2* (W3C Recommendation). https://www.w3.org/TR/wai-aria-1.2/

World Wide Web Consortium. (n.d.). *Toolbar pattern*. ARIA Authoring Practices Guide. Retrieved August 8, 2026, from https://www.w3.org/WAI/ARIA/apg/patterns/toolbar/
