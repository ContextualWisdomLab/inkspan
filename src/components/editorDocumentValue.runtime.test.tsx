// @vitest-environment node

import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CwlEditor } from './CwlEditor.js';

describe('standalone editor document value runtime contract', () => {
  it('rejects a defined non-string controlled value before serialization', () => {
    expect(() =>
      renderToString(<CwlEditor value={42 as unknown as string} />),
    ).toThrowError(
      new RangeError('editor value must be a string when provided'),
    );
  });

  it('rejects a defined non-string default value before serialization', () => {
    expect(() =>
      renderToString(<CwlEditor defaultValue={{} as unknown as string} />),
    ).toThrowError(
      new RangeError('editor default value must be a string when provided'),
    );
  });

  it('rejects a defined non-string native-form reset document before wiring', () => {
    expect(() =>
      renderToString(
        <CwlEditor formResetValue={42 as unknown as string} />,
      ),
    ).toThrowError(
      new RangeError(
        'editor form reset value must be a string when provided',
      ),
    );
  });

  it('preserves controlled precedence and exact empty or Unicode strings', () => {
    expect(() =>
      renderToString(
        <CwlEditor value="" defaultValue="ignored default" />,
      ),
    ).not.toThrow();
    expect(() =>
      renderToString(
        <CwlEditor
          defaultValue="# 안녕하세요 👋"
          formResetValue="복원할 문서 🧾"
        />,
      ),
    ).not.toThrow();
  });
});
