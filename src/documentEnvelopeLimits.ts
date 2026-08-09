/** Optional resource ceilings applied while inspecting an Inkspan document envelope. */
export interface DocumentEnvelopeLimits {
  /** Maximum raw UTF-8 byte length before decoding. */
  readonly maxUtf8Bytes?: number;
  /** Maximum raw JSON-text length measured in JavaScript UTF-16 code units. */
  readonly maxJsonTextCodeUnits?: number;
  /** Maximum total number of scalar and container values in `documentJson`. */
  readonly maxJsonValues?: number;
  /** Maximum length of any decoded string value or object name. */
  readonly maxStringCodeUnits?: number;
  /** Maximum nested object/array depth below the document root. */
  readonly maxNestingDepth?: number;
}
