// @vitest-environment node

import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import { CollaborativeCwlEditor } from '../collaboration/CollaborativeCwlEditor.js';
import { CwlEditor } from './CwlEditor.js';

describe('server rendering', () => {
  it('renders a stable standalone shell without creating a TipTap editor', () => {
    const html = renderToString(
      <CwlEditor defaultValue="# Server draft" languageTag="ko-KR" />,
    );

    expect(html).toContain('class="cwl-editor"');
    expect(html).toContain('data-mode="markdown"');
    expect(html).toContain('cwl-editor__surface');
    expect(html).not.toContain('ProseMirror');
    expect(html).not.toContain('Server draft');
  });

  it('serializes configured native form data into the server shell', () => {
    const html = renderToString(
      <CwlEditor
        mode="html"
        defaultValue="<p>Ignored default</p>"
        value="<p>Server & draft</p>"
        hideToolbar
        formFieldName="message_body"
        formId="compose_form"
      />,
    );

    expect(html).toContain('data-inkspan-form-field=""');
    expect(html).toContain('name="message_body"');
    expect(html).toContain('form="compose_form"');
    expect(html).toContain(
      'value="&lt;p&gt;Server &amp; draft&lt;/p&gt;"',
    );
    expect(html).not.toContain('Ignored default');
    expect(html).not.toContain('ProseMirror');
  });

  it('omits document content from the server shell when form serialization is disabled', () => {
    const html = renderToString(
      <CwlEditor
        defaultValue="Private server draft"
        hideToolbar
        formFieldDisabled
      />,
    );

    expect(html).not.toContain('data-inkspan-form-field');
    expect(html).not.toContain('Private server draft');
  });

  it('renders a stable collaborative shell without binding Yjs on the server', () => {
    const collaborationDocument = new Y.Doc();
    try {
      const html = renderToString(
        <CollaborativeCwlEditor
          document={collaborationDocument}
          mode="html"
          connectionStatus="offline"
        />,
      );

      expect(html).toContain('class="cwl-editor"');
      expect(html).toContain('data-mode="html"');
      expect(html).toContain('cwl-collaboration-status');
      expect(html).not.toContain('ProseMirror');
    } finally {
      collaborationDocument.destroy();
    }
  });
});
