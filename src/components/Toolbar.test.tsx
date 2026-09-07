import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
  act,
} from '@testing-library/react';
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
    // Marks(4) + headings(3) + lists/quote/code/hr(5) +
    // link/table/col/row/delCol/delRow/delTable/image/imageAlt(9) + history(2) = 23.
    expect(buttons.length).toBe(23);
    // Cover onMouseDown preventDefault + every onClick handler.
    for (const button of buttons) {
      fireEvent.mouseDown(button);
      if (!(button as HTMLButtonElement).disabled) fireEvent.click(button);
    }
  });

  describe('toolbar keyboard accessibility', () => {
    it('exposes one tab stop, horizontal orientation, and toggle-only pressed state', async () => {
      const editor = makeEditor();
      render(<Toolbar editor={editor} />);

      const toolbar = screen.getByRole('toolbar', { name: 'Formatting' });
      expect(toolbar).toHaveAttribute('aria-orientation', 'horizontal');
      fireEvent.focus(toolbar);
      fireEvent.keyDown(toolbar, { key: 'ArrowRight' });

      const buttons = screen.getAllByRole('button') as HTMLButtonElement[];
      await waitFor(() => expect(buttons[0]).toHaveAttribute('tabindex', '0'));
      for (const button of buttons.slice(1)) {
        expect(button).toHaveAttribute('tabindex', '-1');
      }

      expect(screen.getByRole('button', { name: /Bold/ })).toHaveAttribute(
        'aria-pressed',
        'false',
      );
      expect(
        screen.getByRole('button', { name: /Horizontal rule/ }),
      ).not.toHaveAttribute('aria-pressed');
    });

    it('supports wrapping arrows, Home/End, and skips disabled controls', () => {
      const editor = makeEditor();
      render(<Toolbar editor={editor} />);

      const bold = screen.getByRole('button', { name: /Bold/ });
      const italic = screen.getByRole('button', { name: /Italic/ });
      const insertTable = screen.getByRole('button', { name: /^Insert table$/ });
      const insertImage = screen.getByRole('button', {
        name: /Insert inline image/,
      });
      const enabledButtons = (
        screen.getAllByRole('button') as HTMLButtonElement[]
      ).filter((button) => !button.disabled);
      const lastEnabled = enabledButtons[enabledButtons.length - 1]!;

      fireEvent.focus(bold);
      fireEvent.keyDown(bold, { key: 'ArrowRight' });
      expect(italic).toHaveFocus();

      fireEvent.keyDown(italic, { key: 'End' });
      expect(lastEnabled).toHaveFocus();

      fireEvent.keyDown(lastEnabled, { key: 'ArrowRight' });
      expect(bold).toHaveFocus();

      fireEvent.keyDown(bold, { key: 'ArrowLeft' });
      expect(lastEnabled).toHaveFocus();

      fireEvent.keyDown(lastEnabled, { key: 'Home' });
      expect(bold).toHaveFocus();

      fireEvent.focus(insertTable);
      fireEvent.keyDown(insertTable, { key: 'ArrowRight' });
      expect(insertImage).toHaveFocus();

      fireEvent.keyDown(insertImage, { key: 'PageDown' });
      expect(insertImage).toHaveFocus();
    });

    it('remembers the focused tab stop and falls back when it becomes disabled', async () => {
      const editor = makeEditor();
      render(<Toolbar editor={editor} />);

      const bold = screen.getByRole('button', { name: /Bold/ });
      const insertImage = screen.getByRole('button', {
        name: /Insert inline image/,
      });
      fireEvent.focus(insertImage);
      expect(insertImage).toHaveAttribute('tabindex', '0');
      expect(bold).toHaveAttribute('tabindex', '-1');

      await act(async () => {
        editor.chain().focus().insertContent(' updated').run();
      });
      await waitFor(() => expect(insertImage).toHaveAttribute('tabindex', '0'));

      await act(async () => {
        editor
          .chain()
          .focus()
          .insertTable({ rows: 2, cols: 2, withHeaderRow: true })
          .run();
      });
      const deleteTable = screen.getByRole('button', { name: /Delete table/ });
      await waitFor(() => expect(deleteTable).not.toBeDisabled());
      fireEvent.focus(deleteTable);
      expect(deleteTable).toHaveAttribute('tabindex', '0');

      await act(async () => {
        editor.chain().focus().deleteTable().run();
      });
      await waitFor(() => expect(deleteTable).toBeDisabled());
      expect(deleteTable).toHaveAttribute('tabindex', '-1');
      expect(bold).toHaveAttribute('tabindex', '0');
    });
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
      vi.spyOn(window, 'prompt').mockReturnValue('Configured image');
      render(
        <Toolbar
          editor={editor}
          image={{ maxSizeBytes: 1024 * 1024, maxDimension: 0, quality: 0.9 }}
        />,
      );
      const file = new File([PNG_BYTES], 'p.png', { type: 'image/png' });
      fireEvent.change(fileInput(), { target: { files: [file] } });
      await waitFor(() => {
        expect(editor.getHTML()).toContain('data:image/png;base64');
        expect(editor.getHTML()).toContain('alt="Configured image"');
      });
    });

    it('embeds a chosen image using default config when no image prop is set', async () => {
      const editor = makeEditor();
      // With no image prop, maxDimension defaults to 1600, which routes through
      // the downscale path; stub a decodable Image so it resolves in jsdom.
      vi.stubGlobal('Image', FitImage);
      vi.spyOn(window, 'prompt').mockReturnValue('Default image');
      render(<Toolbar editor={editor} />);
      const file = new File([PNG_BYTES], 'p.png', { type: 'image/png' });
      fireEvent.change(fileInput(), { target: { files: [file] } });
      await waitFor(() => {
        expect(editor.getHTML()).toContain('data:image/png;base64');
        expect(editor.getHTML()).toContain('alt="Default image"');
      });
    });

    it('ignores a change event with no file', () => {
      const editor = makeEditor();
      render(<Toolbar editor={editor} />);
      fireEvent.change(fileInput(), { target: { files: [] } });
      expect(editor.getHTML()).not.toContain('data:image');
    });

    it('reports conversion errors via onImageError (e.g. oversized files)', async () => {
      const editor = makeEditor();
      const onImageError = vi.fn();
      render(
        <Toolbar
          editor={editor}
          image={{ maxSizeBytes: 4, maxDimension: 0 }}
          onImageError={onImageError}
        />,
      );
      const file = new File([PNG_BYTES], 'p.png', { type: 'image/png' });
      fireEvent.change(fileInput(), { target: { files: [file] } });
      await waitFor(() => expect(onImageError).toHaveBeenCalled());
      expect(editor.getHTML()).not.toContain('data:image');
      expect(String(onImageError.mock.calls[0]![0])).toMatch(/exceeds/i);
    });

    it('does not throw when oversized and no onImageError is wired', async () => {
      const editor = makeEditor();
      render(
        <Toolbar editor={editor} image={{ maxSizeBytes: 4, maxDimension: 0 }} />,
      );
      const file = new File([PNG_BYTES], 'p.png', { type: 'image/png' });
      await act(async () => {
        fireEvent.change(fileInput(), { target: { files: [file] } });
        await new Promise((resolve) => setTimeout(resolve, 15));
      });
      expect(editor.getHTML()).not.toContain('data:image');
    });
  });

  describe('table editing', () => {
    it('enables row/column/delete controls when the cursor is in a table', async () => {
      const editor = makeEditor();
      render(<Toolbar editor={editor} />);
      await act(async () => {
        editor
          .chain()
          .focus()
          .insertTable({ rows: 2, cols: 2, withHeaderRow: true })
          .run();
      });
      await waitFor(() =>
        expect(
          screen.getByRole('button', { name: /Add column after/ }),
        ).not.toBeDisabled(),
      );
      expect(
        screen.getByRole('button', { name: /Add row after/ }),
      ).not.toBeDisabled();
      expect(
        screen.getByRole('button', { name: /Delete column/ }),
      ).not.toBeDisabled();
      expect(
        screen.getByRole('button', { name: /Delete row/ }),
      ).not.toBeDisabled();
      expect(
        screen.getByRole('button', { name: /Delete table/ }),
      ).not.toBeDisabled();

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Add column after/ }));
        fireEvent.click(screen.getByRole('button', { name: /Add row after/ }));
      });
      expect(editor.getHTML()).toContain('<table');
      // 2x2 + 1 col + 1 row → header + 2 body rows, 3 cells per row.
      expect(editor.getHTML().match(/<tr/g)?.length).toBeGreaterThanOrEqual(3);

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Delete column/ }));
        fireEvent.click(screen.getByRole('button', { name: /Delete row/ }));
      });
      expect(editor.getHTML()).toContain('<table');

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Delete table/ }));
      });
      expect(editor.getHTML()).not.toContain('<table');
    });
  });
});
