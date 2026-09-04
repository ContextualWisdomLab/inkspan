import type { Editor } from '@tiptap/core';
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { CwlEditor } from 'inkspan-browser-under-test';
import '../../src/styles.css';

declare global {
  interface Window {
    inkspanInputHarness: {
      getHtml: () => string;
      getDocumentChanges: () => string[];
      getText: () => string;
      isComposing: () => boolean;
      insertText: (text: string) => boolean;
      redo: () => boolean;
      remount: () => boolean;
      setEditable: (editable: boolean) => boolean;
      setControlledHtml: (html: string) => boolean;
      setHtml: (html: string) => boolean;
      undo: () => boolean;
    };
  }
}

const element = document.getElementById('editor');
if (!(element instanceof HTMLElement)) {
  throw new Error('Input assurance harness editor host is missing.');
}

const searchParams = new URLSearchParams(window.location.search);
const showToolbar = searchParams.get('toolbar') === '1';
const controlled = searchParams.get('controlled') === '1';
let editor: Editor | null = null;
let editable = true;
let controlledHtml = '';
const documentChanges: string[] = [];
let root = createRoot(element);

const renderEditor = () => {
  root.render(
    createElement(CwlEditor, {
      mode: 'html',
      ...(controlled ? { value: controlledHtml } : { defaultValue: '' }),
      editable,
      hideToolbar: !showToolbar,
      formFieldName: 'message_body',
      onChange: controlled
        ? (value: string) => {
            controlledHtml = value;
          }
        : undefined,
      onDocumentChange: ({ snapshot }) => {
        documentChanges.push(snapshot.value);
      },
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
  getDocumentChanges: () => [...documentChanges],
  getText: () => getEditor().getText(),
  isComposing: () => getEditor().view.composing,
  insertText: (text: string) => getEditor().commands.insertContent(text),
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
  setControlledHtml: (html: string) => {
    if (!controlled) return false;
    controlledHtml = html;
    renderEditor();
    return true;
  },
  setHtml: (html: string) => getEditor().commands.setContent(html, false),
  undo: () => getEditor().commands.undo(),
});
