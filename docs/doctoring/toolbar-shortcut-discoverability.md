# Doctoring record: toolbar shortcut discoverability

## Decision

Inkspan exposes only keyboard shortcuts that the shipped editor actually implements through the WAI-ARIA `aria-keyshortcuts` state on the corresponding native toolbar button. The public contract remains descriptive rather than behavioral: the attribute makes existing editor commands programmatically discoverable but does not create, intercept, authorize, or remap keyboard input.

The exact built-in shortcut alternatives are:

- bold: `Control+B Meta+B`;
- italic: `Control+I Meta+I`;
- link editing: `Control+K Meta+K`;
- undo: `Control+Z Meta+Z`; and
- redo: `Control+Shift+Z Meta+Shift+Z Control+Y Meta+Y`.

The redo metadata intentionally exposes both shortcut families implemented by the configured Tiptap history behavior: `Ctrl/Cmd+Shift+Z` and `Ctrl/Cmd+Y`. Tiptap's Link extension itself does not provide a default shortcut, but Inkspan implements `Control+K Meta+K` at the editor-surface level in `EditorFrame`: the handler intercepts `Ctrl/Cmd+K`, prevents the browser default, and invokes the same prompt-driven safe-link command family used by the toolbar. The link button therefore exposes that shipped Inkspan binding rather than inferring behavior from the extension alone. Controls for which Inkspan does not implement a stable keyboard shortcut do not emit `aria-keyshortcuts`.

## Buyer-visible gap and bounded scope

Before this slice, implemented bold, italic, undo, and redo shortcuts appeared in toolbar titles while assistive technology received no programmatic shortcut metadata. That asymmetry weakened accessible command discovery in enterprise authoring workflows.

An early source review incorrectly scoped link-shortcut verification to Tiptap's Link extension and Inkspan's `SafeLink` extension. Those extensions do not add a default keymap, so the first repair removed the existing `Ctrl/Cmd+K` toolbar claim. A later exact-head repository-level review correctly inspected `src/components/EditorFrame.tsx` and found the already-shipped editor-surface binding. The prior conclusion was therefore false even though the extension-level observation was true. The bounded correction restores truthful discoverability for the existing command; it does not invent a new link shortcut.

The same distinction applies to buyer-facing documentation. README link-policy text must describe the actual Inkspan command surface rather than attribute the shortcut to Tiptap. The relevant behavior is owned by Inkspan's editor shell: `Ctrl/Cmd+K` enters the same validated link workflow while SafeLink continues to own URI validation and transaction filtering.

Exact dependency review also found a second asymmetry: Inkspan initially advertised only `Ctrl/Cmd+Shift+Z` for redo even though the configured Tiptap history and collaboration behavior also implements `Ctrl/Cmd+Y`. Current official Tiptap Undo/Redo and Collaboration documentation independently lists both redo alternatives. RED commit `11439733245d76c6dc3b58f4fb9bf2105ac94b43` bound the toolbar to both alternatives before production changed; GREEN commit `bc634bf2f3237e58156ad68691b140ab90718992` then added only the missing redo metadata and visible title alternative. No new keyboard behavior was invented.

This repair changes only the editor-owned presentation, shortcut-discovery, tests, and documentation surfaces. It does not alter document semantics, transport, authorization, tenant isolation, persistence, credentials, migration, retention, audit policy, model-use policy, collaboration ownership, or release authority. Hosts still own application-level shortcut conflict management and any host-added or host-remapped command.

## Test-first evidence

The slice was implemented test-first from protected `main` `ca49a3249403be88ba3cb7c9589b3652f820e17c`.

1. RED commit `303149b4d3e586ba32c1306d1a7d98542142d9d3` added the initial shortcut metadata contract before production support.
2. GREEN commit `29d8c156e40eb0975687ee83053bedf3de7d77a5` added the optional, documented `keyShortcuts` button property and emitted it through `aria-keyshortcuts`.
3. Documentation contract commit `513dcdc26a5cbaef333cf822a2e191f43a3eda70` added deterministic assertions for the public accessibility contract, standards evidence, doctoring lineage, and changelog traceability before the corresponding documentation was written.
4. Extension-scoped verification found that Tiptap's Link extension does not bind a shortcut and Inkspan's `SafeLink` adds none. RED commit `57f5ef8e21f8351fa04c122e700b43777c9ea57e` therefore changed the accessibility regression to reject `aria-keyshortcuts` and `Ctrl/Cmd+K` on the link button.
5. GREEN commit `e89f51e87e84552247c7080aa61800c7da813e40` removed that link metadata while preserving the prompt-driven command. Subsequent documentation commits propagated the same extension-scoped conclusion.
6. Buyer-facing documentation RED `9c8a6b0c0332c4f6a3bd0c5e373be87eb79ac50b` and GREEN `a6c472e9b2aa3ec0f4cbf9663613243ed410faab` removed the stale README shortcut claim under that then-current interpretation; release-evidence RED `8ffa71914ec7cdb62176db19045378e30a075ee2` retained the traceability.
7. Redo-alternative RED `11439733245d76c6dc3b58f4fb9bf2105ac94b43` and GREEN `bc634bf2f3237e58156ad68691b140ab90718992` exposed the already-implemented `Control+Y Meta+Y` redo alternative. Redo documentation RED `52d38471cbc24be5792d7a32bf2319a039668622` and accessibility GREEN `877ee37ecb1d97fa447db77869f2193530e45a31` bound that correction to official Tiptap evidence.
8. Exact-head automated repository review then found the missed `EditorFrame` `Ctrl/Cmd+K` binding. RED commit `8790b4e50bced266b38763c6301097aaeb775e4b` requires the link button to expose `Control+K Meta+K` and the matching visible title.
9. Production commit `19f4d99ab1d9a548b6a843806e9c3926f4ec0f75` restores link shortcut metadata without changing link execution. A full-file connector edit accidentally changed the unrelated delete-row command; corrective commit `920fdb25c21022186acdf9782da6a16bb160a41d` immediately restored the original `deleteRow()` call before further work.
10. Documentation-contract RED commit `f38b09817e0af22a4df95c1b9d392ea3f2274b8d` requires accessibility, doctoring, README, and changelog evidence to state the repository-level shortcut truth. Accessibility documentation commit `8d12af4a77b9dec028cf26bbb88454f495e95059` records the shipped editor-surface binding and preserves the Tiptap-extension distinction.

