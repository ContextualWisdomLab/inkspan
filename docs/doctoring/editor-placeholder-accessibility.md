# Editor placeholder accessibility

Status: Implemented on active PR

## Purpose

Inkspan's visual empty-editor hint is rendered by the TipTap Placeholder extension. The active accessibility change mirrors that same host-supplied placeholder into the ProseMirror textbox's `aria-placeholder` attribute so assistive-technology users can receive equivalent entry guidance without requiring every embedding host to duplicate the text in a separate description element.

The placeholder remains **supplemental guidance**, not the editor's accessible name. Inkspan's existing accessible-name precedence remains unchanged: `aria-labelledby` whenever a host supplies a non-blank label reference, otherwise an explicit `aria-label`, otherwise the product fallback label.

## WAI-ARIA authority

WAI-ARIA 1.2 defines `aria-placeholder` as a short hint intended to aid data entry when a control has no value and allows it on the `textbox` role. The Recommendation also states that placeholder text must not be used instead of a label because users still need to understand the input's purpose once a value is present.

Inkspan therefore exposes the placeholder only after trimming surrounding whitespace and omits the attribute when the configured visual placeholder is blank or whitespace-only. It never promotes the placeholder to `aria-label` and never removes the existing textbox name.

## Lifecycle and ownership

Standalone and provider-neutral collaborative surfaces use the same `buildEditorAccessibilityAttributes()` contract. A changed React `placeholder` prop updates the semantic textbox attribute and the visual TipTap placeholder from one normalized value without replacing the current TipTap editor or Yjs document binding. The change introduces no live region, network call, model call, persistence field, telemetry event, tenant identifier, authorization state, or collaboration-provider behavior.

`aria-placeholder` does not assert that the document is editable. `aria-readonly` and the TipTap editable state remain the authority for editability. A read-only empty surface can still expose its configured placeholder guidance, but that guidance grants no editing capability.

## Verification

The active test line includes:

- a focused historical RED proving the accessibility builder had no placeholder input or attribute contract;
- normalized non-empty placeholder plus `aria-labelledby` name precedence;
- standalone DOM verification and live placeholder-prop update without editor recreation;
- collaborative DOM verification and live placeholder-prop update without editor or Yjs-fragment replacement;
- blank/whitespace-only placeholder omission;
- package-distribution verification through `pnpm build && pnpm verify:package`, whose npm-pack inventory check binds `dist/cwl-editor.js` to the publishable package and whose `node ./tests/package/verify-editor-placeholder-package.mjs` smoke verifies the public `CwlEditor.placeholder` visual and `aria-placeholder` semantics from that built entry; and
- repository-wide exact production coverage, package, CI, security, and SAST gates before protected integration.

## References — APA 7th

World Wide Web Consortium. (2023, June 6). *Accessible Rich Internet Applications (WAI-ARIA) 1.2* (W3C Recommendation). https://www.w3.org/TR/wai-aria-1.2/

W3C Web Accessibility Initiative. (n.d.). *Providing accessible names and descriptions*. ARIA Authoring Practices Guide. Retrieved August 10, 2026, from https://www.w3.org/WAI/ARIA/apg/practices/names-and-descriptions/
