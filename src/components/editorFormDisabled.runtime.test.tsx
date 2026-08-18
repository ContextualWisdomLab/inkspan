// @vitest-environment node

import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CwlEditor } from './CwlEditor.js';

describe('native form disabled runtime contract', () => {
  it('rejects a non-boolean disabled state instead of coercing it into submission omission', () => {
    expect(() =>
      renderToString(
        <CwlEditor
          formFieldName="document"
          formFieldDisabled={'false' as unknown as boolean}
        />,
      ),
    ).toThrowError(
      new RangeError(
        'native form field disabled state must be a boolean when provided',
      ),
    );
  });

  it('preserves explicit enabled and disabled native form states', () => {
    const enabled = renderToString(
      <CwlEditor formFieldName="document" formFieldDisabled={false} />,
    );
    const disabled = renderToString(
      <CwlEditor formFieldName="document" formFieldDisabled />,
    );

    expect(enabled).toContain('name="document"');
    expect(enabled).not.toContain('disabled=""');
    expect(disabled).toContain('name="document"');
    expect(disabled).toContain('disabled=""');
  });
});
