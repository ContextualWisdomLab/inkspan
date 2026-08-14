import {
  HangulDocumentError,
  exportHangulDocument,
  type HangulDocumentEngine,
} from './index.js';

const engine: HangulDocumentEngine = {
  id: 'diagnostic-privacy-test',
  open: async () => {
    throw new Error('open should not be reached');
  },
  create: async () => {
    throw new Error('create should not be reached');
  },
};

async function captureExportError(
  documentJson: Parameters<typeof exportHangulDocument>[0],
): Promise<HangulDocumentError> {
  try {
    await exportHangulDocument(documentJson, { engine });
  } catch (error) {
    expect(error).toBeInstanceOf(HangulDocumentError);
    return error as HangulDocumentError;
  }
  throw new Error('expected Hangul export to reject unsupported content');
}

describe('Hangul export diagnostic privacy', () => {
  it('does not reflect an unsupported caller-controlled block type', async () => {
    const privateBlockType = 'customer-secret-block';
    const error = await captureExportError({
      type: 'doc',
      content: [{ type: privateBlockType }],
    });

    expect(error.code).toBe('UNSUPPORTED_DOCUMENT_NODE');
    expect(error.message).not.toContain(privateBlockType);
  });

  it('does not reflect an unsupported caller-controlled mark type', async () => {
    const privateMarkType = 'customer-secret-mark';
    const error = await captureExportError({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'x',
              marks: [{ type: privateMarkType }],
            },
          ],
        },
      ],
    });

    expect(error.code).toBe('UNSUPPORTED_DOCUMENT_MARK');
    expect(error.message).not.toContain(privateMarkType);
  });
});
