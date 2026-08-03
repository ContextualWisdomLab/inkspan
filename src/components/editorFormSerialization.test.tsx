import { act, cleanup, render, waitFor } from '@testing-library/react';
import { createRef } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import { CollaborativeCwlEditor } from '../collaboration/CollaborativeCwlEditor.js';
import type { CwlEditorHandle } from '../types.js';
import { CwlEditor } from './CwlEditor.js';
import { EditorFormField } from './EditorFormField.js';

afterEach(cleanup);

function submittedValue(form: HTMLFormElement, name: string): FormDataEntryValue | null {
  return new FormData(form).get(name);
}

describe('native form serialization', () => {
  it('renders an empty native field safely before an editor exists', () => {
    const { container } = render(
      <EditorFormField
        editor={null}
        mode="markdown"
        name="message_body"
      />,
    );

    expect(
      container.querySelector<HTMLInputElement>('[data-inkspan-form-field]')
        ?.value,
    ).toBe('');
  });

  it('omits the hidden field when no form field name is configured', async () => {
    const { container } = render(
      <CwlEditor defaultValue="Draft" hideToolbar />,
    );

    await waitFor(() =>
      expect(container.querySelector('.cwl-editor__content')).toBeTruthy(),
    );
    expect(container.querySelector('[data-inkspan-form-field]')).toBeNull();
  });

  it('submits live markdown and observes imperative replacements without serializing selection-only transactions', async () => {
    const editorRef = createRef<CwlEditorHandle>();
    const { container } = render(
      <form>
        <CwlEditor
          ref={editorRef}
          mode="markdown"
          defaultValue="# Draft"
          hideToolbar
          formFieldName="message_body"
        />
      </form>,
    );
    const form = container.querySelector('form')!;

    await waitFor(() => {
      expect(editorRef.current).toBeTruthy();
      expect(String(submittedValue(form, 'message_body'))).toContain('# Draft');
    });

    act(() => {
      editorRef.current!.getEditor()!.commands.setTextSelection(1);
    });
    expect(String(submittedValue(form, 'message_body'))).toContain('# Draft');

    act(() => {
      editorRef.current!.setValue('# Final');
    });
    await waitFor(() =>
      expect(String(submittedValue(form, 'message_body'))).toContain('# Final'),
    );
  });

  it('supports external form association, disabled submission, and live mode changes', async () => {
    const { container, rerender } = render(
      <>
        <form id="compose_form" />
        <CwlEditor
          mode="html"
          defaultValue="<p>Body</p>"
          hideToolbar
          formFieldName="message_body"
          formId="compose_form"
          formFieldDisabled
        />
      </>,
    );
    const form = container.querySelector('#compose_form') as HTMLFormElement;

    await waitFor(() =>
      expect(
        container.querySelector<HTMLInputElement>('[data-inkspan-form-field]')
          ?.value,
      ).toContain('<p>Body</p>'),
    );
    expect(new FormData(form).has('message_body')).toBe(false);

    rerender(
      <>
        <form id="compose_form" />
        <CwlEditor
          mode="html"
          defaultValue="<p>Body</p>"
          hideToolbar
          formFieldName="message_body"
          formId="compose_form"
        />
      </>,
    );
    await waitFor(() =>
      expect(String(submittedValue(form, 'message_body'))).toContain(
        '<p>Body</p>',
      ),
    );

    rerender(
      <>
        <form id="compose_form" />
        <CwlEditor
          mode="markdown"
          defaultValue="ignored after mount"
          hideToolbar
          formFieldName="message_body"
          formId="compose_form"
        />
      </>,
    );
    await waitFor(() =>
      expect(submittedValue(form, 'message_body')).toBe('Body'),
    );
  });

  it('mirrors the provider-neutral collaborative document into native forms', async () => {
    const collaborationDocument = new Y.Doc();
    const editorRef = createRef<CwlEditorHandle>();
    const { container, unmount } = render(
      <form>
        <CollaborativeCwlEditor
          ref={editorRef}
          document={collaborationDocument}
          mode="markdown"
          hideToolbar
          formFieldName="shared_body"
        />
      </form>,
    );
    const form = container.querySelector('form')!;

    await waitFor(() => expect(editorRef.current).toBeTruthy());
    act(() => {
      editorRef.current!.insertValue('Shared body');
    });
    await waitFor(() =>
      expect(String(submittedValue(form, 'shared_body'))).toContain(
        'Shared body',
      ),
    );

    unmount();
    collaborationDocument.destroy();
  });
});
