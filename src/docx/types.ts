/** Binary source accepted by the bounded DOCX importer. */
export type DocxSource = Blob | ArrayBuffer | ArrayBufferView;

/** Framework-neutral TipTap/ProseMirror-compatible mark JSON. */
export interface DocxJsonMark {
  readonly type: string;
  readonly attrs?: Readonly<Record<string, unknown>>;
}

/** Framework-neutral TipTap/ProseMirror-compatible node JSON. */
export interface DocxJsonContent {
  readonly type?: string;
  readonly attrs?: Readonly<Record<string, unknown>>;
  readonly content?: readonly DocxJsonContent[];
  readonly marks?: readonly DocxJsonMark[];
  readonly text?: string;
}

/** Stable, payload-redacted categories reported for lossy but usable imports. */
export type DocxImportWarningCode =
  | 'image_alt_omitted'
  | 'image_omitted'
  | 'hidden_text_omitted'
  | 'list_flattened'
  | 'missing_relationship'
  | 'page_break_flattened'
  | 'table_span_flattened'
  | 'unsafe_hyperlink'
  | 'unsupported_content'
  | 'unsupported_image'
  | 'unsupported_text_formatting';

/** Deduplicated warning whose count discloses no authored content. */
export interface DocxImportWarning {
  readonly code: DocxImportWarningCode;
  readonly count: number;
}

/** Resource limits enforced before or during DOCX package processing. */
export interface DocxImportLimits {
  readonly maxArchiveBytes: number;
  readonly maxEntries: number;
  readonly maxEntryBytes: number;
  readonly maxTotalUncompressedBytes: number;
  readonly maxCompressionRatio: number;
  readonly maxXmlBytes: number;
  readonly maxXmlNodes: number;
  readonly maxXmlDepth: number;
  readonly maxImages: number;
  readonly maxImageBytes: number;
  readonly maxTotalImageBytes: number;
  readonly maxDocumentNodes: number;
}

/** Optional stricter resource profile for one import. */
export interface DocxImportOptions {
  readonly limits?: Partial<DocxImportLimits>;
}

/** Detached result produced before any editor mutation. */
export interface DocxImportResult {
  readonly documentJson: DocxJsonContent;
  readonly warnings: readonly DocxImportWarning[];
}

/** Minimal atomic document target implemented by {@link CwlEditorHandle}. */
export interface DocxDocumentTarget {
  validateDocumentJson(documentJson: DocxJsonContent): boolean;
  setDocumentJson(documentJson: DocxJsonContent): void;
}
