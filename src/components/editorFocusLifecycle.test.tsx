import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as Y from 'yjs';
import { CollaborativeCwlEditor } from '../collaboration/CollaborativeCwlEditor.js';
import { CwlEditor } from './CwlEditor.js';

afterEach(cleanup);

function exerciseFocusLifecycle(editableRegion: HTMLElement): void {
  fireEvent.focus(editableRegion);
  fireEvent.blur(editableRegion);
}

describe('editor focus lifecycle callbacks', () => {
  it('uses live standalone callbacks and reports the native focus transition', async () => {
    const onFocus = vi.fn();
    const onBlur = vi.fn();
    const { rerender } = render(<CwlEditor hideToolbar />);
    const editableRegion = await screen.findByRole('textbox', {
      name: 'Rich text editor',
    });

    exerciseFocusLifecycle(editableRegion);
    expect(onFocus).not.toHaveBeenCalled();
    expect(onBlur).not.toHaveBeenCalled();

    rerender(
      <CwlEditor hideToolbar onFocus={onFocus} onBlur={onBlur} />,
    );
    exerciseFocusLifecycle(editableRegion);

    expect(onFocus).toHaveBeenCalledTimes(1);
    expect(onBlur).toHaveBeenCalledTimes(1);
    expect(onFocus.mock.calls[0]![0].editor).toBe(
      onBlur.mock.calls[0]![0].editor,
    );
    expect(onFocus.mock.calls[0]![0].event.type).toBe('focus');
    expect(onBlur.mock.calls[0]![0].event.type).toBe('blur');
  });

  it('provides the same live callback contract for collaborative editing', async () => {
    const collaborationDocument = new Y.Doc();
    const onFocus = vi.fn();
    const onBlur = vi.fn();
    const { rerender, unmount } = render(
      <CollaborativeCwlEditor
        document={collaborationDocument}
        hideToolbar
      />,
    );
    const editableRegion = await screen.findByRole('textbox', {
      name: 'Collaborative rich text editor',
    });

    exerciseFocusLifecycle(editableRegion);
    expect(onFocus).not.toHaveBeenCalled();
    expect(onBlur).not.toHaveBeenCalled();

    rerender(
      <CollaborativeCwlEditor
        document={collaborationDocument}
        hideToolbar
        onFocus={onFocus}
        onBlur={onBlur}
      />,
    );
    exerciseFocusLifecycle(editableRegion);

    expect(onFocus).toHaveBeenCalledTimes(1);
    expect(onBlur).toHaveBeenCalledTimes(1);
    expect(onFocus.mock.calls[0]![0].editor).toBe(
      onBlur.mock.calls[0]![0].editor,
    );
    expect(onFocus.mock.calls[0]![0].event.type).toBe('focus');
    expect(onBlur.mock.calls[0]![0].event.type).toBe('blur');

    unmount();
    collaborationDocument.destroy();
  });
});
