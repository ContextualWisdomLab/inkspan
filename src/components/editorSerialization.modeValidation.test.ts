import { describe, expect, it } from 'vitest';
import type { EditorMode } from '../types.js';
import {
  editorHtmlToValue,
  editorValueToHtml,
} from './editorSerialization.js';

const invalidMode = 'md' as unknown as EditorMode;
const invalidModeError = 'editor mode must be "markdown" or "html"';

describe('editor serialization runtime mode validation', () => {
  it('rejects an invalid runtime mode before host value conversion', () => {
    expect(() => editorValueToHtml('# Heading', invalidMode)).toThrowError(
      new RangeError(invalidModeError),
    );
  });

  it('rejects an invalid runtime mode before editor HTML conversion', () => {
    expect(() => editorHtmlToValue('<p>Heading</p>', invalidMode)).toThrowError(
      new RangeError(invalidModeError),
    );
  });
});
