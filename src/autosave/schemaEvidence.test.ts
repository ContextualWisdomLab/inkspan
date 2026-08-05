import { describe, expect, it, vi } from 'vitest';
import type { CwlEditorDocumentRevisionEvidence } from '../documentRevisionEvidence.js';
import {
  createDocumentAutosaveQueue,
  DocumentAutosaveQueueError,
} from './package.js';

function createEvidence(
  schemaId: string,
  schemaVersion: number,
  documentJson: unknown = Object.freeze({ type: 'doc' }),
): CwlEditorDocumentRevisionEvidence {
  const digestHex = '31'.repeat(32);
  return Object.freeze({
    envelope: Object.freeze({
      schemaId,
      schemaVersion,
      documentJson,
    }),
    revision: Object.freeze({
      algorithm: 'SHA-256',
      digestHex,
      strongEntityTag: `"sha256-${digestHex}"`,
    }),
  }) as CwlEditorDocumentRevisionEvidence;
}

function expectRejectedBeforeSave(documentJson: unknown): void {
  const save = vi.fn(() => ({ status: 'saved' as const }));
  const queue = createDocumentAutosaveQueue({ save });

  expect(() =>
    queue.enqueue(
      createEvidence(
        'https://inkspan.io/schemas/document-envelope/v1',
        1,
        documentJson,
      ),
    ),
  ).toThrow(DocumentAutosaveQueueError);
  expect(save).not.toHaveBeenCalled();
}

function createDeeplyNestedDocument(depth: number): Readonly<Record<string, unknown>> {
  let nested: Readonly<Record<string, unknown>> = Object.freeze({
    type: 'text',
    text: 'deep evidence',
  });
  for (let index = 0; index < depth; index += 1) {
    nested = Object.freeze({
      type: 'paragraph',
      content: Object.freeze([nested]),
    });
  }
  return Object.freeze({
    type: 'doc',
    content: Object.freeze([nested]),
  });
}

