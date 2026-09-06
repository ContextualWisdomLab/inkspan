// @vitest-environment node

import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CwlEditor } from './CwlEditor.js';

describe('standalone editor editable runtime contract', () => {
  it('rejects a non-boolean editable state instead of coercing it into edit authority', () => {
    expect(() =>
      renderToString(
        <CwlEditor editable={'false' as unknown as boolean} />,
      ),
    ).toThrowError(
      new RangeError('editor editable state must be a boolean when provided'),
    );
  });

  it('preserves omitted, explicitly editable, and explicitly read-only states', () => {
    expect(() => renderToString(<CwlEditor />)).not.toThrow();
    expect(() => renderToString(<CwlEditor editable />)).not.toThrow();
    expect(() => renderToString(<CwlEditor editable={false} />)).not.toThrow();
  });
});
