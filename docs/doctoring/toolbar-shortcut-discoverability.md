# Doctoring record: toolbar shortcut discoverability

## Decision

Inkspan exposes every keyboard shortcut already advertised by the built-in formatting toolbar through the WAI-ARIA `aria-keyshortcuts` state on the corresponding native button. The public contract remains descriptive rather than behavioral: the attribute makes existing editor commands programmatically discoverable but does not create, intercept, authorize, or remap keyboard input.

The exact shortcut alternatives are:

- bold: `Control+B Meta+B`;
- italic: `Control+I Meta+I`;
- insert/edit link: `Control+K Meta+K`;
- undo: `Control+Z Meta+Z`; and
- redo: `Control+Shift+Z Meta+Shift+Z`.

Controls for which Inkspan does not advertise a stable keyboard shortcut do not emit `aria-keyshortcuts`.

## Buyer-visible gap and bounded scope

Before this slice, toolbar titles visibly advertised `Ctrl/Cmd+B`, `Ctrl/Cmd+I`, `Ctrl/Cmd+K`, `Ctrl/Cmd+Z`, and `Ctrl/Cmd+Shift+Z`, while assistive technology received no programmatic shortcut metadata. That asymmetry weakened accessible command discovery in enterprise authoring workflows even though the underlying TipTap/ProseMirror commands already existed.

This repair changes only the editor-owned presentation and accessibility surface. It does not alter document semantics, shortcut execution, transport, authorization, tenant isolation, persistence, credentials, migration, retention, audit policy, model-use policy, collaboration ownership, or release authority. Hosts still own application-level shortcut conflict management and must preserve an equivalent accessible action when surrounding software intercepts a combination.

## Test-first evidence

The slice was implemented test-first from protected `main` `ca49a3249403be88ba3cb7c9589b3652f820e17c`.

1. RED commit `303149b4d3e586ba32c1306d1a7d98542142d9d3` added `src/toolbarShortcutAccessibility.test.tsx`. The test required the exact WAI-ARIA shortcut strings on the five advertised controls and required an unadvertised control to omit the state. The inherited production toolbar did not emit `aria-keyshortcuts`, so the contract was intentionally unsatisfied.
2. GREEN production commit `29d8c156e40eb0975687ee83053bedf3de7d77a5` added the optional, documented `keyShortcuts` button property, emitted it through `aria-keyshortcuts`, and bound only the five already-implemented shortcuts. The implementation adds no keyboard event handler or shortcut authority.
3. Documentation contract commit `513dcdc26a5cbaef333cf822a2e191f43a3eda70` added deterministic assertions for the public accessibility contract, standards evidence, doctoring lineage, and changelog traceability before the corresponding documentation was written.

All exact-head CI, 100% production statement/branch/function/line coverage, security, packaging, review, and branch-protection evidence remains release-gated; no predecessor-head or local-only result is acceptance evidence.

## Standards analysis

WAI-ARIA 1.2 defines `aria-keyshortcuts` as a way to indicate keyboard shortcuts that an author has implemented. Its value is a space-separated list of shortcuts; each shortcut combines zero or more modifier keys and exactly one non-modifier key with plus signs. The normative modifier token is `Control`; `Meta` represents the Meta key and maps to Command on macOS. This supports expressing Windows/Linux and macOS alternatives without inventing the presentation-only `Ctrl/Cmd` abbreviation inside accessibility metadata.

The ARIA Authoring Practices Guide toolbar pattern recommends a single toolbar tab stop with directional movement among controls, with Home/End available as optional navigation. Inkspan already implements that composite interaction. Adding shortcut metadata is therefore complementary: it improves command discoverability without disturbing roving focus, native button activation, disabled-control behavior, or `aria-pressed` state.

## Security, privacy, and ownership boundary

`aria-keyshortcuts` contains only static command metadata. It carries no document content, selection text, tenant identifier, credentials, provider information, persistence validator, local path, or user-specific shortcut history. The values are safe to expose in rendered markup and release evidence.

Inkspan does not use shortcut metadata as an authorization signal. A host that disables, shadows, or intercepts a shortcut remains responsible for its own accessible interaction design. No host may infer document permission or durable operation authority from the presence of a toolbar button or its accessibility state.

## Compatibility and rollback

The property is optional within Inkspan's internal toolbar-button contract and serializes to an ordinary ARIA attribute only on the five mapped buttons. Browsers or assistive technologies that do not surface the state continue to receive the same native button labels, title text, focus behavior, and command implementation as before.

Rollback is bounded: remove the five `keyShortcuts` assignments, the optional property and emitted `aria-keyshortcuts` state, the focused regression tests, and this doctoring entry. No persisted document, schema, migration, host protocol, or package subpath requires conversion.

## Evidence boundary

Shareable evidence may include the static shortcut values, committed tests and documentation, exact commit identifiers, and CI/review status. Local assistive-technology recordings, user documents, host application keymaps, tenant policies, credentials, or private interaction telemetry are not required for this repository-level acceptance slice and must not be copied into public release evidence.

## APA 7 references

World Wide Web Consortium. (2023, June 6). *Accessible Rich Internet Applications (WAI-ARIA) 1.2* (W3C Recommendation). https://www.w3.org/TR/wai-aria-1.2/

World Wide Web Consortium. (n.d.). *Toolbar pattern*. ARIA Authoring Practices Guide. Retrieved August 8, 2026, from https://www.w3.org/WAI/ARIA/apg/patterns/toolbar/
