import type { Editor } from '@tiptap/react';
import { describe, expect, it } from 'vitest';
import { createEditorDocumentSnapshot } from './editorDocumentSnapshot.js';

describe('document snapshot reflection boundary', () => {
  it('redacts revoked proxy array-shape failures', () => {
    const { proxy: metadata, revoke } = Proxy.revocable(
      { classification: 'internal' },
      {},
    );
    revoke();
    const editor = {
      getHTML: () => '<p>Hello</p>',
      getJSON: () => ({ type: 'doc', metadata }),
      isEmpty: false,
    } as unknown as Editor;

    expect(() => createEditorDocumentSnapshot(editor, 'markdown')).toThrowError(
      new RangeError(
        'Editor document JSON must contain plain objects and arrays only.',
      ),
    );
  });

  it('redacts hostile prototype reflection failures', () => {
    const metadata = new Proxy(
      { classification: 'internal' },
      {
        getPrototypeOf() {
          throw new Error('private prototype trap detail');
        },
      },
    );
    const editor = {
      getHTML: () => '<p>Hello</p>',
      getJSON: () => ({ type: 'doc', metadata }),
      isEmpty: false,
    } as unknown as Editor;

    expect(() => createEditorDocumentSnapshot(editor, 'markdown')).toThrowError(
      new RangeError(
        'Editor document JSON must contain plain objects and arrays only.',
      ),
    );
  });

  it('redacts hostile own-key reflection failures', () => {
    const metadata = new Proxy(
      { classification: 'internal' },
      {
        ownKeys() {
          throw new Error('private ownKeys trap detail');
        },
      },
    );
    const editor = {
      getHTML: () => '<p>Hello</p>',
      getJSON: () => ({ type: 'doc', metadata }),
      isEmpty: false,
    } as unknown as Editor;

    expect(() => createEditorDocumentSnapshot(editor, 'markdown')).toThrowError(
      new RangeError('Editor document JSON must contain data properties only.'),
    );
  });

  it('redacts hostile property-descriptor reflection failures', () => {
    const metadata = new Proxy(
      { classification: 'internal' },
      {
        getOwnPropertyDescriptor() {
          throw new Error('private descriptor trap detail');
        },
      },
    );
    const editor = {
      getHTML: () => '<p>Hello</p>',
      getJSON: () => ({ type: 'doc', metadata }),
      isEmpty: false,
    } as unknown as Editor;

    expect(() => createEditorDocumentSnapshot(editor, 'markdown')).toThrowError(
      new RangeError('Editor document JSON must contain data properties only.'),
    );
  });

  it('redacts hostile freeze reflection failures', () => {
    const metadata = new Proxy(
      { classification: 'internal' },
      {
        preventExtensions() {
          throw new Error('private preventExtensions trap detail');
        },
      },
    );
    const editor = {
      getHTML: () => '<p>Hello</p>',
      getJSON: () => ({ type: 'doc', metadata }),
      isEmpty: false,
    } as unknown as Editor;

    expect(() => createEditorDocumentSnapshot(editor, 'markdown')).toThrowError(
      new RangeError('Editor document JSON must contain data properties only.'),
    );
  });
});
