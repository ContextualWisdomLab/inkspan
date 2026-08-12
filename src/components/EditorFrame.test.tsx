import {
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { Editor } from '@tiptap/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildExtensions } from '../extensions/kit.js';
import { EditorFrame } from './EditorFrame.js';

const openEditors: Editor[] = [];

/** Create one real TipTap editor so keyboard-link behavior is exercised end to end. */
function makeEditor(content = '<p>hello world</p>'): Editor {
  const element = document.createElement('div');
  document.body.appendChild(element);
  const editor = new Editor({
    element,
    extensions: buildExtensions(),
    content,
  });
  openEditors.push(editor);
  return editor;
}

function editorSurface(container: HTMLElement): HTMLElement {
  const surface = container.querySelector<HTMLElement>('.cwl-editor__surface');
  if (surface === null) throw new Error('Missing editor surface');
  return surface;
}

afterEach(() => {
  cleanup();
  for (const editor of openEditors.splice(0)) {
    if (!editor.isDestroyed) editor.destroy();
  }
  vi.restoreAllMocks();
});

describe('EditorFrame writing diagnostics slot', () => {
  it('renders the trusted panel slot immediately before the editor surface', () => {
    const { container } = render(
      <EditorFrame
        editable
        editor={null}
        hideToolbar
        mode="markdown"
        writingDiagnosticsPanel={
          <section aria-label="Writing guidance">Trusted guidance</section>
        }
      />,
    );

    const panel = screen.getByRole('region', { name: 'Writing guidance' });
    const surface = container.querySelector('.cwl-editor__surface');
    expect(surface).not.toBeNull();
    expect(surface?.previousElementSibling).toBe(panel);
  });

  it('adds no diagnostic markup when the internal slot is omitted', () => {
    const { container } = render(
      <EditorFrame
        editable
        editor={null}
        hideToolbar
        mode="markdown"
      />,
    );

    expect(container.querySelector('.cwl-writing-diagnostics')).toBeNull();
    expect(container.querySelector('.cwl-editor__surface')).not.toBeNull();
  });

  it('renders host classes, status, and the formatting toolbar only when enabled', () => {
    const editor = makeEditor();
    const { container } = render(
      <EditorFrame
        className="host-editor"
        editable
        editor={editor}
        hideToolbar={false}
        mode="html"
        status={<p>Editor status</p>}
      />,
    );

    expect(container.firstElementChild).toHaveClass('cwl-editor', 'host-editor');
    expect(container.firstElementChild).toHaveAttribute('data-mode', 'html');
    expect(screen.getByText('Editor status')).toBeInTheDocument();
    expect(screen.getByRole('toolbar', { name: 'Formatting' })).toBeInTheDocument();
  });

  it('omits the toolbar for a read-only editor', () => {
    const editor = makeEditor();
    render(
      <EditorFrame
        editable={false}
        editor={editor}
        hideToolbar={false}
        mode="markdown"
      />,
    );

    expect(screen.queryByRole('toolbar')).not.toBeInTheDocument();
  });

  it('omits the toolbar while no editor instance exists', () => {
    render(
      <EditorFrame
        editable
        editor={null}
        hideToolbar={false}
        mode="markdown"
      />,
    );

    expect(screen.queryByRole('toolbar')).not.toBeInTheDocument();
  });
});

describe('EditorFrame link keyboard workflow', () => {
  it('ignores ordinary keys and safely contains a missing editor instance', () => {
    const prompt = vi.spyOn(window, 'prompt');
    const { container } = render(
      <EditorFrame
        editable
        editor={null}
        hideToolbar
        mode="markdown"
      />,
    );
    const surface = editorSurface(container);

    fireEvent.keyDown(surface, { key: 'x' });
    fireEvent.keyDown(surface, { key: 'k', ctrlKey: true });
    expect(prompt).not.toHaveBeenCalled();
  });

  it('leaves the existing link unchanged when the prompt is cancelled', () => {
    const editor = makeEditor();
    editor.commands.selectAll();
    editor.commands.setLink({ href: 'https://existing.example' });
    editor.commands.setTextSelection(2);
    vi.spyOn(window, 'prompt').mockReturnValue(null);
    const { container } = render(
      <EditorFrame editable editor={editor} hideToolbar mode="markdown" />,
    );

    fireEvent.keyDown(editorSurface(container), { key: 'k', metaKey: true });

    expect(editor.getAttributes('link').href).toBe('https://existing.example');
    expect(window.prompt).toHaveBeenCalledWith(
      'Link URL',
      'https://existing.example',
    );
  });

  it('removes the current link when the prompt is submitted empty', () => {
    const editor = makeEditor();
    editor.commands.selectAll();
    editor.commands.setLink({ href: 'https://existing.example' });
    editor.commands.setTextSelection(2);
    vi.spyOn(window, 'prompt').mockReturnValue('');
    const { container } = render(
      <EditorFrame editable editor={editor} hideToolbar mode="markdown" />,
    );

    fireEvent.keyDown(editorSurface(container), { key: 'K', ctrlKey: true });

    expect(editor.isActive('link')).toBe(false);
  });

  it('sets the submitted link URL through the real editor command chain', () => {
    const editor = makeEditor();
    editor.commands.selectAll();
    vi.spyOn(window, 'prompt').mockReturnValue('https://new.example/path');
    const { container } = render(
      <EditorFrame editable editor={editor} hideToolbar mode="markdown" />,
    );

    fireEvent.keyDown(editorSurface(container), { key: 'k', ctrlKey: true });

    expect(editor.getAttributes('link').href).toBe('https://new.example/path');
    expect(window.prompt).toHaveBeenCalledWith('Link URL', 'https://');
  });
});
