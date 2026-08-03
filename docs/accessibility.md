# Accessibility contract

Inkspan treats keyboard and assistive-technology behavior as part of its public product contract, not as demo-only polish.

## Editable surface

- The editable ProseMirror region is exposed as a multiline textbox.
- Hosts can provide a string accessible name through `ariaLabel` or reference visible labels through `ariaLabelledBy`. A non-empty `ariaLabelledBy` takes precedence so the visible host label remains the source of truth.
- `ariaDescribedBy` associates instructions, constraints, or contextual help with the editor.
- `ariaErrorMessage`, `ariaInvalid`, and `ariaRequired` expose host-owned validation state without coupling Inkspan to a particular form library.
- Read-only mode removes editing actions while preserving document readability and sets `aria-readonly="true"`; switching `editable` or any accessibility prop after mount updates the existing editor DOM without recreating document state.
- Informative images support authored alternative text; decorative images are serialized with an explicit empty `alt` value.

### Form integration example

```tsx
<h2 id="message-body-label">Message body</h2>
<p id="message-body-help">Include the decision and supporting evidence.</p>
<p id="message-body-error">A message body is required.</p>

<CwlEditor
  ariaLabelledBy="message-body-label"
  ariaDescribedBy="message-body-help"
  ariaErrorMessage="message-body-error"
  ariaInvalid={hasBodyError}
  ariaRequired
  editable={!isArchived}
/>
```

`ariaLabelledBy` and `ariaDescribedBy` accept space-separated ID references. Blank references are omitted rather than emitted as broken relationships. `ariaInvalid` accepts the WAI-ARIA textbox values `true`, `false`, `grammar`, and `spelling`. The same props are inherited by `CollaborativeCwlEditor`; presence and connection announcements remain a separate polite status region.

Inkspan does not render validation copy because business rules, localization, submit timing, and error recovery belong to the host. Hosts should set `aria-invalid="true"` only after detecting an actual input error and should keep the referenced error text visible and actionable.

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

- providing a visible, context-specific label through `ariaLabelledBy` when practical, or a concise `ariaLabel` when no visible label exists;
- keeping every `ariaLabelledBy`, `ariaDescribedBy`, and `ariaErrorMessage` target present with a descriptive nonnumeric DOM identifier;
- identifying errors in text, supplying known correction guidance, and synchronizing `ariaInvalid` with the visible validation state;
- preserving sufficient contrast when overriding Inkspan CSS variables;
- announcing persistence and network failures in an appropriate live region;
- ensuring surrounding dialogs, forms, and application shortcuts do not trap or steal focus;
- testing the integrated workflow with representative browsers, screen readers, zoom levels, and input methods.

## Standards basis

- [WAI-ARIA 1.2 textbox role](https://www.w3.org/TR/wai-aria/#textbox) — accessible name, multiline, readonly, required, invalid, description, and error-message states.
- [WAI-ARIA APG: Accessible names and descriptions](https://www.w3.org/WAI/ARIA/apg/practices/names-and-descriptions/) — visible-label preference and `aria-labelledby`/`aria-describedby` relationships.
- [WCAG 2.2, Guideline 3.3 Input Assistance](https://www.w3.org/TR/WCAG22/#input-assistance) — labels or instructions, textual error identification, and correction suggestions.
- [ARIA in HTML](https://www.w3.org/TR/html-aria/) — valid readonly semantics for custom contenteditable textboxes.

## Verification

The TypeScript test suite verifies the single-tab-stop invariant, remembered focus, disabled-control fallback, wrapping arrow navigation, Home/End behavior, toggle semantics, toolbar orientation, accessible-name precedence, blank ID-reference omission, validation states, read-only semantics, and live prop updates for standalone and collaborative surfaces under the repository-wide 100% statement/branch/function/line coverage gate.
