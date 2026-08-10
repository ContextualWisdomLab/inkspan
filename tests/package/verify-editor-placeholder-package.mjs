import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { JSDOM } from 'jsdom';
import React from 'react';

const packResult = JSON.parse(
  execFileSync(
    'npm',
    ['pack', '--dry-run', '--json', '--ignore-scripts'],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] },
  ),
)[0];
assert.ok(
  packResult.files.some(({ path }) => path === 'dist/cwl-editor.js'),
  'npm package must include the exact root ESM entry exercised by this smoke test',
);

const dom = new JSDOM('<!doctype html><html><body></body></html>', {
  url: 'https://inkspan.invalid/',
});

for (const name of [
  'window',
  'document',
  'navigator',
  'HTMLElement',
  'Element',
  'Node',
  'DOMParser',
  'MutationObserver',
  'getComputedStyle',
]) {
  Object.defineProperty(globalThis, name, {
    configurable: true,
    value:
      name === 'getComputedStyle'
        ? dom.window.getComputedStyle.bind(dom.window)
        : dom.window[name],
  });
}

globalThis.requestAnimationFrame = (callback) =>
  setTimeout(() => callback(Date.now()), 0);
globalThis.cancelAnimationFrame = (handle) => clearTimeout(handle);
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const { render, screen, cleanup } = await import('@testing-library/react');
const { CwlEditor } = await import('../../dist/cwl-editor.js');

try {
  render(
    React.createElement(CwlEditor, {
      ariaLabel: 'Packed editor',
      placeholder: '  Packed guidance…  ',
      hideToolbar: true,
    }),
  );

  const textbox = await screen.findByRole('textbox', { name: 'Packed editor' });
  assert.equal(textbox.getAttribute('aria-placeholder'), 'Packed guidance…');
  assert.equal(
    textbox.querySelector('[data-placeholder]')?.getAttribute('data-placeholder'),
    'Packed guidance…',
  );
} finally {
  cleanup();
  dom.window.close();
}
