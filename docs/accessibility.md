# Accessibility contract

Inkspan treats keyboard and assistive-technology behavior as part of its public product contract, not as demo-only polish.

## Editable surface

- The editable ProseMirror region is exposed as a multiline textbox.
- Hosts can provide a string accessible name through `ariaLabel` or reference visible labels through `ariaLabelledBy`. A non-empty `ariaLabelledBy` takes precedence so the visible host label remains the source of truth.
- `languageTag` places a trimmed BCP 47 `lang` value on the editable document surface so browsers, spellcheckers, and assistive technologies can apply the correct language rules. Blank values are omitted rather than declaring an unknown language.
- `textDirection` maps to the HTML `dir` states `ltr`, `rtl`, or `auto` and establishes the base writing direction for authored content.
- `ariaDescribedBy` associates instructions, constraints, or contextual help with the editor.
- `ariaErrorMessage`, `ariaInvalid`, and `ariaRequired` expose host-owned validation state without coupling Inkspan to a particular form library.
- Read-only mode removes editing actions while preserving document readability and sets `aria-readonly="true"`; switching `editable`, language, direction, or any accessibility prop after mount updates the existing editor DOM without recreating document state.
- Informative images support authored alternative text; decorative images are serialized with an explicit empty `alt` value.

### Form integration example

```tsx
<form method="post" action="/messages">
  <h2 id="message-body-label">Message body</h2>
  <p id="message-body-help">Include the decision and supporting evidence.</p>
  <p id="message-body-error">A message body is required.</p>

  <CwlEditor
    mode="markdown"
    formFieldName="message_body"
    formResetValue="# New message"
    onFormReset={() => clearHostValidation()}
    languageTag="ko-KR"
    textDirection="ltr"
    ariaLabelledBy="message-body-label"
    ariaDescribedBy="message-body-help"
    ariaErrorMessage="message-body-error"
    ariaInvalid={hasBodyError}
    ariaRequired
    editable={!isArchived}
  />

  <button type="submit">Send</button>
  <button type="reset">Reset</button>
</form>
```

When `formFieldName` is supplied, Inkspan renders a native hidden input whose live value is the current document serialized in `mode`. The field participates in `FormData`, ordinary browser submission, and form-library workflows that read native controls. `formId` associates the field with a form elsewhere in the document, and `formFieldDisabled` excludes it from submission using the native disabled-control rule. The same serialization props are inherited by `CollaborativeCwlEditor`; its field follows Yjs-backed document changes rather than a static `value` prop.

Inkspan writes the hidden input's native `value` synchronously inside each document-changing TipTap transaction. A host may therefore call an imperative editor method and immediately construct `FormData`, invoke a native submit path, or let the browser construct the form entry list in the same task without waiting for a React rerender. Selection-only transactions do not serialize or rewrite the field. This guarantee concerns the current client-side form value only; it does not replace host validation, authorization, persistence, or request-size enforcement.

The hidden field is a submission bridge, not a second editable control. It is absent from the accessibility tree and does not duplicate the textbox name, description, or validation state. Hidden inputs are barred from native constraint validation, so `ariaRequired`, `ariaInvalid`, visible error copy, business validation, and focus recovery remain host responsibilities.

Native form reset is opt-in for standalone editor state. When `formResetValue` is supplied to `CwlEditor`, Inkspan interprets it in the active `mode` and applies it only after the associated form's cancelable `reset` event completes without `preventDefault()`. `onFormReset` then receives the stable TipTap editor and native reset event after the configured reset document has been applied. With only `onFormReset`, Inkspan reports the allowed reset without mutating the document, allowing controlled hosts to update `value` or invoke their own domain-specific reset workflow. Controlled hosts that use `formResetValue` must continue accepting the resulting `onChange` value as their source of truth.

Reset integration does not require a submission field name. When either supported reset prop is configured without `formFieldName`, Inkspan renders an unnamed hidden form owner so it can observe the enclosing form or the form selected by `formId`; because the control has no name, it contributes no entry to `FormData` or ordinary submission.

A canceled reset leaves document state untouched and does not call `onFormReset`. `CollaborativeCwlEditor` intentionally excludes and rejects `formResetValue`: a local browser form action cannot silently replace shared Yjs state. Collaborative hosts may use `onFormReset` to observe an allowed reset, confirm authorization and user intent, and then perform an explicit shared-document transaction through their own collaboration, transport, and persistence policy. Omitting reset props preserves entirely host-owned reset semantics.

For Arabic, Persian, Hebrew, or another right-to-left document, use the corresponding BCP 47 language tag and `textDirection="rtl"`. Use `textDirection="auto"` only when the host intentionally delegates base-direction detection to the browser; the HTML algorithm uses the first strongly directional character and is not a substitute for document-level language knowledge.

