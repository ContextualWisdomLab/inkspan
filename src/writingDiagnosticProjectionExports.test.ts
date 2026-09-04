import { describe, expect, it } from 'vitest';
import * as rootSurface from './index.js';
import * as subpathSurface from './text-position-selector/index.js';
import {
  WritingDiagnosticProjectionError,
  buildTextProjectionMap,
  resolveTextPositionSelector,
  type CwlWritingDiagnosticTextProjectionMap,
  type WritingDiagnosticProjectionErrorCode,
} from './writingDiagnosticProjection.js';
import type {
  CwlWritingDiagnosticTextProjectionMap as RootProjectionMap,
  WritingDiagnosticProjectionErrorCode as RootProjectionErrorCode,
} from './index.js';
import type {
  CwlWritingDiagnosticTextProjectionMap as SubpathProjectionMap,
  WritingDiagnosticProjectionErrorCode as SubpathProjectionErrorCode,
} from './text-position-selector/index.js';

type Exact<A, B> =
  (<T>() => T extends A ? 1 : 2) extends
  (<T>() => T extends B ? 1 : 2)
    ? (<T>() => T extends B ? 1 : 2) extends
        (<T>() => T extends A ? 1 : 2)
      ? true
      : false
    : false;

const rootTypes: readonly true[] = [
  true as Exact<RootProjectionMap, CwlWritingDiagnosticTextProjectionMap>,
  true as Exact<RootProjectionErrorCode, WritingDiagnosticProjectionErrorCode>,
];
const subpathTypes: readonly true[] = [
  true as Exact<SubpathProjectionMap, CwlWritingDiagnosticTextProjectionMap>,
  true as Exact<SubpathProjectionErrorCode, WritingDiagnosticProjectionErrorCode>,
];

describe('inverse projection public source exports', () => {
  it('re-exports the exact runtime and type contract from the root surface', () => {
    expect(rootSurface.WritingDiagnosticProjectionError).toBe(
      WritingDiagnosticProjectionError,
    );
    expect(rootSurface.buildTextProjectionMap).toBe(buildTextProjectionMap);
    expect(rootSurface.resolveTextPositionSelector).toBe(resolveTextPositionSelector);
    expect(rootTypes).toEqual([true, true]);
  });

  it('re-exports the same framework-independent contract from the selector subpath', () => {
    expect(subpathSurface.WritingDiagnosticProjectionError).toBe(
      WritingDiagnosticProjectionError,
    );
    expect(subpathSurface.buildTextProjectionMap).toBe(buildTextProjectionMap);
    expect(subpathSurface.resolveTextPositionSelector).toBe(
      resolveTextPositionSelector,
    );
    expect(subpathTypes).toEqual([true, true]);
  });
});
