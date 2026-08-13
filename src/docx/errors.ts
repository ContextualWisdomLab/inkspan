/** Stable machine-readable DOCX import failure categories. */
export type DocxImportErrorCode =
  | 'archive_limit_exceeded'
  | 'decompression_unavailable'
  | 'document_limit_exceeded'
  | 'editor_rejected_document'
  | 'encrypted_archive'
  | 'incompatible_editor_schema'
  | 'input_too_large'
  | 'invalid_configuration'
  | 'invalid_docx'
  | 'invalid_source'
  | 'invalid_xml'
  | 'invalid_zip'
  | 'unsupported_archive';

const ERROR_MESSAGES: Readonly<Record<DocxImportErrorCode, string>> =
  Object.freeze({
    archive_limit_exceeded:
      'The DOCX package exceeds the supported archive resource limits.',
    decompression_unavailable:
      'The current runtime cannot decompress this DOCX package.',
    document_limit_exceeded:
      'The imported DOCX exceeds the supported document resource limits.',
    editor_rejected_document:
      'The editor rejected the imported DOCX document.',
    encrypted_archive: 'Encrypted DOCX packages are not supported.',
    incompatible_editor_schema:
      'The imported DOCX is incompatible with the active editor schema.',
    input_too_large: 'The DOCX source exceeds the supported byte limit.',
    invalid_configuration: 'DOCX import configuration is invalid.',
    invalid_docx: 'The source is not a supported DOCX document.',
    invalid_source: 'DOCX input must be a supported binary source.',
    invalid_xml: 'The DOCX package contains invalid XML.',
    invalid_zip: 'The DOCX package contains an invalid ZIP archive.',
    unsupported_archive:
      'The DOCX package uses an unsupported ZIP archive feature.',
  });

/** Payload-redacted error thrown by every public DOCX import failure. */
export class DocxImportError extends Error {
  /** Stable failure category safe for host telemetry. */
  readonly code: DocxImportErrorCode;

  /** Create one stable DOCX import error. */
  constructor(code: DocxImportErrorCode) {
    super(ERROR_MESSAGES[code]);
    this.name = 'DocxImportError';
    this.code = code;
  }
}

/** Preserve one already-redacted error or replace an unknown failure. */
export function normalizeDocxImportError(
  error: unknown,
  fallback: DocxImportErrorCode,
): DocxImportError {
  return error instanceof DocxImportError
    ? error
    : new DocxImportError(fallback);
}
