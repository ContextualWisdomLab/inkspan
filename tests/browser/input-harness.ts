import type { Editor } from '@tiptap/core';
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { CwlEditor } from 'inkspan-browser-under-test';

declare global {
  interface Window {
    inkspanInputHarness: {
      getHtml: () => string;
      getText: () => string;
      isComposing: () => boolean;
      redo: () => boolean;
      remount: () => boolean;
      setEditable: (editable: boolean) => boolean;
      setHtml: (html: string) => boolean;
      undo: () => boolean;
    };
  }
}

const element = document.getElementById('editor');
if (!(element instanceof HTMLElement)) {
  throw new Error('Input assurance harness editor host is missing.');
}

const showToolbar = new URLSearchParams(window.location.search).get('toolbar') === '1';
let editor: Editor | null = null;
let editable = true;
let root = createRoot(element);

const renderEditor = () => {
  root.render(
    createElement(CwlEditor, {
      mode: 'html',
      defaultValue: '',
      editable,
      hideToolbar: !showToolbar,
      formFieldName: 'message_body',
      onReady: (instance: Editor) => {
        editor = instance;
      },
    }),
  );
};

const getEditor = (): Editor => {
  if (!editor) {
    throw new Error('Input assurance harness editor is not ready.');
  }
  return editor;
};

renderEditor();

window.inkspanInputHarness = Object.freeze({
  getHtml: () => getEditor().getHTML(),
  getText: () => getEditor().getText(),
  isComposing: () => getEditor().view.composing,
  redo: () => getEditor().commands.redo(),
  remount: () => {
    root.unmount();
    editor = null;
    root = createRoot(element);
    renderEditor();
    return true;
  },
  setEditable: (nextEditable: boolean) => {
    editable = nextEditable;
    renderEditor();
    return editable;
  },
  setHtml: (html: string) => getEditor().commands.setContent(html, false),
  undo: () => getEditor().commands.undo(),
});
