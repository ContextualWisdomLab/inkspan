/**
 * Framework-independent public surface for host-supplied writing diagnostics.
 *
 * This subpath validates bounded revision-scoped diagnostic proposals. It does
 * not import React, create editor instances, call models/providers or networks,
 * persist authored content, infer language quality, or mutate a document.
 */
export {
  DEFAULT_WRITING_DIAGNOSTIC_LIMITS,
  WritingDiagnosticError,
  validateWritingDiagnostics,
} from '../writingDiagnostics.js';
export type {
  CwlWritingDiagnostic,
  CwlWritingDiagnosticPriority,
  CwlWritingDiagnosticProvenance,
  WritingDiagnosticErrorCode,
  WritingDiagnosticLimits,
} from '../writingDiagnostics.js';
