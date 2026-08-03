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
<h2 id="message-body-label">Message body</h2>
<p id="message-body-help">Include the decision and supporting evidence.</p>
<p id="message-body-error">A message body is required.</p>

<CwlEditor
  languageTag="ko-KR"
  textDirection="ltr"
  ariaLabelledBy="message-body-label"
  ariaDescribedBy="message-body-help"
  ariaErrorMessage="message-body-error"
  ariaInvalid={hasBodyError}
  ariaRequired
  editable={!isArchived}
/>
```

For Arabic, Persian, Hebrew, or another right-to-left document, use the corresponding BCP 47 language tag and `textDirection="rtl"`. Use `textDirection="auto"` only when the host intentionally delegates base-direction detection to the browser; the HTML algorithm uses the first strongly directional character and is not a substitute for document-level language knowledge.

`ariaLabelledBy` and `ariaDescribedBy` accept space-separated ID references. Blank references are omitted rather than emitted as broken relationships. `ariaInvalid` accepts the WAI-ARIA textbox values `true`, `false`, `grammar`, and `spelling`. The same language, direction, and ARIA props are inherited by `CollaborativeCwlEditor`; presence and connection announcements remain a separate polite status region.

Inkspan does not infer a document language, translate validation copy, or choose writing direction from user identity because those decisions belong to the host's document metadata and locale policy. Inkspan also does not render validation copy because business rules, localization, submit timing, and error recovery belong to the host. Hosts should set `aria-invalid="true"` only after detecting an actual input error and should keep the referenced error text visible and actionable.

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

## Host responsibilities

Inkspan cannot determine the complete accessibility of an embedding application. Hosts remain responsible for:

- supplying a valid BCP 47 `languageTag` that reflects the authored document, not merely the surrounding application shell;
- choosing `textDirection` from document metadata and updating it when the document's base direction changes;
- marking passages in a different language inside serialized HTML when WCAG language-of-parts conformance is required, because a single editor-level language cannot describe mixed-language spans;
- providing a visible, context-specific label through `ariaLabelledBy` when practical, or a concise `ariaLabel` when no visible label exists;
- keeping every `ariaLabelledBy`, `ariaDescribedBy`, and `ariaErrorMessage` target present with a descriptive nonnumeric DOM identifier;
- identifying errors in text, supplying known correction guidance, and synchronizing `ariaInvalid` with the visible validation state;
- preserving sufficient contrast when overriding Inkspan CSS variables;
- announcing persistence and network failures in an appropriate live region;
- ensuring surrounding dialogs, forms, and application shortcuts do not trap or steal focus;
- testing the integrated workflow with representative browsers, screen readers, zoom levels, scripts, writing directions, and input methods.

## Standards basis

- [WCAG 2.2, Success Criteria 3.1.1 and 3.1.2](https://www.w3.org/TR/WCAG22/#readable) — programmatic language identification for the page and language changes within content.
- [HTML Living Standard: global `lang` and `dir` attributes](https://html.spec.whatwg.org/multipage/dom.html#global-attributes) — language metadata and the enumerated `ltr`, `rtl`, and `auto` direction states.
- [WAI-ARIA 1.2 textbox role](https://www.w3.org/TR/wai-aria/#textbox) — accessible name, multiline, readonly, required, invalid, description, and error-message states.
- [WAI-ARIA APG: Accessible names and descriptions](https://www.w3.org/WAI/ARIA/apg/practices/names-and-descriptions/) — visible-label preference and `aria-labelledby`/`aria-describedby` relationships.
- [WCAG 2.2, Guideline 3.3 Input Assistance](https://www.w3.org/TR/WCAG22/#input-assistance) — labels or instructions, textual error identification, and correction suggestions.
- [ARIA in HTML](https://www.w3.org/TR/html-aria/) — valid readonly semantics for custom contenteditable textboxes.

## Verification

The TypeScript test suite verifies the single-tab-stop invariant, remembered focus, disabled-control fallback, wrapping arrow navigation, Home/End behavior, toggle semantics, toolbar orientation, accessible-name precedence, blank language and ID-reference omission, `lang`/`dir` propagation, validation states, read-only semantics, and live prop updates for standalone and collaborative surfaces under the repository-wide 100% statement/branch/function/line coverage gate.
