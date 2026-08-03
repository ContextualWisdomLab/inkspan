/**
 * @contextualwisdomlab/cwl-editor
 *
 * Commercial-grade Markdown + HTML WYSIWYG editor built on TipTap v2
 * (ProseMirror, MIT), with inline base64 images and a standalone base64
 * converter.
 *
 * Import the stylesheet once in your app:
 * ```ts
 * import '@contextualwisdomlab/cwl-editor/styles.css';
 * ```
 */

// React component surface.
export { CwlEditor, default as Editor } from './components/CwlEditor.js';
export { Toolbar } from './components/Toolbar.js';

// Types.
export type {
  CwlEditorHandle,
  CwlEditorProps,
  EditorMode,
  ImageConfig,
} from './types.js';

// Extensions (reusable headlessly).
export {
  Base64Image,
  base64ImagePluginKey,
  downscaleDataUri,
  imageFileToInlineDataUri,
} from './extensions/Base64Image.js';
export type { Base64ImageOptions } from './extensions/Base64Image.js';
export {
  SafeLink,
  SafeLinkHrefError,
  isSafeLinkHref,
  safeLinkPluginKey,
  validateSafeLinkHref,
} from './extensions/SafeLink.js';
export { buildExtensions } from './extensions/kit.js';
export type { BuildExtensionsOptions } from './extensions/kit.js';

// Markdown <-> HTML serialization (base64 image round-trip safe).
export {
  markdownToHtml,
  htmlToMarkdown,
  normalizeMarkdown,
  markdownToEmailHtml,
} from './markdown/serializer.js';
export type {
  HtmlToMarkdownOptions,
  MarkdownToEmailHtmlOptions,
} from './markdown/serializer.js';

// Deterministic Markdown/HTML -> plain-text projection for AI/indexing paths.
export {
  htmlToPlainText,
  markdownToPlainText,
} from './markdown/plainText.js';
export type { PlainTextOptions } from './markdown/plainText.js';

// Standalone, framework-agnostic base64 / data-URI converter.
export * from './converter/index.js';
export { Base64ImageSourceError, validateInlineImageSource } from './extensions/Base64Image.js';
