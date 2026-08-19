export {
  DocxImportError,
  type DocxImportErrorCode,
} from './errors.js';
export { DEFAULT_DOCX_IMPORT_LIMITS } from './limits.js';
export { importDocx, openDocx } from './importDocx.js';
export type {
  DocxDocumentTarget,
  DocxImportLimits,
  DocxImportOptions,
  DocxImportResult,
  DocxImportWarning,
  DocxImportWarningCode,
  DocxJsonContent,
  DocxJsonMark,
  DocxSource,
} from './types.js';
