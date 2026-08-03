import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Editor } from '@tiptap/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildExtensions } from '../extensions/kit.js';
import { Toolbar } from './Toolbar.js';

const openEditors: Editor[] = [];

function createEditor(content: string): Editor {
  const editor = new Editor({
    extensions: buildExtensions({ image: { maxDimension: 0 } }),
    content,
  });
  openEditors.push(editor);
  return editor;
}

function selectFirstImage(editor: Editor): void {
  editor.commands.setNodeSelection(0);
}

afterEach(() => {
  cleanup();
  for (const editor of openEditors.splice(0)) {
    if (!editor.isDestroyed) editor.destroy();
  }
  vi.restoreAllMocks();
});

describe('image alternative-text toolbar', () => {
  it('is disabled outside an image selection and defensively makes no change', () => {
    const editor = createEditor('<p>Text only</p>');
    const prompt = vi.spyOn(window, 'prompt');
    render(<Toolbar editor={editor} />);
    const button = screen.getByRole('button', {
      name: 'Edit image alternative text',
    });

    expect(button).toBeDisabled();
    button.removeAttribute('disabled');
    fireEvent.click(button);
    expect(prompt).not.toHaveBeenCalled();
    expect(editor.getHTML()).toBe('<p>Text only</p>');
  });

  it('prefills and replaces meaningful alternative text without changing src', async () => {
    const editor = createEditor(
      '<img src="data:image/png;base64,AAAA" alt="Old description">',
    );
    selectFirstImage(editor);
    const prompt = vi
      .spyOn(window, 'prompt')
      .mockReturnValue('Updated diagram description');
    render(<Toolbar editor={editor} />);
    const button = screen.getByRole('button', {
      name: 'Edit image alternative text',
    });

    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(button);

    expect(prompt).toHaveBeenCalledWith(
      'Image alternative text. Leave empty for a decorative image.',
      'Old description',
    );
    expect(editor.getHTML()).toContain(
      'src="data:image/png;base64,AAAA"',
    );
    expect(editor.getHTML()).toContain(
      'alt="Updated diagram description"',
    );
  });

  it('allows an author to mark an image decorative with explicit empty alt', async () => {
    const editor = createEditor(
      '<img src="data:image/png;base64,AAAA" alt="Meaningful">',
    );
    selectFirstImage(editor);
    vi.spyOn(window, 'prompt').mockReturnValue('');
    render(<Toolbar editor={editor} />);
    const button = screen.getByRole('button', {
      name: 'Edit image alternative text',
    });

    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(button);
    expect(editor.getHTML()).toContain('alt=""');
  });

  it('defaults a missing alternative to empty and leaves the document unchanged on cancel', async () => {
    const editor = createEditor('<img src="data:image/png;base64,AAAA">');
    selectFirstImage(editor);
    const before = editor.getHTML();
    const prompt = vi.spyOn(window, 'prompt').mockReturnValue(null);
    render(<Toolbar editor={editor} />);
    const button = screen.getByRole('button', {
      name: 'Edit image alternative text',
    });

    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(button);
    expect(prompt).toHaveBeenCalledWith(
      'Image alternative text. Leave empty for a decorative image.',
      '',
    );
    expect(editor.getHTML()).toBe(before);
  });

  it('gives toolbar-uploaded images an explicit decorative alt', async () => {
    const editor = createEditor('<p>Before</p>');
    const { container } = render(
      <Toolbar editor={editor} image={{ maxDimension: 0 }} />,
    );
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File([new Uint8Array([1, 2, 3])], 'figure.png', {
      type: 'image/png',
    });

    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(editor.getHTML()).toContain('data:image/png;base64');
      expect(editor.getHTML()).toContain('alt=""');
    });
  });
});
