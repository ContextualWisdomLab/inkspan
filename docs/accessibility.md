# Accessibility contract

Inkspan treats keyboard and assistive-technology behavior as part of its public product contract, not as demo-only polish.

## Editable surface

- The editable ProseMirror region is exposed as a multiline textbox.
- Hosts can override the default accessible name through `ariaLabel`.
- Read-only mode removes editing actions while preserving document readability.
- Informative images support authored alternative text; decorative images are serialized with an explicit empty `alt` value.

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

- providing a context-specific `ariaLabel` when more than one editor appears on a page;
- preserving sufficient contrast when overriding Inkspan CSS variables;
- announcing validation, persistence, and network failures in an appropriate live region;
- ensuring surrounding dialogs, forms, and application shortcuts do not trap or steal focus;
- testing the integrated workflow with representative browsers, screen readers, zoom levels, and input methods.

## Verification

The TypeScript test suite verifies the single-tab-stop invariant, remembered focus, disabled-control fallback, wrapping arrow navigation, Home/End behavior, toggle semantics, and toolbar orientation under the repository-wide 100% statement/branch/function/line coverage gate.
