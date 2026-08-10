import { waitFor } from '@testing-library/react';
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

function makeEditor(): Editor {
  const element = document.createElement('div');
  document.body.appendChild(element);
  const editor = new Editor({
    element,
    extensions: buildExtensions({ image: { maxDimension: 0 } }),
    content: '<p>before</p>',
  });
  openEditors.push({ editor, element });
  return editor;
}

function pngFile(): File {
  return new File([PNG_BYTES], 'chart.png', { type: 'image/png' });
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

describe('Base64Image file-ingress alternative-text intent', () => {
  it('requires explicit alternative text before a pasted image becomes document state', async () => {
    const editor = makeEditor();
    const prompt = vi
      .spyOn(window, 'prompt')
      .mockReturnValue('Quarterly revenue chart');
    const file = pngFile();
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

    await waitFor(() => {
      expect(prompt).toHaveBeenCalledWith(
        'Image alternative text. Leave empty only if this image is decorative.',
        '',
      );
      expect(editor.getHTML()).toContain('alt="Quarterly revenue chart"');
    });
  });

  it('leaves the document unchanged when dropped-image alternative-text intent is canceled', async () => {
    const editor = makeEditor();
    const before = editor.getHTML();
    const prompt = vi.spyOn(window, 'prompt').mockReturnValue(null);
    vi.spyOn(editor.view, 'posAtCoords').mockReturnValue({ pos: 1, inside: -1 });
    const preventDefault = vi.fn();

    expect(
      drop(editor, {
        dataTransfer: { files: [pngFile()] },
        clientX: 4,
        clientY: 6,
        preventDefault,
      }),
    ).toBe(true);
    expect(preventDefault).toHaveBeenCalledOnce();

    await waitFor(() => expect(prompt).toHaveBeenCalledTimes(1));
    expect(editor.getHTML()).toBe(before);
    expect(editor.getHTML()).not.toContain('data:image/png;base64');
  });
});
