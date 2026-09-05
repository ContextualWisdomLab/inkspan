// @vitest-environment node

import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CwlEditor } from './CwlEditor.js';

describe('standalone editor toolbar visibility runtime contract', () => {
  it('rejects a non-boolean toolbar visibility state instead of coercing it', () => {
    expect(() =>
      renderToString(
        <CwlEditor hideToolbar={'false' as unknown as boolean} />,
      ),
    ).toThrowError(
      new RangeError(
        'editor toolbar visibility state must be a boolean when provided',
      ),
    );
  });

  it('preserves omitted, visible, and hidden toolbar states', () => {
    expect(() => renderToString(<CwlEditor />)).not.toThrow();
    expect(() => renderToString(<CwlEditor hideToolbar={false} />)).not.toThrow();
    expect(() => renderToString(<CwlEditor hideToolbar />)).not.toThrow();
  });
});
