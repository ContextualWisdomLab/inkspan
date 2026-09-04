import { cleanup, render, screen } from '@testing-library/react';
import { Editor } from '@tiptap/react';
import { afterEach, describe, expect, it } from 'vitest';

import { buildExtensions } from '../extensions/kit.js';
import { Toolbar } from './Toolbar.js';

let editor: Editor | undefined;

afterEach(() => {
  cleanup();
  if (editor && !editor.isDestroyed) editor.destroy();
  editor = undefined;
});

describe('Toolbar customer-facing image action copy', () => {
  it('names the image action without exposing base64 implementation jargon', () => {
    const element = document.createElement('div');
    editor = new Editor({
      element,
      extensions: buildExtensions({ image: { maxDimension: 0 } }),
      content: '<p>before</p>',
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
