import { describe, expect, it, vi } from 'vitest';

import { createDocx } from '../../test/docxFixture.js';
import { openDocx } from './index.js';

describe('DOCX public error normalization', () => {
  it('redacts hostile callback failures without inspecting the thrown prototype', async () => {
    const privateSentinel = new Error('private prototype sentinel');
    const getPrototypeOf = vi.fn(() => {
      throw privateSentinel;
    });
    const hostileThrownValue = new Proxy(Object.create(null) as object, {
      getPrototypeOf,
    });
    const setDocumentJson = vi.fn(() => undefined);

    const operation = openDocx(
      {
        validateDocumentJson() {
          throw hostileThrownValue;
        },
        setDocumentJson,
      },
      createDocx(),
    );

    await expect(operation).rejects.toMatchObject({
      name: 'DocxImportError',
      code: 'editor_rejected_document',
      message: 'The editor rejected the imported DOCX document.',
    });
    expect(getPrototypeOf).not.toHaveBeenCalled();
    expect(setDocumentJson).not.toHaveBeenCalled();
  });
});
