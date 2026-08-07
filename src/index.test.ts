import { describe, it, expect } from 'vitest';
import * as api from './index.js';

/**
 * The public entry point is a barrel of re-exports. Importing it executes every
 * `export … from …` statement, which is both a smoke test that the surface is
 * wired up and the coverage for the barrel itself.
 */
describe('package entry point', () => {
  it('re-exports the React component surface', () => {
    // forwardRef components are objects ($$typeof) in React 18+, not bare functions.
    expect(api.CwlEditor).toBeTruthy();
    expect(
      typeof api.CwlEditor === 'function' || typeof api.CwlEditor === 'object',
    ).toBe(true);
    // `default as Editor` alias resolves to the CwlEditor component.
    expect(api.Editor).toBe(api.CwlEditor);
    expect(typeof api.Toolbar).toBe('function');
  });

  it('re-exports the headless extensions', () => {
    expect(api.Base64Image).toBeTruthy();
    expect(api.base64ImagePluginKey).toBeTruthy();
    expect(typeof api.downscaleDataUri).toBe('function');
    expect(typeof api.imageFileToInlineDataUri).toBe('function');
    expect(api.SafeClipboard).toBeTruthy();
    expect(api.safeClipboardPluginKey).toBeTruthy();
    expect(typeof api.ClipboardSanitizationError).toBe('function');
    expect(typeof api.sanitizeRichClipboardHtml).toBe('function');
    expect(api.SafeLink).toBeTruthy();
    expect(api.safeLinkPluginKey).toBeTruthy();
    expect(typeof api.SafeLinkHrefError).toBe('function');
    expect(typeof api.isSafeLinkHref).toBe('function');
    expect(typeof api.validateSafeLinkHref).toBe('function');
    expect(typeof api.buildExtensions).toBe('function');
  });

  it('re-exports the markdown/html serializer', () => {
    expect(typeof api.markdownToHtml).toBe('function');
    expect(typeof api.htmlToMarkdown).toBe('function');
    expect(typeof api.normalizeMarkdown).toBe('function');
    expect(typeof api.markdownToEmailHtml).toBe('function');
    expect(typeof api.markdownToPlainText).toBe('function');
    expect(typeof api.htmlToPlainText).toBe('function');
  });

  it('re-exports the standalone base64 converter', () => {
    expect(typeof api.bytesToBase64).toBe('function');
    expect(typeof api.base64ToBytes).toBe('function');
    expect(typeof api.fileToDataUri).toBe('function');
    expect(typeof api.dataUriToBytes).toBe('function');
    expect(typeof api.Base64SizeError).toBe('function');
    expect(typeof api.DataUriParseError).toBe('function');
  });
});
