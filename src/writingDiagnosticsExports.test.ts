import { describe, expect, it } from 'vitest';
import * as rootSurface from './index.js';
import * as subpathSurface from './writing-diagnostics/index.js';
import {
  DEFAULT_WRITING_DIAGNOSTIC_LIMITS,
  WritingDiagnosticError,
  validateWritingDiagnostics,
  type CwlWritingDiagnostic,
  type CwlWritingDiagnosticPriority,
  type CwlWritingDiagnosticProvenance,
  type WritingDiagnosticErrorCode,
  type WritingDiagnosticLimits,
} from './writingDiagnostics.js';
import type {
  CwlWritingDiagnostic as RootDiagnostic,
  CwlWritingDiagnosticPriority as RootPriority,
  CwlWritingDiagnosticProvenance as RootProvenance,
  WritingDiagnosticErrorCode as RootErrorCode,
  WritingDiagnosticLimits as RootLimits,
} from './index.js';
import type {
  CwlWritingDiagnostic as SubpathDiagnostic,
  CwlWritingDiagnosticPriority as SubpathPriority,
  CwlWritingDiagnosticProvenance as SubpathProvenance,
  WritingDiagnosticErrorCode as SubpathErrorCode,
  WritingDiagnosticLimits as SubpathLimits,
} from './writing-diagnostics/index.js';

type Exact<A, B> =
  (<T>() => T extends A ? 1 : 2) extends
  (<T>() => T extends B ? 1 : 2)
    ? (<T>() => T extends B ? 1 : 2) extends
        (<T>() => T extends A ? 1 : 2)
      ? true
      : false
    : false;

const rootTypeContract: readonly true[] = [
  true as Exact<RootDiagnostic, CwlWritingDiagnostic>,
  true as Exact<RootPriority, CwlWritingDiagnosticPriority>,
  true as Exact<RootProvenance, CwlWritingDiagnosticProvenance>,
  true as Exact<RootErrorCode, WritingDiagnosticErrorCode>,
  true as Exact<RootLimits, WritingDiagnosticLimits>,
];
const subpathTypeContract: readonly true[] = [
  true as Exact<SubpathDiagnostic, CwlWritingDiagnostic>,
  true as Exact<SubpathPriority, CwlWritingDiagnosticPriority>,
  true as Exact<SubpathProvenance, CwlWritingDiagnosticProvenance>,
  true as Exact<SubpathErrorCode, WritingDiagnosticErrorCode>,
  true as Exact<SubpathLimits, WritingDiagnosticLimits>,
];

describe('writing diagnostic public source exports', () => {
  it('re-exports one identical runtime contract from the root surface', () => {
    expect(rootSurface.DEFAULT_WRITING_DIAGNOSTIC_LIMITS).toBe(
      DEFAULT_WRITING_DIAGNOSTIC_LIMITS,
    );
    expect(rootSurface.WritingDiagnosticError).toBe(WritingDiagnosticError);
    expect(rootSurface.validateWritingDiagnostics).toBe(
      validateWritingDiagnostics,
    );
    expect(rootTypeContract).toEqual([true, true, true, true, true]);
  });

  it('exposes the same framework-independent contract from the subpath', () => {
    expect(subpathSurface.DEFAULT_WRITING_DIAGNOSTIC_LIMITS).toBe(
      DEFAULT_WRITING_DIAGNOSTIC_LIMITS,
    );
    expect(subpathSurface.WritingDiagnosticError).toBe(WritingDiagnosticError);
    expect(subpathSurface.validateWritingDiagnostics).toBe(
      validateWritingDiagnostics,
    );
    expect(subpathTypeContract).toEqual([true, true, true, true, true]);
  });
});
