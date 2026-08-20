import { Editor } from '@tiptap/core';
import { buildExtensions } from 'inkspan-browser-under-test';

declare global {
  interface Window {
    inkspanInputHarness: {
      getText: () => string;
      isComposing: () => boolean;
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
  getText: () => editor.getText(),
  isComposing: () => editor.view.composing,
});