`ariaLabelledBy` and `ariaDescribedBy` accept space-separated ID references. Blank references are omitted rather than emitted as broken relationships. `ariaInvalid` accepts the WAI-ARIA textbox values `true`, `false`, `grammar`, and `spelling`. The same language, direction, form-serialization, reset-observation, and ARIA props are inherited by `CollaborativeCwlEditor`; automatic reset values are standalone-only, and presence and connection announcements remain a separate polite status region.

Inkspan does not infer a document language, translate validation copy, or choose writing direction from user identity because those decisions belong to the host's document metadata and locale policy. Inkspan also does not render validation copy because business rules, localization, submit timing, and error recovery belong to the host. Hosts should set `aria-invalid="true"` only after detecting an actual input error and should keep the referenced error text visible and actionable.

Form values are ordinary client-controlled input. Hidden inputs are visible and mutable through developer tools, so servers must authorize the target document, validate the submitted serialization, reapply size limits, and never treat the field as a trust or secrecy boundary. Inline base64 images can make request bodies large; CWL and naruon gateways should align reverse-proxy, application, and persistence limits with the configured image policy before enabling native submission. Reset values are likewise client-side presentation state and must not grant authorization, erase protected server state, or bypass collaborative permissions.

## Formatting toolbar

The built-in formatting toolbar implements the horizontal composite-toolbar pattern from the [WAI-ARIA Authoring Practices toolbar specification](https://www.w3.org/WAI/ARIA/apg/patterns/toolbar/) and its [editor toolbar example](https://www.w3.org/WAI/ARIA/apg/patterns/toolbar/examples/toolbar/).

Keyboard behavior:

| Key | Behavior |
| --- | --- |
| `Tab` / `Shift+Tab` | Enter or leave the toolbar through one remembered tab stop |
| `Right Arrow` | Move to the next enabled control, wrapping at the end |
| `Left Arrow` | Move to the previous enabled control, wrapping at the beginning |
| `Home` | Move to the first enabled control |
| `End` | Move to the last enabled control |
| `Enter` / `Space` | Invoke the focused native button |

Disabled table, image, undo, and redo controls are skipped by directional navigation. When the remembered control becomes disabled after an editor transaction, the first enabled control becomes the toolbar tab stop.

Toggle controls expose `aria-pressed`; one-shot command buttons do not claim a pressed state. The toolbar declares horizontal orientation and ships visible `:focus-visible` styling, including a forced-colors fallback.

Shortcuts that the editor already implements are also exposed programmatically with `aria-keyshortcuts` so assistive technology can discover the same commands that appear in the button titles. Inkspan publishes `Control+B Meta+B` for bold, `Control+I Meta+I` for italic, `Control+Z Meta+Z` for undo, and `Control+Shift+Z Meta+Shift+Z Control+Y Meta+Y` for redo. The redo alternatives reflect Tiptap's configured history and collaboration behavior: both `Ctrl/Cmd+Shift+Z` and `Ctrl/Cmd+Y` invoke redo. `aria-keyshortcuts` describes shortcuts that Inkspan already implements; it does not create keyboard behavior, replace the visible button label, or authorize hosts to intercept those combinations. The explicit values remain `Control` and `Meta` rather than a presentation-only `Ctrl/Cmd` abbreviation because WAI-ARIA defines those modifier tokens and permits a space-separated list of alternatives.

The link control intentionally does not advertise a keyboard shortcut. Inkspan's configured Tiptap Link extension does not bind one, so the toolbar neither emits `aria-keyshortcuts` nor labels the link action as `Ctrl/Cmd+K`. A host that deliberately adds its own link shortcut remains responsible for implementing, documenting, conflict-testing, and exposing that host-owned binding accessibly.

## Host responsibilities

Inkspan cannot determine the complete accessibility of an embedding application. Hosts remain responsible for:

- supplying a valid BCP 47 `languageTag` that reflects the authored document, not merely the surrounding application shell;
- choosing `textDirection` from document metadata and updating it when the document's base direction changes;
- marking passages in a different language inside serialized HTML when WCAG language-of-parts conformance is required, because a single editor-level language cannot describe mixed-language spans;
- providing a visible, context-specific label through `ariaLabelledBy` when practical, or a concise `ariaLabel` when no visible label exists;
- keeping every `ariaLabelledBy`, `ariaDescribedBy`, and `ariaErrorMessage` target present with a descriptive nonnumeric DOM identifier;
- choosing a descriptive `formFieldName`, validating submitted content server-side, and aligning request-size limits when native form serialization is enabled;
- choosing whether standalone form reset should mutate the document and keeping controlled state synchronized;
- treating collaborative reset callbacks as requests for a separately authorized shared-document operation rather than passing an automatic reset value;
- identifying errors in text, supplying known correction guidance, and synchronizing `ariaInvalid` with the visible validation state;
- preserving sufficient contrast when overriding Inkspan CSS variables;
- announcing persistence and network failures in an appropriate live region;
- ensuring surrounding dialogs, forms, and application shortcuts do not trap or steal focus, suppress Inkspan's advertised shortcuts, or bind conflicting actions without an equivalent accessible command;
- testing the integrated workflow with representative browsers, screen readers, zoom levels, scripts, writing directions, input methods, and advertised keyboard shortcuts.

## Standards basis

- [WCAG 2.2, Success Criteria 3.1.1 and 3.1.2](https://www.w3.org/TR/WCAG22/#readable) — programmatic language identification for the page and language changes within content.
- [HTML Living Standard: global `lang` and `dir` attributes](https://html.spec.whatwg.org/multipage/dom.html#global-attributes) — language metadata and the enumerated `ltr`, `rtl`, and `auto` direction states.
- [HTML Living Standard: hidden input state](https://html.spec.whatwg.org/multipage/input.html#hidden-state-(type=hidden)) — hidden values, form submission participation, and exclusion from constraint validation.
- [HTML Living Standard: form control infrastructure](https://html.spec.whatwg.org/multipage/form-control-infrastructure.html) — control naming, external form association, current-value semantics, disabled controls, and form entry construction.
- [HTML Living Standard: resetting a form](https://html.spec.whatwg.org/multipage/form-control-infrastructure.html#resetting-a-form) — the bubbling, cancelable reset event and resettable-control algorithm.
- [React: queueing state updates](https://react.dev/learn/queueing-a-series-of-state-updates) — state setters request a later render and React batches updates until event handling completes.
- [WAI-ARIA 1.2 textbox role](https://www.w3.org/TR/wai-aria/#textbox) — accessible name, multiline, readonly, required, invalid, description, and error-message states.
- [WAI-ARIA 1.2 `aria-keyshortcuts`](https://www.w3.org/TR/wai-aria-1.2/#aria-keyshortcuts) — programmatic exposure of implemented shortcuts, exact modifier tokens, plus-separated key combinations, and space-separated alternatives.
- [Tiptap Undo/Redo extension](https://tiptap.dev/docs/editor/extensions/functionality/undo-redo) — the editor's history behavior includes both Shift+Control/Cmd+Z and Control/Cmd+Y redo alternatives.
- [Tiptap Collaboration extension](https://tiptap.dev/docs/editor/extensions/functionality/collaboration) — collaborative history provides the same two redo alternatives while host-owned collaboration remains separate from accessibility metadata.
- [Tiptap Link extension](https://tiptap.dev/docs/editor/extensions/marks/link) — the configured link extension provides commands and link behavior but no default keyboard shortcut.
- [WAI-ARIA APG: Accessible names and descriptions](https://www.w3.org/WAI/ARIA/apg/practices/names-and-descriptions/) — visible-label preference and `aria-labelledby`/`aria-describedby` relationships.
- [WCAG 2.2, Guideline 3.3 Input Assistance](https://www.w3.org/TR/WCAG22/#input-assistance) — labels or instructions, textual error identification, and correction suggestions.
- [ARIA in HTML](https://www.w3.org/TR/html-aria/) — valid readonly semantics for custom contenteditable textboxes.

## Verification

The TypeScript test suite verifies the single-tab-stop invariant, remembered focus, disabled-control fallback, wrapping arrow navigation, Home/End behavior, toggle semantics, toolbar orientation, exact `aria-keyshortcuts` exposure for implemented cross-platform formatting/history shortcuts including both documented redo alternatives, omission of shortcut metadata and shortcut labeling from the link control because the configured Link extension does not implement one, omission of shortcut metadata from other controls without a defined shortcut, accessible-name precedence, blank language and ID-reference omission, `lang`/`dir` propagation, validation states, read-only semantics, native form submission, same-task form-entry synchronization, disabled/external form behavior, live serialization-mode changes, imperative replacement, allowed and canceled standalone resets, reset-only form ownership, unrelated-form isolation, callback-only reset handling, queued-reset cleanup, collaborative automatic-reset rejection, collaborative callback-only observation without shared-state mutation, collaborative updates, and live prop updates for standalone and collaborative surfaces under the repository-wide 100% statement/branch/function/line coverage gate.
