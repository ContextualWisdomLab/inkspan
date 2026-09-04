/**
 * Standalone, framework-agnostic base64 / data-URI converter entry point.
 *
 * Import this module on its own (no React, no TipTap) when you only need the
 * conversion utilities:
 *
 * ```ts
 * import { fileToDataUri, dataUriToBytes } from '@contextualwisdomlab/cwl-editor/converter';
 * ```
 */
export {
  Base64SizeError,
  Base64ParseError,
  DataUriParseError,
  bytesToBase64,
  base64ToBytes,
  toUint8Array,
  sniffMimeType,
  bytesToDataUri,
  arrayBufferToDataUri,
  blobToDataUri,
  fileToDataUri,
  parseDataUri,
  isDataUri,
  dataUriToBytes,
  dataUriToBlob,
  dataUriByteLength,
} from './base64.js';

export type {
  EncodeOptions,
  ParsedDataUri,
  DecodedDataUri,
} from './base64.js';
