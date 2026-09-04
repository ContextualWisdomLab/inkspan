import { waitFor } from '@testing-library/react';
import { Editor } from '@tiptap/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildExtensions } from './kit.js';
import { base64ImagePluginKey } from './Base64Image.js';

const openEditors: Editor[] = [];

function createEditor(): Editor {
  const editor = new Editor({
    extensions: buildExtensions({ image: { maxDimension: 0 } }),
    content: '<p>Before</p>',
  });
  openEditors.push(editor);
  return editor;
}

function imageFile(): File {
  return new File([new Uint8Array([1, 2, 3])], 'figure.png', {
    type: 'image/png',
  });
}

afterEach(() => {
  for (const editor of openEditors.splice(0)) {
    if (!editor.isDestroyed) editor.destroy();
  }
  vi.restoreAllMocks();
});

describe('Base64Image explicit decorative insertion intent', () => {
  it('adds explicit empty alt text to pasted images only after decorative intent', async () => {
    const editor = createEditor();
    const prompt = vi.spyOn(window, 'prompt').mockReturnValue('');
    const plugin = base64ImagePluginKey.get(editor.state)!;
    const preventDefault = vi.fn();
    const handled = (
      plugin.props.handlePaste as (view: unknown, event: unknown) => boolean
    )(editor.view, {
      clipboardData: {
        items: [{ kind: 'file', getAsFile: () => imageFile() }],
      },
      preventDefault,
    });

    expect(handled).toBe(true);
    expect(preventDefault).toHaveBeenCalledOnce();
    await waitFor(() => {
      expect(prompt).toHaveBeenCalledOnce();
      expect(editor.getHTML()).toContain('data:image/png;base64');
      expect(editor.getHTML()).toContain('alt=""');
    });
  });

  it('adds explicit empty alt text to dropped images only after decorative intent', async () => {
    const editor = createEditor();
    const prompt = vi.spyOn(window, 'prompt').mockReturnValue('');
    const plugin = base64ImagePluginKey.get(editor.state)!;
    vi.spyOn(editor.view, 'posAtCoords').mockReturnValue({ pos: 0, inside: -1 });
    const preventDefault = vi.fn();
    const handled = (
      plugin.props.handleDrop as (view: unknown, event: unknown) => boolean
    )(editor.view, {
      dataTransfer: { files: [imageFile()] },
      clientX: 0,
      clientY: 0,
      preventDefault,
    });

    expect(handled).toBe(true);
    expect(preventDefault).toHaveBeenCalledOnce();
    await waitFor(() => {
      expect(prompt).toHaveBeenCalledOnce();
      expect(editor.getHTML()).toContain('data:image/png;base64');
      expect(editor.getHTML()).toContain('alt=""');
    });
  });
});
