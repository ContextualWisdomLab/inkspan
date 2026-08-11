import { Plugin } from '@tiptap/pm/state';
import type { Editor } from '@tiptap/react';
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { CwlEditor } from './CwlEditor.js';

afterEach(cleanup);

describe('CwlEditor controlled-value transaction policy', () => {
  it('keeps the previous document when policy appends a transformed replacement', async () => {
    let editor: Editor | undefined;
    let transformedReplacementCount = 0;
    const { rerender } = render(
      <CwlEditor
        mode="markdown"
        value="Original"
        onReady={(instance) => {
          editor = instance;
        }}
      />,
    );

    await waitFor(() => expect(editor).toBeTruthy());
    editor!.registerPlugin(
      new Plugin({
        appendTransaction(_transactions, _oldState, newState) {
          if (newState.doc.textContent !== 'Requested') return null;
          transformedReplacementCount += 1;
          const paragraph = newState.schema.nodes.paragraph!.create(
            null,
            newState.schema.text('Policy transformed'),
          );
          return newState.tr.replaceWith(
            0,
            newState.doc.content.size,
            paragraph,
          );
        },
      }),
    );

    await act(async () => {
      rerender(
        <CwlEditor
          mode="markdown"
          value="Requested"
          onReady={(instance) => {
            editor = instance;
          }}
        />,
      );
    });

    await waitFor(() => {
      expect(transformedReplacementCount).toBeGreaterThan(0);
      expect(editor!.getText()).toBe('Original');
    });
  });
});
