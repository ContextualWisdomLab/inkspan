import { describe, expect, it } from 'vitest';

import {
  exportHangulDocument,
  HangulDocumentError,
  openHangulDocument,
  type HangulDocumentEngine,
  type HangulEngineDocument,
} from './index.js';

const PRIVATE_CLEANUP_SENTINEL = new Error('private cleanup sentinel');

class CleanupThrowingDocument implements HangulEngineDocument {
  constructor(readonly selectionHtml = '<p>safe</p>') {}

  getSourceFormat(): string {
    return 'hwpx';
  }

  getSectionCount(): number {
    return 1;
  }

  getParagraphCount(): number {
    return 1;
  }

  getParagraphLength(): number {
    return 0;
  }

  exportSelectionHtml(): string {
    return this.selectionHtml;
  }

  deleteText(): string {
    return '{"ok":true}';
  }

  pasteHtml(): string {
    return '{"ok":true}';
  }

  exportHwp(): Uint8Array {
    return new Uint8Array([1]);
  }

  exportHwpx(): Uint8Array {
    return new Uint8Array([2]);
  }

  free(): void {
    throw PRIVATE_CLEANUP_SENTINEL;
  }
}

function engineFor(
  source: HangulEngineDocument,
  target: HangulEngineDocument = new CleanupThrowingDocument(),
): HangulDocumentEngine {
  return {
    id: 'cleanup-failure-test',
    open: async () => source,
    create: async () => target,
  };
}

describe('Hangul engine cleanup containment', () => {
  it('redacts cleanup failure after an otherwise successful import', async () => {
    await expect(
      openHangulDocument(new Uint8Array([1]), {
        engine: engineFor(new CleanupThrowingDocument()),
      }),
    ).rejects.toMatchObject({
      code: 'ENGINE_CLEANUP_FAILED',
      message: 'The Hangul engine failed during cleanup.',
    });
  });

  it('preserves a primary Inkspan import failure when cleanup also fails', async () => {
    await expect(
      openHangulDocument(new Uint8Array([1]), {
        engine: engineFor(
          new CleanupThrowingDocument(
            '<aside data-private="tenant-secret">sensitive</aside>',
          ),
        ),
      }),
    ).rejects.toEqual(
      new HangulDocumentError(
        'UNSUPPORTED_DOCUMENT_NODE',
        'Hangul import contains an unsupported block node.',
      ),
    );
  });

  it('redacts cleanup failure after an otherwise successful export', async () => {
    const source = new CleanupThrowingDocument();
    const target = new CleanupThrowingDocument();

    await expect(
      exportHangulDocument(
        {
          type: 'doc',
          content: [
            {
              type: 'paragraph',
              content: [{ type: 'text', text: 'safe' }],
            },
          ],
        },
        { engine: engineFor(source, target) },
      ),
    ).rejects.toMatchObject({
      code: 'ENGINE_CLEANUP_FAILED',
      message: 'The Hangul engine failed during cleanup.',
    });
  });
});
