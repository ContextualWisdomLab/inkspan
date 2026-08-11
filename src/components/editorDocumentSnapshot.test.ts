import type { Editor } from '@tiptap/react';
import { describe, expect, it, vi } from 'vitest';
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

  it('rejects cyclic document JSON before revisiting an active object', () => {
    const documentJson: Record<string, unknown> = { type: 'doc' };
    const metadata: Record<string, unknown> = { owner: 'host-extension' };
    documentJson.metadata = metadata;
    metadata.document = documentJson;

    const originalObjectValues = Object.values.bind(Object);
    let rootVisits = 0;
    const objectValuesSpy = vi
      .spyOn(Object, 'values')
      .mockImplementation((value: object) => {
        if (value === documentJson) {
          rootVisits += 1;
          if (rootVisits > 1) {
            throw new Error('cycle traversal revisited root');
          }
        }
        return originalObjectValues(value);
      });
    const editor = {
      getHTML: () => '<p>Hello</p>',
      getJSON: () => documentJson,
      isEmpty: false,
    } as unknown as Editor;

    try {
      expect(() => createEditorDocumentSnapshot(editor, 'markdown')).toThrowError(
        new RangeError('Editor document JSON must be acyclic.'),
      );
    } finally {
      objectValuesSpy.mockRestore();
    }
  });

  it('preserves shared acyclic metadata while deeply freezing it once', () => {
    const sharedMetadata = { classification: 'internal' };
    const documentJson = {
      type: 'doc',
      content: [
        { type: 'paragraph', attrs: { metadata: sharedMetadata } },
        { type: 'paragraph', attrs: { metadata: sharedMetadata } },
      ],
    };
    const editor = {
      getHTML: () => '<p>One</p><p>Two</p>',
      getJSON: () => documentJson,
      isEmpty: false,
    } as unknown as Editor;

    const snapshot = createEditorDocumentSnapshot(editor, 'html');

    expect(snapshot.documentJson).toBe(documentJson);
    expect(Object.isFrozen(sharedMetadata)).toBe(true);
  });
});
