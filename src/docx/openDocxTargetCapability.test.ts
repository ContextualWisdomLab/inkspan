import { describe, expect, it, vi } from 'vitest';
import { createDocx } from '../../test/docxFixture.js';
import { openDocx, type DocxDocumentTarget, type DocxJsonContent } from './index.js';

describe('openDocx host capability acquisition', () => {
  it('captures each editor capability once before validation and mutation', async () => {
    const privateValidateFailure = { secret: 'second-validate-read' };
    const privateSetFailure = { secret: 'second-set-read' };
    const validateDocumentJson = vi.fn(
      (documentJson: DocxJsonContent) => documentJson.type === 'doc',
    );
    const setDocumentJson = vi.fn((_documentJson: DocxJsonContent) => undefined);
    let validateReads = 0;
    let setReads = 0;
    const target = {} as DocxDocumentTarget;

    Object.defineProperties(target, {
      validateDocumentJson: {
        configurable: true,
        get() {
          validateReads += 1;
          if (validateReads > 1) throw privateValidateFailure;
          return validateDocumentJson;
        },
      },
      setDocumentJson: {
        configurable: true,
        get() {
          setReads += 1;
          if (setReads > 1) throw privateSetFailure;
          return setDocumentJson;
        },
      },
    });

    const result = await openDocx(target, createDocx());

    expect(result.documentJson.type).toBe('doc');
    expect(validateReads).toBe(1);
    expect(setReads).toBe(1);
    expect(validateDocumentJson).toHaveBeenCalledTimes(1);
    expect(setDocumentJson).toHaveBeenCalledTimes(1);
    expect(setDocumentJson).toHaveBeenCalledWith(result.documentJson);
  });
});
