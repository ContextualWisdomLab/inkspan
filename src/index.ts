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

// Register editor-only imperative-handle type augmentations without coupling the
// framework-independent revision-evidence subpath to the interactive graph.
import './documentRevisionEvidenceHandle.js';
import './textPositionSelectorEvidenceHandle.js';

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
  CwlEditorSelectionRevisionEvidence,
  CwlEditorSelectionSnapshot,
  EditorMode,
  EditorTextDirection,
  ImageConfig,
} from './types.js';
export type { CwlEditorDocumentRevisionEvidenceCapture } from './documentRevisionEvidenceHandle.js';
export type { CwlEditorTextPositionSelectorEvidenceCapture } from './textPositionSelectorEvidenceHandle.js';
export {
  TEXT_POSITION_PROJECTION_ID,
  TEXT_POSITION_PROJECTION_VERSION,
  TextPositionSelectorEvidenceError,
  createTextPositionSelector,
} from './textPositionSelectorEvidence.js';
export type {
  CwlEditorTextPositionSelector,
  CwlEditorTextPositionSelectorEvidence,
  CwlEditorTextProjectionIdentity,
  TextPositionSelectorEvidenceErrorCode,
} from './textPositionSelectorEvidence.js';

// Versioned, lossless persistence boundary.
export {
  DEFAULT_DOCUMENT_ENVELOPE_LIMITS,
  DOCUMENT_ENVELOPE_SCHEMA_ID,
  DOCUMENT_ENVELOPE_SCHEMA_VERSION,
  DocumentEnvelopeError,
  createDocumentEnvelope,
  parseDocumentEnvelope,
  parseDocumentEnvelopeBytes,
} from './documentEnvelope.js';
export type {
  CwlEditorDocumentEnvelope,
  DocumentEnvelopeLimits,
} from './documentEnvelope.js';
export {
  inspectDocumentEnvelopeIdentity,
  inspectDocumentEnvelopeIdentityBytes,
} from './documentEnvelopeIdentity.js';
export type { CwlEditorDocumentEnvelopeIdentity } from './documentEnvelopeIdentity.js';
export {
  encodeDocumentEnvelope,
  serializeDocumentEnvelope,
} from './documentEnvelopeCanonical.js';
export {
  restoreDocumentEnvelopeBytesIfMatch,
  restoreDocumentEnvelopeIfMatch,
} from './documentEnvelopeIfMatch.js';
export type { CwlEditorIfMatchRestoreResult } from './documentEnvelopeIfMatch.js';
export {
  DocumentEnvelopeRevisionError,
  createDocumentEnvelopeRevision,
  createDocumentEnvelopeRevisionBytes,
} from './documentEnvelopeRevision.js';
export type {
  CwlEditorDocumentRevision,
  DocumentEnvelopeDigestProvider,
} from './documentEnvelopeRevision.js';
export {
  createDocumentEnvelopeRevisionEvidence,
  createDocumentEnvelopeRevisionEvidenceBytes,
} from './documentRevisionEvidence.js';
export type { CwlEditorDocumentRevisionEvidence } from './documentRevisionEvidence.js';
export {
  DOCUMENT_TRANSITION_EVIDENCE_SCHEMA_ID,
  DOCUMENT_TRANSITION_EVIDENCE_SCHEMA_VERSION,
  createDocumentEnvelopeTransitionEvidence,
  createDocumentEnvelopeTransitionEvidenceBytes,
} from './documentTransitionEvidence.js';
export type { CwlEditorDocumentTransitionEvidence } from './documentTransitionEvidence.js';
export {
  DocumentEnvelopeRestoreError,
  restoreDocumentEnvelope,
  restoreDocumentEnvelopeBytes,
  validateDocumentEnvelopeBytesForEditor,
  validateDocumentEnvelopeForEditor,
} from './documentEnvelopeRestore.js';

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
  ClipboardSanitizationError,
  DEFAULT_CLIPBOARD_HTML_BYTES,
  DEFAULT_CLIPBOARD_MAX_DEPTH,
  DEFAULT_CLIPBOARD_MAX_NODES,
  sanitizeRichClipboardHtml,
} from './extensions/SafeClipboard.js';
export type {
  ClipboardConfig,
  ClipboardSanitizationErrorCode,
} from './extensions/SafeClipboard.js';
export {
  SafeClipboard,
  safeClipboardPluginKey,
} from './extensions/SafeClipboardExtension.js';
export type { SafeClipboardOptions } from './extensions/SafeClipboardExtension.js';
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
export { htmlToMarkdown } from './markdown/serializer.js';
export type { HtmlToMarkdownOptions } from './markdown/serializer.js';
export {
  markdownToEmailHtml,
  markdownToHtml,
  normalizeMarkdown,
} from './markdown/resourceBoundMarkdown.js';
export type {
  MarkdownToEmailHtmlOptions,
  MarkdownToHtmlOptions,
  NormalizeMarkdownOptions,
} from './markdown/resourceBoundMarkdown.js';
export {
  DEFAULT_HTML_TO_MARKDOWN_MAX_BYTES,
  MAXIMUM_HTML_TO_MARKDOWN_MAX_BYTES,
  HtmlToMarkdownResourceError,
} from './markdown/htmlToMarkdownResourcePolicy.js';
export type { HtmlToMarkdownResourceErrorCode } from './markdown/htmlToMarkdownResourcePolicy.js';
export {
  DEFAULT_MARKDOWN_TO_HTML_MAX_BYTES,
  MAXIMUM_MARKDOWN_TO_HTML_MAX_BYTES,
  MarkdownToHtmlResourceError,
} from './markdown/markdownToHtmlResourcePolicy.js';
export type { MarkdownToHtmlResourceErrorCode } from './markdown/markdownToHtmlResourcePolicy.js';

// Deterministic Markdown/HTML -> plain-text projection for AI/indexing paths.
export {
  htmlToPlainText,
  markdownToPlainText,
} from './markdown/plainText.js';
export type { PlainTextOptions } from './markdown/plainText.js';

// Standalone, framework-agnostic base64 / data-URI converter.
export * from './converter/index.js';
export {
  Base64ImageSourceError,
  validateInlineImageSource,
} from './extensions/Base64Image.js';