All exact-head CI, 100% production statement/branch/function/line coverage, security, packaging, review, and branch-protection evidence remains release-gated; no predecessor-head or local-only result is acceptance evidence.

## Standards analysis

WAI-ARIA 1.2 defines `aria-keyshortcuts` as a way to indicate keyboard shortcuts that an author has implemented. Its value is a space-separated list of shortcuts; each shortcut combines zero or more modifier keys and exactly one non-modifier key with plus signs. The normative modifier token is `Control`; `Meta` represents the Meta key and maps to Command on macOS. This supports expressing Windows/Linux and macOS alternatives without inventing the presentation-only `Ctrl/Cmd` abbreviation inside accessibility metadata.

The ARIA Authoring Practices Guide toolbar pattern recommends a single toolbar tab stop with directional movement among controls, with Home/End available as optional navigation. Inkspan already implements that composite interaction. Adding shortcut metadata is therefore complementary: it improves command discoverability without disturbing roving focus, native button activation, disabled-control behavior, or `aria-pressed` state.

Tiptap's official Undo/Redo documentation lists redo as `Shift+Control+Z` or `Control+Y` on Windows/Linux and `Shift+Cmd+Z` or `Cmd+Y` on macOS. Its Collaboration extension documents the same two redo alternatives for collaborative history. Because Inkspan uses the corresponding configured Tiptap history mechanisms rather than a custom redo keymap, `Control+Y Meta+Y` is shipped behavior that must be represented alongside `Control+Shift+Z Meta+Shift+Z` in descriptive accessibility metadata.

Tiptap's official Link extension documentation states that the extension provides no default keyboard shortcut and suggests that applications may choose to open custom link UI from their own `Mod-k` binding. Inkspan does exactly that at a different layer: `EditorFrame` implements the application-level `Ctrl/Cmd+K` handler. Therefore the absence of an extension default cannot be used as evidence that the finished Inkspan editor lacks the shortcut. `aria-keyshortcuts` follows observable shipped behavior across the repository, not only extension-local keymaps.

## Security, privacy, and ownership boundary

`aria-keyshortcuts` contains only static command metadata. It carries no document content, selection text, tenant identifier, credentials, provider information, persistence validator, local path, or user-specific shortcut history. The values are safe to expose in rendered markup and release evidence.

The link binding invokes the same SafeLink-governed command path as the toolbar and does not weaken URL validation. Inkspan does not use shortcut metadata as an authorization signal. A host that disables, shadows, intercepts, or adds a shortcut remains responsible for its own accessible interaction design. No host may infer document permission or durable operation authority from the presence of a toolbar button or its accessibility state.

## Compatibility and rollback

The property is optional within Inkspan's internal toolbar-button contract and serializes to an ordinary ARIA attribute on mapped built-in shortcut buttons. Browsers or assistive technologies that do not surface the state continue to receive the same native button labels, focus behavior, and command implementation as before. Redo retains the same TipTap command while exposing both existing key bindings. Link editing retains the pre-existing `EditorFrame` `Ctrl/Cmd+K` execution path and the same prompt-driven toolbar command while restoring truthful metadata.

Rollback is bounded: remove the mapped `keyShortcuts` assignments, the optional property and emitted `aria-keyshortcuts` state, the focused regression tests, and this doctoring entry. Removing the link metadata alone would reintroduce an accessibility discoverability mismatch unless the `EditorFrame` binding were also intentionally removed in a separately reviewed behavior change. No persisted document, schema, migration, host protocol, or package subpath requires conversion.

## Evidence boundary

Shareable evidence may include the static shortcut values, committed tests and documentation, exact commit identifiers, and CI/review status. Local assistive-technology recordings, user documents, host application keymaps, tenant policies, credentials, or private interaction telemetry are not required for this repository-level acceptance slice and must not be copied into public release evidence.

## APA 7 references

Tiptap. (n.d.). *Collaboration extension*. Tiptap Editor Docs. Retrieved August 8, 2026, from https://tiptap.dev/docs/editor/extensions/functionality/collaboration

Tiptap. (n.d.). *Link extension*. Tiptap Editor Docs. Retrieved August 8, 2026, from https://tiptap.dev/docs/editor/extensions/marks/link

Tiptap. (n.d.). *Undo/Redo extension*. Tiptap Editor Docs. Retrieved August 8, 2026, from https://tiptap.dev/docs/editor/extensions/functionality/undo-redo

World Wide Web Consortium. (2023, June 6). *Accessible Rich Internet Applications (WAI-ARIA) 1.2* (W3C Recommendation). https://www.w3.org/TR/wai-aria-1.2/

World Wide Web Consortium. (n.d.). *Toolbar pattern*. ARIA Authoring Practices Guide. Retrieved August 8, 2026, from https://www.w3.org/WAI/ARIA/apg/patterns/toolbar/