describe('document autosave schema evidence boundary', () => {
  it.each([
    ['https://inkspan.io/schemas/document-envelope/v2', 1],
    ['https://inkspan.io/schemas/document-envelope/v1', 2],
  ] as const)(
    'rejects unsupported schema evidence before the host callback',
    (schemaId, schemaVersion) => {
      const save = vi.fn(() => ({ status: 'saved' as const }));
      const queue = createDocumentAutosaveQueue({ save });

      expect(() => queue.enqueue(createEvidence(schemaId, schemaVersion))).toThrow(
        DocumentAutosaveQueueError,
      );
      expect(save).not.toHaveBeenCalled();
    },
  );

  it('accepts deeply frozen JSON evidence containing every JSON primitive', async () => {
    const save = vi.fn(() => ({ status: 'saved' as const }));
    const queue = createDocumentAutosaveQueue({ save });
    const nullPrototypeAttributes = Object.create(null) as Record<
      string,
      unknown
    >;
    Object.defineProperties(nullPrototypeAttributes, {
      checked: { value: true, enumerable: true },
      count: { value: 3, enumerable: true },
      label: { value: 'frozen evidence', enumerable: true },
      optional: { value: null, enumerable: true },
    });
    Object.freeze(nullPrototypeAttributes);
    const documentJson = Object.freeze({
      type: 'doc',
      attrs: nullPrototypeAttributes,
      content: Object.freeze([]),
    });

    await expect(
      queue.enqueue(
        createEvidence(
          'https://inkspan.io/schemas/document-envelope/v1',
          1,
          documentJson,
        ),
      ),
    ).resolves.toMatchObject({ status: 'saved' });
    expect(save).toHaveBeenCalledOnce();
  });

  it('rejects malformed evidence wrappers without evaluating accessors', () => {
    let getterCalls = 0;
    const digestHex = '31'.repeat(32);
    const revision = Object.freeze({
      algorithm: 'SHA-256',
      digestHex,
      strongEntityTag: `"sha256-${digestHex}"`,
    });
    const frozenDocument = Object.freeze({ type: 'doc' });
    const nonEnumerableEvidence = Object.freeze(
      Object.defineProperty({ revision }, 'envelope', {
        value: Object.freeze({ documentJson: frozenDocument }),
        enumerable: false,
      }),
    );
    const accessorEvidence = Object.freeze(
      Object.defineProperty({ revision }, 'envelope', {
        enumerable: true,
        get() {
          getterCalls += 1;
          return Object.freeze({ documentJson: frozenDocument });
        },
      }),
    );
    const nonEnumerableEnvelope = Object.freeze(
      Object.defineProperty({}, 'documentJson', {
        value: frozenDocument,
        enumerable: false,
      }),
    );
    const accessorEnvelope = Object.freeze(
      Object.defineProperty({}, 'documentJson', {
        enumerable: true,
        get() {
          getterCalls += 1;
          return frozenDocument;
        },
      }),
    );
    const hostileEvidence = new Proxy(Object.freeze({}), {
      getOwnPropertyDescriptor() {
        throw new Error('tenant-private-evidence-detail');
      },
    });
    const candidates: unknown[] = [
      'not-an-object',
      null,
      Object.freeze({ revision }),
      nonEnumerableEvidence,
      accessorEvidence,
      Object.freeze({ envelope: 42, revision }),
      Object.freeze({ envelope: null, revision }),
      Object.freeze({ envelope: Object.freeze({}), revision }),
      Object.freeze({ envelope: nonEnumerableEnvelope, revision }),
      Object.freeze({ envelope: accessorEnvelope, revision }),
      hostileEvidence,
    ];

    for (const candidate of candidates) {
      const save = vi.fn(() => ({ status: 'saved' as const }));
      const queue = createDocumentAutosaveQueue({ save });
      expect(() => queue.enqueue(candidate as never)).toThrow(
        DocumentAutosaveQueueError,
      );
      expect(save).not.toHaveBeenCalled();
    }
    expect(getterCalls).toBe(0);
  });

  it('rejects a mutable nested object even when every evidence root is frozen', () => {
    const mutableTextNode = { type: 'text', text: 'original text' };
    const documentJson = Object.freeze({
      type: 'doc',
      content: Object.freeze([mutableTextNode]),
    });

    expectRejectedBeforeSave(documentJson);
    mutableTextNode.text = 'mutated after enqueue';
  });

  it('rejects frozen nested accessors without evaluating them', () => {
    let getterCalls = 0;
    const accessorNode = Object.freeze(
      Object.defineProperty({}, 'type', {
        enumerable: true,
        get() {
          getterCalls += 1;
          return 'paragraph';
        },
      }),
    );
    const documentJson = Object.freeze({
      type: 'doc',
      content: Object.freeze([accessorNode]),
    });

    expectRejectedBeforeSave(documentJson);
    expect(getterCalls).toBe(0);
  });

  it('fails closed when nested reflection throws', () => {
    const frozenTarget = Object.freeze({ type: 'paragraph' });
    const hostileNode = new Proxy(frozenTarget, {
      ownKeys() {
        throw new Error('tenant-private-document-detail');
      },
    });
    const documentJson = Object.freeze({
      type: 'doc',
      content: Object.freeze([hostileNode]),
    });

    expectRejectedBeforeSave(documentJson);
  });

  it('rejects non-JSON, aliased, cyclic, sparse, and over-depth frozen graphs', () => {
    const sharedNode = Object.freeze({ type: 'paragraph' });
    const cyclicNode: Record<string, unknown> = { type: 'paragraph' };
    cyclicNode.content = cyclicNode;
    Object.freeze(cyclicNode);

    const sparseContent = new Array<unknown>(1);
    Object.defineProperty(sparseContent, Symbol('padding'), {
      value: 'unsupported',
      enumerable: true,
    });
    Object.freeze(sparseContent);

    const nonEnumerableContent: unknown[] = [];
    Object.defineProperty(nonEnumerableContent, '0', {
      value: 'hidden',
      enumerable: false,
    });
    Object.freeze(nonEnumerableContent);

    let arrayGetterCalls = 0;
    const accessorContent: unknown[] = [];
    Object.defineProperty(accessorContent, '0', {
      enumerable: true,
      get() {
        arrayGetterCalls += 1;
        return 'hidden';
      },
    });
    Object.freeze(accessorContent);

    const nonEnumerableNode = Object.freeze(
      Object.defineProperty({}, 'type', {
        value: 'paragraph',
        enumerable: false,
      }),
    );
    const symbolNode = Object.freeze({
      type: 'paragraph',
      [Symbol('private')]: 'unsupported',
    });

    for (const documentJson of [
      Object.freeze({ type: 'doc', unsupported: undefined }),
      Object.freeze({ type: 'doc', invalidNumber: Number.NaN }),
      Object.freeze({ type: 'doc', content: Object.freeze([new Date(0)]) }),
      Object.freeze({
        type: 'doc',
        content: Object.freeze([sharedNode, sharedNode]),
      }),
      Object.freeze({ type: 'doc', content: Object.freeze([cyclicNode]) }),
      Object.freeze({ type: 'doc', content: sparseContent }),
      Object.freeze({ type: 'doc', content: nonEnumerableContent }),
      Object.freeze({ type: 'doc', content: accessorContent }),
      Object.freeze({
        type: 'doc',
        content: Object.freeze([nonEnumerableNode]),
      }),
      Object.freeze({ type: 'doc', content: Object.freeze([symbolNode]) }),
      createDeeplyNestedDocument(129),
    ]) {
      expectRejectedBeforeSave(documentJson);
    }
    expect(arrayGetterCalls).toBe(0);
  });

  it('bounds traversal of forged evidence to the supported JSON value count', () => {
    const oversizedContent = Object.freeze(
      Array.from({ length: 1_000_001 }, () => null),
    );
    const documentJson = Object.freeze({
      type: 'doc',
      content: oversizedContent,
    });

    expectRejectedBeforeSave(documentJson);
  });
});
