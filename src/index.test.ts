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

  it('re-exports the persistence routing surface', () => {
    expect(typeof api.inspectDocumentEnvelopeIdentity).toBe('function');
    expect(typeof api.inspectDocumentEnvelopeIdentityBytes).toBe('function');
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
    expect(api.DEFAULT_HTML_TO_MARKDOWN_MAX_BYTES).toBe(16_777_216);
    expect(api.MAXIMUM_HTML_TO_MARKDOWN_MAX_BYTES).toBe(67_108_864);
    expect(typeof api.HtmlToMarkdownResourceError).toBe('function');
    expect(api.DEFAULT_MARKDOWN_TO_HTML_MAX_BYTES).toBe(16_777_216);
    expect(api.MAXIMUM_MARKDOWN_TO_HTML_MAX_BYTES).toBe(67_108_864);
    expect(typeof api.MarkdownToHtmlResourceError).toBe('function');
  });

  it('re-exports the editor theme token catalog', () => {
    expect(typeof api.listEditorThemeTokens).toBe('function');
    expect(typeof api.getEditorThemeToken).toBe('function');
    expect(typeof api.getEditorThemeTokenContrast).toBe('function');
    expect(typeof api.contrastRatioFromHex).toBe('function');
    expect(api.WCAG_TEXT_CONTRAST_RATIO).toBe(4.5);
    expect(api.WCAG_NON_TEXT_CONTRAST_RATIO).toBe(3);
    expect(typeof api.toDesignTokenFormatGroup).toBe('function');
    expect(typeof api.EditorThemeTokenError).toBe('function');
    expect(typeof api.EditorThemeTokenContrastError).toBe('function');
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
