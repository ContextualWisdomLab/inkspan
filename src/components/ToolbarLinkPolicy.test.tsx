import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Toolbar } from './Toolbar.js';

const openEditors: Editor[] = [];

function makeEditor(): Editor {
  const element = document.createElement('div');
  document.body.appendChild(element);
  const editor = new Editor({
    element,
    extensions: [StarterKit],
    content: '<p>link target</p>',
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
});

describe('Toolbar link policy boundary', () => {
  it('rejects an executable URL before issuing an editor command', () => {
    const editor = makeEditor();
    const commandChain = {
      focus: vi.fn(() => commandChain),
      extendMarkRange: vi.fn(() => commandChain),
      setLink: vi.fn(() => commandChain),
      unsetLink: vi.fn(() => commandChain),
      run: vi.fn(() => true),
    };
    vi.spyOn(editor, 'chain').mockReturnValue(
      commandChain as unknown as ReturnType<Editor['chain']>,
    );
    vi.spyOn(window, 'prompt').mockReturnValue('javascript:alert(1)');

    render(<Toolbar editor={editor} />);
    fireEvent.click(screen.getByRole('button', { name: /Insert\/edit link/ }));

    expect(commandChain.setLink).not.toHaveBeenCalled();
    expect(commandChain.run).not.toHaveBeenCalled();
  });
});
