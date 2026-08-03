import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useLatestRef } from './useLatestRef.js';

describe('useLatestRef', () => {
  it('keeps one ref and advances it to the latest committed value', () => {
    const { result, rerender } = renderHook(
      ({ value }: { value: string }) => useLatestRef(value),
      { initialProps: { value: 'first' } },
    );
    const stableRef = result.current;

    rerender({ value: 'second' });

    expect(result.current).toBe(stableRef);
    expect(result.current.current).toBe('second');
  });
});
