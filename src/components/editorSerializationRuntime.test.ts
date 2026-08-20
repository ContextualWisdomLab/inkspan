import { describe, expect, it } from 'vitest';
import {
  editorHtmlToValue,
  editorValueToHtml,
} from './editorSerialization.js';

const INVALID_MODE_ERROR = 'Editor mode must be markdown or html.';

describe('editor serialization runtime mode contract', () => {
  it('rejects an invalid runtime mode before converting a host value', () => {
    expect(() => editorValueToHtml('# Heading', 'md' as never)).toThrowError(
      new RangeError(INVALID_MODE_ERROR),
    );
  });

  it('rejects an invalid runtime mode before converting editor HTML', () => {
    expect(() => editorHtmlToValue('<p>Body</p>', 'rich' as never)).toThrowError(
      new RangeError(INVALID_MODE_ERROR),
    );
  });
});
