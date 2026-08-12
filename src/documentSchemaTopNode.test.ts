import type { JSONContent } from '@tiptap/core';
import { Editor } from '@tiptap/react';
import { afterEach, describe, expect, it } from 'vitest';
import { buildExtensions } from './extensions/kit.js';
import {
  DocumentSchemaError,
  parseDocumentJsonForEditor,
  validateDocumentJson,
} from './documentSchema.js';

const openEditors: Editor[] = [];

function makeEditor(): Editor {
  const element = document.createElement('div');
  document.body.appendChild(element);
  const editor = new Editor({
    element,
    extensions: buildExtensions(),
    content: '<p>existing document</p>',
  });
  openEditors.push(editor);
  return editor;
}

afterEach(() => {
  for (const editor of openEditors.splice(0)) {
    if (!editor.isDestroyed) editor.destroy();
  }
  document.body.replaceChildren();
});

describe('complete document schema boundary', () => {
  it('rejects a schema-valid paragraph instead of treating it as a document root', () => {
    const editor = makeEditor();
    const paragraph: JSONContent = {
      type: 'paragraph',
      content: [{ type: 'text', text: 'private fragment' }],
    };
    const schemaValidFragment = editor.schema.nodeFromJSON(paragraph);

    expect(() => schemaValidFragment.check()).not.toThrow();
    expect(schemaValidFragment.type).not.toBe(editor.schema.topNodeType);
    expect(validateDocumentJson(editor, paragraph)).toBe(false);
    expect(() => parseDocumentJsonForEditor(editor, paragraph)).toThrowError(
      new DocumentSchemaError(),
    );
  });

  it('preserves a valid complete document rooted at the active top node', () => {
    const editor = makeEditor();
    const completeDocument: JSONContent = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'accepted document' }],
        },
      ],
    };

    expect(validateDocumentJson(editor, completeDocument)).toBe(true);
    expect(parseDocumentJsonForEditor(editor, completeDocument).type).toBe(
      editor.schema.topNodeType,
    );
  });
});
