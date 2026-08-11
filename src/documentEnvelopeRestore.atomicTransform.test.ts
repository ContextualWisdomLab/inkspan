import { Editor, Extension } from '@tiptap/core';
import { Plugin } from '@tiptap/pm/state';
import { describe, expect, it } from 'vitest';
import { createDocumentEnvelope } from './documentEnvelope.js';
import {
  DocumentEnvelopeRestoreError,
  restoreDocumentEnvelope,
} from './documentEnvelopeRestore.js';
import { buildExtensions } from './extensions/kit.js';

function requestedRestoreEnvelope() {
  return createDocumentEnvelope({
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [{ type: 'text', text: 'Requested restore' }],
      },
    ],
  });
}

function transformedDocument(
  newState: Parameters<NonNullable<ConstructorParameters<typeof Plugin>[0]['appendTransaction']>>[2],
  text: string,
) {
  return newState.schema.node('doc', null, [
    newState.schema.node('paragraph', null, newState.schema.text(text)),
  ]);
}

describe('atomic document-envelope restore under transaction transforms', () => {
  it('preserves the original document when an appendTransaction policy transforms the preview', () => {
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

              const transformed = transformedDocument(
                newState,
                'Policy transformed',
              );
              return newState.tr.replaceWith(
                0,
                newState.doc.content.size,
                transformed.content,
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

      expect(() =>
        restoreDocumentEnvelope(editor, requestedRestoreEnvelope()),
      ).toThrow(DocumentEnvelopeRestoreError);
      expect(editor.state.doc.eq(originalDocument)).toBe(true);
    } finally {
      editor.destroy();
    }
  });

  it('rolls back when a stateful appendTransaction policy transforms only the live dispatch', () => {
    let matchingApplications = 0;
    const statefulTransformingPolicy = Extension.create({
      name: 'restoreStatefulTransformingPolicy',
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

              matchingApplications += 1;
              if (matchingApplications === 1) return null;

              const transformed = transformedDocument(
                newState,
                'Live policy transform',
              );
              return newState.tr.replaceWith(
                0,
                newState.doc.content.size,
                transformed.content,
              );
            },
          }),
        ];
      },
    });
    const editor = new Editor({
      element: document.createElement('div'),
      extensions: buildExtensions({
        additionalExtensions: [statefulTransformingPolicy],
      }),
      content: '<p>Original document</p>',
    });

    try {
      const originalDocument = editor.state.doc;

      expect(() =>
        restoreDocumentEnvelope(editor, requestedRestoreEnvelope()),
      ).toThrow(DocumentEnvelopeRestoreError);
      expect(matchingApplications).toBe(2);
      expect(editor.state.doc.eq(originalDocument)).toBe(true);
    } finally {
      editor.destroy();
    }
  });
});
