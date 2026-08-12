import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CwlEditorHandle } from '../types.js';
import type { CwlWritingDiagnostic } from '../writingDiagnostics.js';
import { CwlEditor } from './CwlEditor.js';

const sourceDocuments = [
  '<p>The report quotes “this is rude and urgent” without endorsing it.</p>',
  '<p>This request has the same pragmatic issue without sharing any lexical marker.</p>',
  '<p>Product <code>incorrect</code> lives at https://example.test/urgent/path.</p>',
  '<p>이 문장은 무례함이라는 단어를 인용하지만 직접 비난하지 않습니다.</p>',
  '<p>English와 한국어가 섞인 문장과 中文内容입니다.</p>',
] as const;

afterEach(() => {
  vi.restoreAllMocks();
  cleanup();
});

function expectRedactedErrors(
  onError: ReturnType<typeof vi.fn>,
  forbidden: string,
): void {
  expect(onError.mock.calls.length).toBeGreaterThanOrEqual(1);
  for (const call of onError.mock.calls) {
    expect(String(call[0])).not.toContain(forbidden);
  }
}

describe('writing diagnostics security and semantic-authority boundary', () => {
  it.each(sourceDocuments)(
    'produces no diagnostic surface without host diagnostics: %s',
    async (source) => {
      const editorRef = createRef<CwlEditorHandle>();
      render(<CwlEditor ref={editorRef} mode="html" defaultValue={source} />);
      await waitFor(() => expect(editorRef.current?.getEditor()).toBeTruthy());

      expect(screen.queryByRole('region', { name: 'Writing guidance' })).toBeNull();
      expect(document.querySelector('.cwl-writing-diagnostic')).toBeNull();
      expect(editorRef.current!.getHTML()).toContain(
        source.replace(/^<p>|<\/p>$/gu, '').split('<')[0],
      );
    },
  );

  it('rejects hostile diagnostic accessors and proxies without reflecting authored data', async () => {
    const editorRef = createRef<CwlEditorHandle>();
    const onError = vi.fn();
    const accessor = Object.create(null) as Record<string, unknown>;
    Object.defineProperty(accessor, 'diagnosticId', {
      enumerable: true,
      get() {
        throw new Error('SECRET_AUTHORED_TEXT');
      },
    });
    const proxy = new Proxy(Object.create(null), {
      ownKeys() {
        throw new Error('SECRET_PROXY_TEXT');
      },
    });

    const mounted = render(
      <CwlEditor
        ref={editorRef}
        mode="html"
        defaultValue="<p>Alpha beta gamma</p>"
        writingDiagnostics={[accessor as unknown as CwlWritingDiagnostic]}
        onWritingDiagnosticsError={onError}
      />,
    );
    await waitFor(() => expect(onError.mock.calls.length).toBeGreaterThanOrEqual(1));
    expectRedactedErrors(onError, 'SECRET_AUTHORED_TEXT');
    expect(editorRef.current!.getHTML()).toContain('Alpha beta gamma');

    onError.mockClear();
    mounted.rerender(
      <CwlEditor
        ref={editorRef}
        mode="html"
        defaultValue="<p>Alpha beta gamma</p>"
        writingDiagnostics={[proxy as unknown as CwlWritingDiagnostic]}
        onWritingDiagnosticsError={onError}
      />,
    );
    await waitFor(() => expect(onError.mock.calls.length).toBeGreaterThanOrEqual(1));
    expectRedactedErrors(onError, 'SECRET_PROXY_TEXT');
    expect(screen.queryByText(/SECRET_/u)).toBeNull();
  });

  it('contains host callback exceptions after a successful plain-text application', async () => {
    const editorRef = createRef<CwlEditorHandle>();
    const onAction = vi.fn(() => {
      throw new Error('HOST_CALLBACK_SECRET');
    });
    const mounted = render(
      <CwlEditor ref={editorRef} mode="html" defaultValue="<p>Alpha beta gamma</p>" />,
    );
    await waitFor(() => expect(editorRef.current?.getEditor()).toBeTruthy());
    const revision = await editorRef.current!.getDocumentEnvelopeRevision();
    expect(revision).not.toBeNull();

    const diagnostic: CwlWritingDiagnostic = {
      diagnosticId: 'callback-diagnostic',
      documentRevision: revision!,
      textProjection: { id: 'inkspan-prosemirror-text', version: 1 },
      selector: { type: 'TextPositionSelector', start: 0, end: 5 },
      categoryCode: 'clarity',
      priority: 'important',
      title: '<script>Title</script>\u202E',
      explanation: '<img src=x onerror=alert(1)> explanation',
      suggestedReplacement: '<script>alert(1)</script>',
      provenance: {
        workflowId: 'email-writing-review',
        workflowVersion: '1',
        judgePolicyVersion: 'evaluation-only-1',
      },
    };

    mounted.rerender(
      <CwlEditor
        ref={editorRef}
        mode="html"
        defaultValue="<p>Alpha beta gamma</p>"
        writingDiagnostics={[diagnostic]}
        onWritingDiagnosticAction={onAction}
      />,
    );
    const apply = await screen.findByRole('button', {
      name: /Apply suggestion for/u,
    });
    fireEvent.click(apply);
    await waitFor(() =>
      expect(editorRef.current!.getHTML()).toContain(
        '&lt;script&gt;alert(1)&lt;/script&gt;',
      ),
    );
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(document.querySelector('script[src="x"]')).toBeNull();
    expect(screen.queryByText('HOST_CALLBACK_SECRET')).toBeNull();
  });
});