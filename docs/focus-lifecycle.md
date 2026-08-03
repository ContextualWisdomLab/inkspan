# Editor focus lifecycle

Inkspan exposes host-owned focus lifecycle callbacks on both `CwlEditor` and
`CollaborativeCwlEditor`:

```tsx
<CwlEditor
  ariaLabelledBy="decision-body-label"
  onFocus={({ editor, event }) => {
    analytics.record('decision_body_focused');
    console.debug(event.type, editor.isFocused);
  }}
  onBlur={({ editor }) => {
    form.markTouched('decision_body');
    persistence.schedule(editor.getHTML());
  }}
/>
```

`onFocus` fires when the editable ProseMirror region receives focus. `onBlur`
fires when that region loses focus. Each callback receives one
`CwlEditorFocusEvent` containing the stable TipTap `editor` instance and the
native DOM `FocusEvent` emitted by the editable region.

Callback props are live. A host can replace or add either callback after mount
without recreating the editor, losing the document selection, or rebuilding a
collaborative Yjs binding. The standalone and collaborative components share the
same contract.

## Host responsibilities

- Treat `onBlur` as a lifecycle signal, not proof that document content changed.
  Use `onChange` for content persistence and diffing.
- Debounce remote persistence and analytics in the host. Inkspan does not own a
  network transport, retry queue, or application telemetry boundary.
- Do not place sensitive document content, inline base64 image payloads, or
  collaboration credentials in focus telemetry.
- Keep validation behavior synchronized with visible messages and the
  `ariaInvalid`, `ariaErrorMessage`, and `ariaDescribedBy` props.
- Preserve visible focus indicators and do not move focus automatically in a way
  that surprises keyboard or assistive-technology users.

## CWL and naruon interoperability

CWL services and naruon integrations can use `onBlur` to mark compose fields as
touched or to flush an already-debounced draft queue. The callback is
provider-neutral and does not expose or mutate Yjs transport state. Stable,
descriptive nonnumeric field identifiers should remain host-owned; Inkspan does
not infer database keys or service identifiers from DOM focus events.

## Standards and primary references

- TipTap editor events and focus/blur commands:
  https://tiptap.dev/docs/editor/api/events and
  https://tiptap.dev/docs/editor/api/commands/selection
- React focus event semantics:
  https://react.dev/reference/react-dom/components/common#focus-event-handler
- WCAG 2.2 focus visibility and non-obscuration requirements:
  https://www.w3.org/TR/WCAG22/#focus-visible and
  https://www.w3.org/TR/WCAG22/#focus-not-obscured-minimum

## Verification

The repository test suite exercises absent callbacks, callbacks added after
mount, native event types, stable editor identity, and parity between standalone
and collaborative surfaces under the repository-wide 100% statement, branch,
function, and line coverage gate.
