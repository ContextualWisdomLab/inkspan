import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { Editor } from '@tiptap/react';
import { Toolbar } from './Toolbar.js';
import { buildExtensions } from '../extensions/kit.js';

const PNG_BYTES = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49,
  0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06,
  0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89,
]);

const openEditors: Editor[] = [];
function makeEditor(content = '<p>hello world</p>'): Editor {
  const element = document.createElement('div');
  document.body.appendChild(element);
  const editor = new Editor({
    element,
    extensions: buildExtensions({ image: { maxDimension: 0 } }),
    content,
  });
  openEditors.push(editor);
  return editor;
}

afterEach(() => {
  cleanup();
  for (const editor of openEditors.splice(0)) {
    if (!editor.isDestroyed) editor.destroy();
  }
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

/** A decodable Image stand-in that always reports a within-bounds size. */
class FitImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  width = 10;
  height = 10;
  set src(_value: string) {
    queueMicrotask(() => this.onload?.());
  }
}

function fileInput(): HTMLInputElement {
  return document.querySelector('input[type="file"]') as HTMLInputElement;
}

describe('Toolbar', () => {
  it('renders every affordance and invokes each button command', () => {
    const editor = makeEditor();
    // Make undo available and one mark active so both the active and disabled
    // ToolbarButton branches render.
    editor.chain().focus().selectAll().toggleBold().run();
    vi.spyOn(window, 'prompt').mockReturnValue(null);

    render(<Toolbar editor={editor} image={{ maxDimension: 0 }} />);

    const bold = screen.getByRole('button', { name: /Bold/ });
    expect(bold).toHaveClass('is-active');
    expect(bold).toHaveAttribute('aria-pressed', 'true');

    const buttons = screen.getAllByRole('button');
    // All 16 affordances (marks, headings, lists, link, table, image, history).
    expect(buttons.length).toBe(16);
    // Cover onMouseDown preventDefault + every onClick handler.
    for (const button of buttons) {
      fireEvent.mouseDown(button);
      if (!(button as HTMLButtonElement).disabled) fireEvent.click(button);
    }
  });

  it('enables and fires the redo command after an undo', () => {
    const editor = makeEditor();
    editor.chain().focus().insertContent(' more').run();
    editor.commands.undo(); // now redo is available
    render(<Toolbar editor={editor} />);
    const redo = screen.getByRole('button', { name: /Redo/ });
    expect(redo).not.toBeDisabled();
    fireEvent.click(redo);
    expect(editor.getHTML()).toContain('more');
  });

  describe('link button', () => {
    it('sets a link when a URL is entered', () => {
      const editor = makeEditor();
      editor.chain().focus().selectAll().run();
      vi.spyOn(window, 'prompt').mockReturnValue('https://example.com');
      render(<Toolbar editor={editor} />);
      fireEvent.click(screen.getByRole('button', { name: /Insert\/edit link/ }));
      expect(editor.getHTML()).toContain('href="https://example.com"');
    });

    it('unsets the link when the URL is cleared to empty', () => {
      const editor = makeEditor('<p><a href="https://x.com">linked</a></p>');
      editor.chain().focus().selectAll().run();
      vi.spyOn(window, 'prompt').mockReturnValue('');
      render(<Toolbar editor={editor} />);
      fireEvent.click(screen.getByRole('button', { name: /Insert\/edit link/ }));
      expect(editor.getHTML()).not.toContain('href=');
    });

    it('does nothing when the prompt is cancelled', () => {
      const editor = makeEditor();
      editor.chain().focus().selectAll().run();
      vi.spyOn(window, 'prompt').mockReturnValue(null);
      render(<Toolbar editor={editor} />);
      const before = editor.getHTML();
      fireEvent.click(screen.getByRole('button', { name: /Insert\/edit link/ }));
      expect(editor.getHTML()).toBe(before);
    });
  });

  describe('inline image upload', () => {
    it('embeds a chosen image using the provided image config', async () => {
      const editor = makeEditor();
      render(
        <Toolbar
          editor={editor}
          image={{ maxSizeBytes: 1024 * 1024, maxDimension: 0, quality: 0.9 }}
        />,
      );
      const file = new File([PNG_BYTES], 'p.png', { type: 'image/png' });
      fireEvent.change(fileInput(), { target: { files: [file] } });
      await waitFor(() =>
        expect(editor.getHTML()).toContain('data:image/png;base64'),
      );
    });

    it('embeds a chosen image using default config when no image prop is set', async () => {
      const editor = makeEditor();
      // With no image prop, maxDimension defaults to 1600, which routes through
      // the downscale path; stub a decodable Image so it resolves in jsdom.
      vi.stubGlobal('Image', FitImage);
      render(<Toolbar editor={editor} />);
      const file = new File([PNG_BYTES], 'p.png', { type: 'image/png' });
      fireEvent.change(fileInput(), { target: { files: [file] } });
      await waitFor(() =>
        expect(editor.getHTML()).toContain('data:image/png;base64'),
      );
    });

    it('ignores a change event with no file', () => {
      const editor = makeEditor();
      render(<Toolbar editor={editor} />);
      fireEvent.change(fileInput(), { target: { files: [] } });
      expect(editor.getHTML()).not.toContain('data:image');
    });

    it('swallows conversion errors (e.g. oversized files)', async () => {
      const editor = makeEditor();
      render(<Toolbar editor={editor} image={{ maxSizeBytes: 4, maxDimension: 0 }} />);
      const file = new File([PNG_BYTES], 'p.png', { type: 'image/png' });
      fireEvent.change(fileInput(), { target: { files: [file] } });
      await new Promise((resolve) => setTimeout(resolve, 15));
      expect(editor.getHTML()).not.toContain('data:image');
    });
  });
});
