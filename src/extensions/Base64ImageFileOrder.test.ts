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
const JPEG_BYTES = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);

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

function controlledFile(
  bytes: Uint8Array,
  name: string,
  type: string,
  delayMs: number,
): File {
  const file = new File([bytes], name, { type });
  Object.defineProperty(file, 'arrayBuffer', {
    configurable: true,
    value: () =>
      new Promise<ArrayBuffer>((resolve) => {
        setTimeout(() => resolve(bytes.slice().buffer), delayMs);
      }),
  });
  return file;
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

describe('Base64Image multi-file ingress ordering', () => {
  it('preserves dropped file order and author intent when conversion resolves out of order', async () => {
    const editor = makeEditor();
    const prompt = vi
      .spyOn(window, 'prompt')
      .mockReturnValueOnce('First image')
      .mockReturnValueOnce('Second image');
    vi.spyOn(editor.view, 'posAtCoords').mockReturnValue({ pos: 1, inside: -1 });

    const first = controlledFile(PNG_BYTES, 'first.png', 'image/png', 25);
    const second = controlledFile(JPEG_BYTES, 'second.jpg', 'image/jpeg', 0);
    const preventDefault = vi.fn();

    expect(
      drop(editor, {
        dataTransfer: { files: [first, second] },
        clientX: 4,
        clientY: 6,
        preventDefault,
      }),
    ).toBe(true);
    expect(preventDefault).toHaveBeenCalledOnce();

    await waitFor(() => expect(prompt).toHaveBeenCalledTimes(2));
    await waitFor(() => {
      const html = editor.getHTML();
      const pngIndex = html.indexOf('data:image/png;base64');
      const jpegIndex = html.indexOf('data:image/jpeg;base64');
      const firstAltIndex = html.indexOf('alt="First image"');
      const secondAltIndex = html.indexOf('alt="Second image"');

      expect(pngIndex).toBeGreaterThanOrEqual(0);
      expect(jpegIndex).toBeGreaterThan(pngIndex);
      expect(firstAltIndex).toBeGreaterThanOrEqual(0);
      expect(secondAltIndex).toBeGreaterThan(firstAltIndex);
    });
  });
});
