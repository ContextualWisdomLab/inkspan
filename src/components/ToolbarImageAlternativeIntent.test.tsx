import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { Editor } from '@tiptap/react';

import { buildExtensions } from '../extensions/kit.js';
import { Toolbar } from './Toolbar.js';

const PNG_BYTES = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49,
  0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06,
  0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89,
]);

const openEditors: Editor[] = [];

function makeEditor(): Editor {
  const element = document.createElement('div');
  document.body.appendChild(element);
  const editor = new Editor({
    element,
    extensions: buildExtensions({ image: { maxDimension: 0 } }),
    content: '<p>before</p>',
  });
  openEditors.push(editor);
  return editor;
}

function fileInput(): HTMLInputElement {
  return document.querySelector('input[type="file"]') as HTMLInputElement;
}

function choosePng(): void {
  const file = new File([PNG_BYTES], 'chart.png', { type: 'image/png' });
  fireEvent.change(fileInput(), { target: { files: [file] } });
}

afterEach(() => {
  cleanup();
  for (const editor of openEditors.splice(0)) {
    if (!editor.isDestroyed) editor.destroy();
  }
  vi.restoreAllMocks();
});

describe('Toolbar image alternative-text intent', () => {
  it('requires an explicit author decision and stores informative alternative text', async () => {
    const editor = makeEditor();
    const prompt = vi
      .spyOn(window, 'prompt')
      .mockReturnValue('Quarterly revenue chart');
    render(<Toolbar editor={editor} image={{ maxDimension: 0 }} />);

    choosePng();

    await waitFor(() => {
      expect(prompt).toHaveBeenCalledWith(
        'Image alternative text. Leave empty only if this image is decorative.',
        '',
      );
      expect(editor.getHTML()).toContain('alt="Quarterly revenue chart"');
    });
  });

  it('stores an explicitly empty response as decorative image intent', async () => {
    const editor = makeEditor();
    const prompt = vi.spyOn(window, 'prompt').mockReturnValue('');
    render(<Toolbar editor={editor} image={{ maxDimension: 0 }} />);

    choosePng();

    await waitFor(() => {
      expect(prompt).toHaveBeenCalledTimes(1);
      expect(editor.getHTML()).toContain('<img');
      expect(editor.getHTML()).toContain('alt=""');
    });
  });

  it('does not insert an image when the author cancels alternative-text intent', async () => {
    const editor = makeEditor();
    const prompt = vi.spyOn(window, 'prompt').mockReturnValue(null);
    render(<Toolbar editor={editor} image={{ maxDimension: 0 }} />);

    choosePng();

    await waitFor(() => {
      expect(prompt).toHaveBeenCalledTimes(1);
    });
    expect(editor.getHTML()).not.toContain('<img');
  });

  it('does not ask for alternative-text intent when no file is chosen', () => {
    const editor = makeEditor();
    const prompt = vi.spyOn(window, 'prompt').mockReturnValue('unused');
    render(<Toolbar editor={editor} image={{ maxDimension: 0 }} />);

    fireEvent.change(fileInput(), { target: { files: [] } });

    expect(prompt).not.toHaveBeenCalled();
    expect(editor.getHTML()).not.toContain('<img');
  });

  it('reports conversion failures without prompting or inserting an image', async () => {
    const editor = makeEditor();
    const prompt = vi.spyOn(window, 'prompt').mockReturnValue('unused');
    const onImageError = vi.fn();
    render(
      <Toolbar
        editor={editor}
        image={{ maxDimension: 0, maxSizeBytes: 1 }}
        onImageError={onImageError}
      />,
    );

    choosePng();

    await waitFor(() => {
      expect(onImageError).toHaveBeenCalledTimes(1);
    });
    expect(prompt).not.toHaveBeenCalled();
    expect(editor.getHTML()).not.toContain('<img');
  });
});
