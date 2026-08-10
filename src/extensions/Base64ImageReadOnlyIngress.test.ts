import { Editor } from '@tiptap/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { base64ImagePluginKey } from './Base64Image.js';
import { buildExtensions } from './kit.js';

const PNG_BYTES = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
  0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
  0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89,
]);

const openEditors: Array<{ editor: Editor; element: HTMLDivElement }> = [];

function makeReadOnlyEditor(): Editor {
  const element = document.createElement('div');
  document.body.appendChild(element);
  const editor = new Editor({
    element,
    editable: false,
    extensions: buildExtensions({ image: { maxDimension: 0 } }),
    content: '<p>protected</p>',
  });
  openEditors.push({ editor, element });
  return editor;
}

function pngFile(): File {
  return new File([PNG_BYTES], 'readonly.png', { type: 'image/png' });
}

function paste(editor: Editor, event: unknown): boolean {
  const plugin = base64ImagePluginKey.get(editor.state)!;
  return (plugin.props.handlePaste as (view: unknown, event: unknown) => boolean)(
    editor.view,
    event,
  );
}

function drop(editor: Editor, event: unknown): boolean {
  const plugin = base64ImagePluginKey.get(editor.state)!;
  return (plugin.props.handleDrop as (view: unknown, event: unknown) => boolean)(
    editor.view,
    event,
  );
}

afterEach(() => {
  for (const { editor, element } of openEditors.splice(0)) {
    if (!editor.isDestroyed) editor.destroy();
    element.remove();
  }
  vi.restoreAllMocks();
});

describe('Base64Image read-only file ingress', () => {
  it('does not claim or mutate pasted image input while the editor is read-only', async () => {
    const editor = makeReadOnlyEditor();
    const before = editor.getHTML();
    const prompt = vi.spyOn(window, 'prompt').mockReturnValue('must not run');
    const preventDefault = vi.fn();

    expect(
      paste(editor, {
        clipboardData: {
          items: [{ kind: 'file', getAsFile: () => pngFile() }],
        },
        preventDefault,
      }),
    ).toBe(false);
    expect(preventDefault).not.toHaveBeenCalled();

    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(prompt).not.toHaveBeenCalled();
    expect(editor.getHTML()).toBe(before);
  });

  it('does not claim or mutate dropped image input while the editor is read-only', async () => {
    const editor = makeReadOnlyEditor();
    const before = editor.getHTML();
    const prompt = vi.spyOn(window, 'prompt').mockReturnValue('must not run');
    const preventDefault = vi.fn();
    vi.spyOn(editor.view, 'posAtCoords').mockReturnValue({ pos: 1, inside: -1 });

    expect(
      drop(editor, {
        dataTransfer: { files: [pngFile()] },
        clientX: 1,
        clientY: 1,
        preventDefault,
      }),
    ).toBe(false);
    expect(preventDefault).not.toHaveBeenCalled();

    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(prompt).not.toHaveBeenCalled();
    expect(editor.getHTML()).toBe(before);
  });
});
