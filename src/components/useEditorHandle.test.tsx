import { render } from '@testing-library/react';
import {
  createRef,
  forwardRef,
  useRef,
  type MutableRefObject,
} from 'react';
import { describe, expect, it } from 'vitest';
import type { CwlEditorHandle, EditorMode } from '../types.js';
import { useEditorHandle } from './useEditorHandle.js';

const EmptyEditorHandle = forwardRef<CwlEditorHandle>(function EmptyEditorHandle(
  _props,
  ref,
) {
  const modeRef = useRef<EditorMode>('markdown') as MutableRefObject<EditorMode>;
  useEditorHandle(ref, null, modeRef);
  return null;
});

describe('useEditorHandle', () => {
  it('provides safe no-op and empty fallbacks before an editor exists', () => {
    const editorRef = createRef<CwlEditorHandle>();
    render(<EmptyEditorHandle ref={editorRef} />);
    const handle = editorRef.current!;

    expect(handle.getEditor()).toBeNull();
    expect(() => handle.focus()).not.toThrow();
    expect(() => handle.blur()).not.toThrow();
    expect(handle.getValue()).toBe('');
    expect(handle.getHTML()).toBe('');
    expect(handle.getMarkdown()).toBe('');
    expect(handle.getSnapshot()).toEqual({
      mode: 'markdown',
      value: '',
      html: '',
      markdown: '',
      plainText: '',
      documentJson: null,
      isEmpty: true,
    });
    expect(Object.isFrozen(handle.getSnapshot())).toBe(true);
    expect(() => handle.setValue('ignored')).not.toThrow();
    expect(() => handle.insertValue('ignored')).not.toThrow();
    expect(() => handle.clear()).not.toThrow();
    expect(handle.isEmpty()).toBe(true);
  });
});
