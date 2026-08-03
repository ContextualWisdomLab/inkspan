import { useEffect, useRef, type MutableRefObject } from 'react';

/**
 * Keep the latest committed value behind a stable ref without mutating shared
 * observable state during React render.
 */
export function useLatestRef<T>(value: T): MutableRefObject<T> {
  const valueRef = useRef(value);
  useEffect(() => {
    valueRef.current = value;
  }, [value]);
  return valueRef;
}
