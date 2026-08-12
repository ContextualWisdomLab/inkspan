/**
 * Framework-independent public surface for host-supplied writing diagnostics.
 *
 * This subpath validates bounded revision-scoped diagnostic proposals and maps
 * exact W3C text-position selectors to structural ProseMirror ranges. It does
 * not import a UI framework, create editor instances, call models, providers,
 * or networks, persist authored content, infer language quality, or mutate a
 * document.
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
export {
  WritingDiagnosticProjectionError,
  buildTextProjectionMap,
  resolveTextPositionSelector,
} from '../writingDiagnosticProjection.js';
export type {
  CwlWritingDiagnosticTextProjectionMap,
  WritingDiagnosticProjectionErrorCode,
} from '../writingDiagnosticProjection.js';
export {
  TEXT_POSITION_PROJECTION_ID,
  TEXT_POSITION_PROJECTION_VERSION,
  TextPositionSelectorEvidenceError,
} from '../textPositionSelectorEvidence.js';
export type {
  CwlEditorTextPositionSelector,
  CwlEditorTextPositionSelectorEvidence,
  CwlEditorTextProjectionIdentity,
  TextPositionSelectorEvidenceErrorCode,
} from '../textPositionSelectorEvidence.js';
