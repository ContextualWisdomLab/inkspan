import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { Editor } from '@tiptap/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { buildExtensions } from '../extensions/kit.js';
import { Toolbar } from './Toolbar.js';

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

function delayedPngFile(delayMs = 25): File {
  const file = new File([PNG_BYTES], 'slow.png', { type: 'image/png' });
  Object.defineProperty(file, 'arrayBuffer', {
    configurable: true,
    value: () =>
      new Promise<ArrayBuffer>((resolve) => {
        setTimeout(() => resolve(PNG_BYTES.slice().buffer), delayMs);
      }),
  });
  return file;
}

function fileInput(): HTMLInputElement {
  return document.querySelector('input[type="file"]') as HTMLInputElement;
}

async function settleConversion(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 45));
  });
}

afterEach(() => {
  cleanup();
  for (const { editor, element } of openEditors.splice(0)) {
    if (!editor.isDestroyed) editor.destroy();
    element.remove();
  }
  vi.restoreAllMocks();
});

describe('Toolbar asynchronous image-upload lifecycle boundary', () => {
  it('does not prompt or mutate after the editor becomes read-only', async () => {
    const editor = makeEditor();
    const before = editor.getHTML();
    const prompt = vi.spyOn(window, 'prompt').mockReturnValue('stale image');
    render(<Toolbar editor={editor} image={{ maxDimension: 0 }} />);

    fireEvent.change(fileInput(), { target: { files: [delayedPngFile()] } });
    editor.setEditable(false);
    await settleConversion();

    expect(prompt).not.toHaveBeenCalled();
    expect(editor.getHTML()).toBe(before);
    expect(editor.getHTML()).not.toContain('data:image/png;base64');
  });

  it('does not prompt after the editor is destroyed during conversion', async () => {
    const editor = makeEditor();
    const prompt = vi.spyOn(window, 'prompt').mockReturnValue('stale image');
    render(<Toolbar editor={editor} image={{ maxDimension: 0 }} />);

    fireEvent.change(fileInput(), { target: { files: [delayedPngFile()] } });
    editor.destroy();
    await settleConversion();

    expect(prompt).not.toHaveBeenCalled();
    expect(editor.isDestroyed).toBe(true);
  });

  it('does not expose hostile conversion throw values to the host error callback', async () => {
    const editor = makeEditor();
    const before = editor.getHTML();
    const privateSentinel = new Error('private toolbar conversion sentinel');
    const getPrototypeOf = vi.fn(() => {
      throw privateSentinel;
    });
    const hostileThrownValue = new Proxy({}, { getPrototypeOf });
    const hostileValues = new WeakSet<object>([hostileThrownValue]);
    const file = new File([PNG_BYTES], 'hostile.png', { type: 'image/png' });
    Object.defineProperty(file, 'arrayBuffer', {
      configurable: true,
      value: vi.fn().mockRejectedValue(hostileThrownValue),
    });

    let leakedHostileValue = false;
    let observedError: unknown;
    const onImageError = vi.fn((error: unknown) => {
      observedError = error;
      if (
        typeof error === 'object' &&
        error !== null &&
        hostileValues.has(error)
      ) {
        leakedHostileValue = true;
      }
    });
    const prompt = vi.spyOn(window, 'prompt').mockReturnValue('should not run');
    render(
      <Toolbar
        editor={editor}
        image={{ maxSizeBytes: 1024 * 1024, maxDimension: 0 }}
        onImageError={onImageError}
      />,
    );

    fireEvent.change(fileInput(), { target: { files: [file] } });
    await settleConversion();

    expect(onImageError).toHaveBeenCalledOnce();
    expect(leakedHostileValue).toBe(false);
    expect(getPrototypeOf).not.toHaveBeenCalled();
    expect(observedError).toBeInstanceOf(Error);
    expect((observedError as Error).message).toBe('Image processing failed.');
    expect(prompt).not.toHaveBeenCalled();
    expect(editor.getHTML()).toBe(before);
    expect(editor.getHTML()).not.toContain('data:image');
  });
});
