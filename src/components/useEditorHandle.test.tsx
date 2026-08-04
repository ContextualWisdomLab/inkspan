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
  it('provides safe no-op and empty fallbacks before an editor exists', async () => {
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
    expect(handle.getDocumentEnvelope()).toBeNull();
    expect(handle.getDocumentEnvelopeJson()).toBe('');
    expect(handle.getDocumentEnvelopeBytes()).toEqual(new Uint8Array());
    await expect(handle.getDocumentEnvelopeRevision()).resolves.toBeNull();
    expect(handle.validateDocumentEnvelope({})).toBe(false);
    expect(handle.validateDocumentEnvelopeBytes(new Uint8Array())).toBe(false);
    expect(handle.restoreDocumentEnvelope({})).toBeNull();
    expect(handle.restoreDocumentEnvelopeBytes(new Uint8Array())).toBeNull();
    expect(() => handle.setValue('ignored')).not.toThrow();
    expect(
      handle.validateDocumentJson({ type: 'doc', content: [] }),
    ).toBe(false);
    expect(() =>
      handle.setDocumentJson({ type: 'doc', content: [] }),
    ).not.toThrow();
    expect(() => handle.insertValue('ignored')).not.toThrow();
    expect(() =>
      handle.insertDocumentJson({ type: 'paragraph' }),
    ).not.toThrow();
    expect(() => handle.clear()).not.toThrow();
    expect(handle.isEmpty()).toBe(true);
  });
});
