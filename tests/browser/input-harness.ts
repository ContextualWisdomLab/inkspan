import { Editor } from '@tiptap/core';
import { buildExtensions } from 'inkspan-browser-under-test';

declare global {
  interface Window {
    inkspanInputHarness: {
      getHtml: () => string;
      getText: () => string;
      isComposing: () => boolean;
      redo: () => boolean;
      setHtml: (html: string) => boolean;
      undo: () => boolean;
    };
  }
}

const element = document.getElementById('editor');
if (!(element instanceof HTMLElement)) {
  throw new Error('Input assurance harness editor host is missing.');
}

const editor = new Editor({
  element,
  extensions: buildExtensions(),
  content: '',
});

window.inkspanInputHarness = Object.freeze({
  getHtml: () => editor.getHTML(),
  getText: () => editor.getText(),
  isComposing: () => editor.view.composing,
  redo: () => editor.commands.redo(),
  setHtml: (html: string) => editor.commands.setContent(html, false),
  undo: () => editor.commands.undo(),
});
