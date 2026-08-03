import type { Editor } from '@tiptap/react';
import { describe, expect, it } from 'vitest';
import { createEditorDocumentSnapshot } from './editorDocumentSnapshot.js';

describe('createEditorDocumentSnapshot', () => {
  it('returns a frozen empty snapshot before editor creation', () => {
    const snapshot = createEditorDocumentSnapshot(null, 'markdown');

    expect(snapshot).toEqual({
      mode: 'markdown',
      value: '',
      html: '',
      markdown: '',
      plainText: '',
      documentJson: null,
      isEmpty: true,
    });
    expect(Object.isFrozen(snapshot)).toBe(true);
  });

  it('reuses one normalized Markdown projection and deeply freezes JSON', () => {
    const documentJson = {
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: {
            level: 2,
            metadata: { classification: 'internal', nullable: null },
          },
          content: [{ type: 'text', text: 'Hello' }],
        },
      ],
    };
    const editor = {
      getHTML: () => '<p>Hello</p>',
      getJSON: () => documentJson,
      isEmpty: false,
    } as unknown as Editor;

    const snapshot = createEditorDocumentSnapshot(editor, 'markdown');

    expect(snapshot).toEqual({
      mode: 'markdown',
      value: 'Hello',
      html: '<p>Hello</p>',
      markdown: 'Hello',
      plainText: 'Hello',
      documentJson,
      isEmpty: false,
    });
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot.documentJson)).toBe(true);
    expect(Object.isFrozen(snapshot.documentJson?.content)).toBe(true);
    expect(Object.isFrozen(snapshot.documentJson?.content?.[0])).toBe(true);
    expect(Object.isFrozen(snapshot.documentJson?.content?.[0]?.attrs)).toBe(
      true,
    );
    expect(
      Object.isFrozen(
        snapshot.documentJson?.content?.[0]?.attrs?.metadata as object,
      ),
    ).toBe(true);
  });

  it('uses HTML as the active value without changing portable projections', () => {
    const documentJson = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello' }] }],
    };
    const editor = {
      getHTML: () => '<p>Hello</p>',
      getJSON: () => documentJson,
      isEmpty: false,
    } as unknown as Editor;

    expect(createEditorDocumentSnapshot(editor, 'html')).toEqual({
      mode: 'html',
      value: '<p>Hello</p>',
      html: '<p>Hello</p>',
      markdown: 'Hello',
      plainText: 'Hello',
      documentJson,
      isEmpty: false,
    });
  });
});
