import { afterEach, describe, expect, it, vi } from 'vitest';
import { waitFor } from '@testing-library/react';
import { Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Base64Image, base64ImagePluginKey } from './Base64Image.js';

const PNG_BYTES = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49,
  0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06,
  0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89,
]);

const openEditors: Editor[] = [];

afterEach(() => {
  for (const editor of openEditors.splice(0)) {
    if (!editor.isDestroyed) editor.destroy();
  }
  vi.restoreAllMocks();
});

function makeEditor(onError: (error: Error) => void): Editor {
  const element = document.createElement('div');
  document.body.appendChild(element);
  const editor = new Editor({
    element,
    content: '<p>hello</p>',
    extensions: [
      StarterKit,
      Base64Image.configure({
        maxSizeBytes: 1024 * 1024,
        maxDimension: 0,
        quality: 0.85,
        onError,
      }),
    ],
  });
  openEditors.push(editor);
  return editor;
}

function paste(editor: Editor, event: unknown): boolean {
  const plugin = base64ImagePluginKey.get(editor.state)!;
  return (plugin.props.handlePaste as (view: unknown, event: unknown) => boolean)(
    editor.view,
    event,
  );
}

describe('Base64Image hostile conversion failure containment', () => {
  it('does not inspect a hostile thrown value before reporting a redacted error', async () => {
    const privateSentinel = new Error('private image conversion sentinel');
    const getPrototypeOf = vi.fn(() => {
      throw privateSentinel;
    });
    const hostileThrownValue = new Proxy({}, { getPrototypeOf });
    const file = new File([PNG_BYTES], 'hostile.png', { type: 'image/png' });
    Object.defineProperty(file, 'arrayBuffer', {
      configurable: true,
      value: vi.fn().mockRejectedValue(hostileThrownValue),
    });

    const onError = vi.fn<(error: Error) => void>();
    const editor = makeEditor(onError);
    const preventDefault = vi.fn();

    expect(
      paste(editor, {
        clipboardData: {
          items: [{ kind: 'file', getAsFile: () => file }],
        },
        preventDefault,
      }),
    ).toBe(true);
    expect(preventDefault).toHaveBeenCalledOnce();

    await waitFor(() => expect(onError).toHaveBeenCalledOnce());
    expect(getPrototypeOf).not.toHaveBeenCalled();
    expect(onError.mock.calls[0][0]).toBeInstanceOf(Error);
    expect(onError.mock.calls[0][0].message).toBe('Image processing failed.');
    expect(editor.getHTML()).not.toContain('data:image');
  });
});
