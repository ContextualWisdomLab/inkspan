import type { Editor } from '@tiptap/react';
import { runInNewContext } from 'node:vm';
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

  it('rejects accessor-backed document JSON without evaluating the accessor', () => {
    const getter = vi.fn(() => {
      throw new Error('private extension getter executed');
    });
    const metadata: Record<string, unknown> = {};
    Object.defineProperty(metadata, 'privateValue', {
      enumerable: true,
      configurable: true,
      get: getter,
    });
    const documentJson = {
      type: 'doc',
      metadata,
    };
    const editor = {
      getHTML: () => '<p>Hello</p>',
      getJSON: () => documentJson,
      isEmpty: false,
    } as unknown as Editor;

    expect(() => createEditorDocumentSnapshot(editor, 'markdown')).toThrowError(
      new RangeError('Editor document JSON must contain data properties only.'),
    );
    expect(getter).not.toHaveBeenCalled();
  });

  it('rejects own symbol keys that JSON serialization would omit', () => {
    const privateKey = Symbol('private-extension-metadata');
    const documentJson: Record<PropertyKey, unknown> = { type: 'doc' };
    documentJson[privateKey] = { mutable: true };
    const editor = {
      getHTML: () => '<p>Hello</p>',
      getJSON: () => documentJson,
      isEmpty: false,
    } as unknown as Editor;

    expect(() => createEditorDocumentSnapshot(editor, 'markdown')).toThrowError(
      new RangeError('Editor document JSON must contain data properties only.'),
    );
  });

  it('rejects non-enumerable properties without evaluating accessors', () => {
    const getter = vi.fn(() => {
      throw new Error('private hidden getter executed');
    });
    const metadata: Record<string, unknown> = {};
    Object.defineProperty(metadata, 'privateValue', {
      enumerable: false,
      configurable: true,
      get: getter,
    });
    const documentJson = {
      type: 'doc',
      metadata,
    };
    const editor = {
      getHTML: () => '<p>Hello</p>',
      getJSON: () => documentJson,
      isEmpty: false,
    } as unknown as Editor;

    expect(() => createEditorDocumentSnapshot(editor, 'markdown')).toThrowError(
      new RangeError('Editor document JSON must contain data properties only.'),
    );
    expect(getter).not.toHaveBeenCalled();
  });

  it('rejects exotic object containers that cannot be represented as document JSON', () => {
    const documentJson = {
      type: 'doc',
      metadata: new Date(0),
    };
    const editor = {
      getHTML: () => '<p>Hello</p>',
      getJSON: () => documentJson,
      isEmpty: false,
    } as unknown as Editor;

    expect(() => createEditorDocumentSnapshot(editor, 'markdown')).toThrowError(
      new RangeError(
        'Editor document JSON must contain plain objects and arrays only.',
      ),
    );
  });

  it('rejects non-JSON primitive metadata values', () => {
    const unsupportedValues: unknown[] = [
      undefined,
      () => undefined,
      Symbol('private-extension-metadata'),
      1n,
    ];

    for (const metadata of unsupportedValues) {
      const documentJson = { type: 'doc', metadata };
      const editor = {
        getHTML: () => '<p>Hello</p>',
        getJSON: () => documentJson,
        isEmpty: false,
      } as unknown as Editor;

      expect(() => createEditorDocumentSnapshot(editor, 'markdown')).toThrowError(
        new RangeError('Editor document JSON must contain JSON-compatible values only.'),
      );
    }
  });

  it('rejects non-finite numeric metadata values', () => {
    for (const metadata of [
      Number.NaN,
      Number.POSITIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
    ]) {
      const documentJson = { type: 'doc', metadata };
      const editor = {
        getHTML: () => '<p>Hello</p>',
        getJSON: () => documentJson,
        isEmpty: false,
      } as unknown as Editor;

      expect(() => createEditorDocumentSnapshot(editor, 'markdown')).toThrowError(
        new RangeError('Editor document JSON must contain JSON-compatible values only.'),
      );
    }
  });

  it('rejects sparse arrays that JSON serialization would materialize with null holes', () => {
    const metadata = new Array<unknown>(2);
    metadata[1] = 'present';
    const documentJson = { type: 'doc', metadata };
    const editor = {
      getHTML: () => '<p>Hello</p>',
      getJSON: () => documentJson,
      isEmpty: false,
    } as unknown as Editor;

    expect(() => createEditorDocumentSnapshot(editor, 'markdown')).toThrowError(
      new RangeError('Editor document JSON arrays must contain dense elements only.'),
    );
  });

  it('rejects extra enumerable array properties that JSON serialization would omit', () => {
    const metadata = ['present'] as unknown[] & Record<string, unknown>;
    metadata.privateExtensionMetadata = 'must-not-survive';
    const documentJson = { type: 'doc', metadata };
    const editor = {
      getHTML: () => '<p>Hello</p>',
      getJSON: () => documentJson,
      isEmpty: false,
    } as unknown as Editor;

    expect(() => createEditorDocumentSnapshot(editor, 'markdown')).toThrowError(
      new RangeError('Editor document JSON arrays must contain dense elements only.'),
    );
  });

  it('preserves null-prototype JSON objects', () => {
    const metadata = Object.create(null) as Record<string, unknown>;
    metadata.classification = 'internal';
    const documentJson = {
      type: 'doc',
      metadata,
    };
    const editor = {
      getHTML: () => '<p>Hello</p>',
      getJSON: () => documentJson,
      isEmpty: false,
    } as unknown as Editor;

    const snapshot = createEditorDocumentSnapshot(editor, 'html');

    expect(snapshot.documentJson).toBe(documentJson);
    expect(Object.isFrozen(metadata)).toBe(true);
  });

  it('preserves plain JSON objects from another JavaScript realm', () => {
    const metadata = runInNewContext(
      '({ classification: "internal" })',
    ) as Record<string, unknown>;
    expect(Object.getPrototypeOf(metadata)).not.toBe(Object.prototype);
    const documentJson = {
      type: 'doc',
      metadata,
    };
    const editor = {
      getHTML: () => '<p>Hello</p>',
      getJSON: () => documentJson,
      isEmpty: false,
    } as unknown as Editor;

    const snapshot = createEditorDocumentSnapshot(editor, 'html');

    expect(snapshot.documentJson).toBe(documentJson);
    expect(Object.isFrozen(metadata)).toBe(true);
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
