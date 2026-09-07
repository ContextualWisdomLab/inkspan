import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { Editor } from '@tiptap/react';
import { Toolbar } from './Toolbar.js';
import { buildExtensions } from '../extensions/kit.js';

let editor: Editor | undefined;

afterEach(() => {
  cleanup();
  if (editor && !editor.isDestroyed) editor.destroy();
  editor = undefined;
});

describe('Toolbar customer-facing copy', () => {
  it('keeps implementation jargon out of the image action accessible name', () => {
    const element = document.createElement('div');
    document.body.appendChild(element);
    editor = new Editor({
      element,
      extensions: buildExtensions({ image: { maxDimension: 0 } }),
      content: '<p>hello</p>',
    });

    render(<Toolbar editor={editor} />);

    expect(
      screen.getByRole('button', { name: 'Insert inline image' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /base64/i }),
    ).not.toBeInTheDocument();
  });
});
