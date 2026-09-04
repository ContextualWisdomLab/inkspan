import { Plugin } from '@tiptap/pm/state';
import type { Editor } from '@tiptap/react';
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { CwlEditor } from './CwlEditor.js';

afterEach(cleanup);

async function renderControlledEditor(): Promise<{
  editor: () => Editor;
  replaceValue: () => Promise<void>;
}> {
  let editor: Editor | undefined;
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
  return {
    editor: () => editor!,
    replaceValue: async () => {
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
    },
  };
}

describe('CwlEditor controlled-value transaction policy', () => {
  it('keeps the previous document when preview policy transforms the replacement', async () => {
    const controlled = await renderControlledEditor();
    let transformedReplacementCount = 0;
    controlled.editor().registerPlugin(
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

    await controlled.replaceValue();

    await waitFor(() => {
      expect(transformedReplacementCount).toBeGreaterThan(0);
      expect(controlled.editor().getText()).toBe('Original');
    });
  });

  it('rolls back when stateful policy transforms only the live replacement', async () => {
    const controlled = await renderControlledEditor();
    let requestedReplacementCount = 0;
    controlled.editor().registerPlugin(
      new Plugin({
        appendTransaction(_transactions, _oldState, newState) {
          if (newState.doc.textContent !== 'Requested') return null;
          requestedReplacementCount += 1;
          if (requestedReplacementCount === 1) return null;
          const paragraph = newState.schema.nodes.paragraph!.create(
            null,
            newState.schema.text('Live-only transform'),
          );
          return newState.tr.replaceWith(
            0,
            newState.doc.content.size,
            paragraph,
          );
        },
      }),
    );

    await controlled.replaceValue();

    await waitFor(() => {
      expect(requestedReplacementCount).toBe(2);
      expect(controlled.editor().getText()).toBe('Original');
    });
  });

  it('rolls back when stateful policy throws only during live replacement', async () => {
    const controlled = await renderControlledEditor();
    let requestedReplacementCount = 0;
    controlled.editor().registerPlugin(
      new Plugin({
        filterTransaction(transaction) {
          if (!transaction.docChanged || transaction.doc.textContent !== 'Requested') {
            return true;
          }
          requestedReplacementCount += 1;
          if (requestedReplacementCount === 2) {
            throw new Error('policy refused live replacement');
          }
          return true;
        },
      }),
    );

    await controlled.replaceValue();

    await waitFor(() => {
      expect(requestedReplacementCount).toBe(2);
      expect(controlled.editor().getText()).toBe('Original');
    });
  });

  it('keeps the previous document when preview policy throws', async () => {
    const controlled = await renderControlledEditor();
    let refusalCount = 0;
    controlled.editor().registerPlugin(
      new Plugin({
        filterTransaction(transaction) {
          if (!transaction.docChanged || transaction.doc.textContent !== 'Requested') {
            return true;
          }
          refusalCount += 1;
          throw new Error('policy refused preview');
        },
      }),
    );

    await controlled.replaceValue();

    await waitFor(() => {
      expect(refusalCount).toBe(1);
      expect(controlled.editor().getText()).toBe('Original');
    });
  });
});
