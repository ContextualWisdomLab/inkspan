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
  CwlEditorDocumentChangeEvent,
  CwlEditorDocumentSnapshot,
  CwlEditorFocusEvent,
  CwlEditorFormResetEvent,
  CwlEditorHandle,
  CwlEditorProps,
  CwlEditorSelectionEvent,
  CwlEditorSelectionSnapshot,
  EditorMode,
  EditorTextDirection,
  ImageConfig,
} from './types.js';

// Versioned, lossless persistence boundary.
export {
  DOCUMENT_ENVELOPE_SCHEMA_ID,
  DOCUMENT_ENVELOPE_SCHEMA_VERSION,
  DocumentEnvelopeError,
  createDocumentEnvelope,
  parseDocumentEnvelope,
} from './documentEnvelope.js';
export type { CwlEditorDocumentEnvelope } from './documentEnvelope.js';
export {
  encodeDocumentEnvelope,
  serializeDocumentEnvelope,
} from './documentEnvelopeCanonical.js';

// Active-schema validation for atomic structural restore.
export {
  DocumentSchemaError,
  validateDocumentJson,
} from './documentSchema.js';

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
