import { cleanup, render, screen } from '@testing-library/react';
import { Editor } from '@tiptap/react';
import { afterEach, describe, expect, it } from 'vitest';

import { buildExtensions } from './extensions/kit.js';
import { Toolbar } from './components/Toolbar.js';

const openEditors: Editor[] = [];

function makeEditor(): Editor {
  const element = document.createElement('div');
  document.body.appendChild(element);
  const editor = new Editor({
    element,
    extensions: buildExtensions({ image: { maxDimension: 0 } }),
    content: '<p>shortcut semantics</p>',
  });
  openEditors.push(editor);
  return editor;
}

afterEach(() => {
  cleanup();
  for (const editor of openEditors.splice(0)) {
    if (!editor.isDestroyed) editor.destroy();
  }
});

describe('toolbar shortcut accessibility semantics', () => {
  it('exposes implemented cross-platform editor shortcuts to assistive technology', () => {
    const editor = makeEditor();
    editor.chain().focus().insertContent(' history').run();
    editor.commands.undo();

    render(<Toolbar editor={editor} />);

    expect(screen.getByRole('button', { name: /Bold/ })).toHaveAttribute(
      'aria-keyshortcuts',
      'Control+B Meta+B',
    );
    expect(screen.getByRole('button', { name: /Italic/ })).toHaveAttribute(
      'aria-keyshortcuts',
      'Control+I Meta+I',
    );
    expect(screen.getByRole('button', { name: /Undo/ })).toHaveAttribute(
      'aria-keyshortcuts',
      'Control+Z Meta+Z',
    );
    const redoButton = screen.getByRole('button', { name: /Redo/ });
    expect(redoButton).toHaveAttribute(
      'aria-keyshortcuts',
      'Control+Shift+Z Meta+Shift+Z Control+Y Meta+Y',
    );
    expect(redoButton).toHaveAttribute(
      'title',
      'Redo (Ctrl/Cmd+Shift+Z or Ctrl/Cmd+Y)',
    );

    expect(screen.getByRole('button', { name: /Strikethrough/ })).not.toHaveAttribute(
      'aria-keyshortcuts',
    );
  });

  it('exposes the editor-surface link shortcut implemented by EditorFrame', () => {
    const editor = makeEditor();

    render(<Toolbar editor={editor} />);

    const linkButton = screen.getByRole('button', { name: /Insert\/edit link/ });
    expect(linkButton).toHaveAttribute('aria-keyshortcuts', 'Control+K Meta+K');
    expect(linkButton).toHaveAttribute('title', 'Insert/edit link (Ctrl/Cmd+K)');
  });
});
