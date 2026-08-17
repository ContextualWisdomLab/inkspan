import {
  openHangulDocument,
  type HangulDocumentEngine,
  type HangulEngineDocument,
} from './index.js';

function engineReturning(html: string): HangulDocumentEngine {
  const source: HangulEngineDocument = {
    getSourceFormat: () => 'hwpx',
    getSectionCount: () => 1,
    getParagraphCount: () => 1,
    getParagraphLength: () => 1,
    exportSelectionHtml: () => html,
    deleteText: () => '{"ok":true}',
    pasteHtml: () => '{"ok":true}',
    exportHwp: () => new Uint8Array(),
    exportHwpx: () => new Uint8Array(),
  };
  return {
    id: 'list-import-integrity',
    open: async () => source,
    create: async () => source,
  };
}

describe('Hangul list import integrity', () => {
  it('preserves direct inline list-item content as a paragraph', async () => {
    const result = await openHangulDocument(new Uint8Array([1]), {
      engine: engineReturning(
        '<ul><li>Direct <strong>bold</strong> text</li></ul>',
      ),
    });

    expect(result.documentJson).toEqual({
      type: 'doc',
      content: [
        {
          type: 'bulletList',
          content: [
            {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [
                    { type: 'text', text: 'Direct ' },
                    {
                      type: 'text',
                      text: 'bold',
                      marks: [{ type: 'bold' }],
                    },
                    { type: 'text', text: ' text' },
                  ],
                },
              ],
            },
          ],
        },
      ],
    });
  });

  it('rejects mixed direct text and block list-item content instead of dropping text', async () => {
    const privateText = 'private-direct-content';
    let caught: unknown;

    try {
      await openHangulDocument(new Uint8Array([1]), {
        engine: engineReturning(
          `<ul><li>${privateText}<p>Block</p></li></ul>`,
        ),
      });
    } catch (error) {
      caught = error;
    }

    expect(caught).toMatchObject({
      name: 'HangulDocumentError',
      code: 'UNSUPPORTED_DOCUMENT_NODE',
      message: 'Hangul import contains an unsupported block node.',
    });
    expect((caught as Error).message).not.toContain(privateText);
  });

  it('rejects mixed direct inline elements and block list-item content instead of dropping text', async () => {
    const privateText = 'private-inline-content';
    let caught: unknown;

    try {
      await openHangulDocument(new Uint8Array([1]), {
        engine: engineReturning(
          `<ul><li><strong>${privateText}</strong><p>Block</p></li></ul>`,
        ),
      });
    } catch (error) {
      caught = error;
    }

    expect(caught).toMatchObject({
      name: 'HangulDocumentError',
      code: 'UNSUPPORTED_DOCUMENT_NODE',
      message: 'Hangul import contains an unsupported block node.',
    });
    expect((caught as Error).message).not.toContain(privateText);
  });
});
