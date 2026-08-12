// @vitest-environment node

import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import { CollaborativeCwlEditor } from './CollaborativeCwlEditor.js';

describe('collaborative editor runtime state contracts', () => {
  it('rejects a non-boolean editable state instead of coercing it into edit authority', () => {
    expect(() =>
      renderToString(
        <CollaborativeCwlEditor
          document={new Y.Doc()}
          editable={'false' as unknown as boolean}
        />,
      ),
    ).toThrowError(
      new RangeError('editor editable state must be a boolean when provided'),
    );
  });

  it('rejects a non-boolean toolbar visibility state instead of coercing it', () => {
    expect(() =>
      renderToString(
        <CollaborativeCwlEditor
          document={new Y.Doc()}
          hideToolbar={'false' as unknown as boolean}
        />,
      ),
    ).toThrowError(
      new RangeError(
        'editor toolbar visibility state must be a boolean when provided',
      ),
    );
  });

  it('preserves omitted and explicit boolean states', () => {
    expect(() =>
      renderToString(<CollaborativeCwlEditor document={new Y.Doc()} />),
    ).not.toThrow();
    expect(() =>
      renderToString(
        <CollaborativeCwlEditor
          document={new Y.Doc()}
          editable
          hideToolbar={false}
        />,
      ),
    ).not.toThrow();
    expect(() =>
      renderToString(
        <CollaborativeCwlEditor
          document={new Y.Doc()}
          editable={false}
          hideToolbar
        />,
      ),
    ).not.toThrow();
  });
});
