// @vitest-environment node

import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CwlEditor } from './CwlEditor.js';

const MAX_FORM_IDENTITY_CODE_UNITS = 65_536;

describe('native form identity runtime contract', () => {
  it('rejects a non-string field name before React can coerce submission identity', () => {
    expect(() =>
      renderToString(
        <CwlEditor formFieldName={42 as unknown as string} />,
      ),
    ).toThrowError(
      new RangeError(
        'native form field name must be a string when provided',
      ),
    );
  });

  it('rejects a non-string external form id before React can coerce association', () => {
    expect(() =>
      renderToString(
        <CwlEditor
          formFieldName="document"
          formId={42 as unknown as string}
        />,
      ),
    ).toThrowError(
      new RangeError(
        'native form id must be a string when provided',
      ),
    );
  });

  it('rejects oversized field names before hidden-field serialization', () => {
    const oversizedName = 'n'.repeat(MAX_FORM_IDENTITY_CODE_UNITS + 1);

    expect(() =>
      renderToString(<CwlEditor formFieldName={oversizedName} />),
    ).toThrowError(
      new RangeError(
        'native form field name must not exceed 65536 UTF-16 code units',
      ),
    );
  });

  it('rejects oversized external form ids before hidden-field serialization', () => {
    const oversizedFormId = 'f'.repeat(MAX_FORM_IDENTITY_CODE_UNITS + 1);

    expect(() =>
      renderToString(
        <CwlEditor formFieldName="document" formId={oversizedFormId} />,
      ),
    ).toThrowError(
      new RangeError(
        'native form id must not exceed 65536 UTF-16 code units',
      ),
    );
  });

  it('preserves empty and ordinary string identities without normalization', () => {
    const empty = renderToString(<CwlEditor formFieldName="" formId="" />);
    const ordinary = renderToString(
      <CwlEditor formFieldName="document.body" formId="compose-form" />,
    );

    expect(empty).toContain('name=""');
    expect(empty).toContain('form=""');
    expect(ordinary).toContain('name="document.body"');
    expect(ordinary).toContain('form="compose-form"');
  });
});
