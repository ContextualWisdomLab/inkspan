import { Editor, Extension } from '@tiptap/core';
import { Plugin } from '@tiptap/pm/state';
import { describe, expect, it } from 'vitest';
import { createDocumentEnvelope } from './documentEnvelope.js';
import {
  DocumentEnvelopeRestoreError,
  restoreDocumentEnvelope,
} from './documentEnvelopeRestore.js';
import { buildExtensions } from './extensions/kit.js';

describe('atomic document-envelope restore under transaction transforms', () => {
  it('preserves the original document when an appendTransaction policy transforms the replacement', () => {
    const transformingPolicy = Extension.create({
      name: 'restoreTransformingPolicy',
      addProseMirrorPlugins() {
        return [
          new Plugin({
            appendTransaction(transactions, _oldState, newState) {
              if (
                !transactions.some((transaction) => transaction.docChanged) ||
                newState.doc.textContent !== 'Requested restore'
              ) {
                return null;
              }

              const transformedDocument = newState.schema.node('doc', null, [
                newState.schema.node(
                  'paragraph',
                  null,
                  newState.schema.text('Policy transformed'),
                ),
              ]);
              return newState.tr.replaceWith(
                0,
                newState.doc.content.size,
                transformedDocument.content,
              );
            },
          }),
        ];
      },
    });
    const editor = new Editor({
      element: document.createElement('div'),
      extensions: buildExtensions({
        additionalExtensions: [transformingPolicy],
      }),
      content: '<p>Original document</p>',
    });

    try {
      const originalDocument = editor.state.doc;
      const requestedEnvelope = createDocumentEnvelope({
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Requested restore' }],
          },
        ],
      });

      expect(() => restoreDocumentEnvelope(editor, requestedEnvelope)).toThrow(
        DocumentEnvelopeRestoreError,
      );
      expect(editor.state.doc.eq(originalDocument)).toBe(true);
    } finally {
      editor.destroy();
    }
  });
});
