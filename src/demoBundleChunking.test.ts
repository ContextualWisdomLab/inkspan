import { describe, expect, it } from 'vitest';
import { demoVendorChunk } from '../vite.demo.chunking';

describe('demo bundle chunking contract', () => {
  it('keeps major editor dependency families in deterministic vendor chunks', () => {
    const pnpmPrefix = '/repo/node_modules/.pnpm/example/node_modules/';

    expect(demoVendorChunk(`${pnpmPrefix}react-dom/client.js`)).toBe(
      'react-vendor',
    );
    expect(demoVendorChunk(`${pnpmPrefix}@tiptap/pm/state/index.js`)).toBe(
      'prosemirror-vendor',
    );
    expect(demoVendorChunk(`${pnpmPrefix}prosemirror-state/dist/index.js`)).toBe(
      'prosemirror-vendor',
    );
    expect(demoVendorChunk(`${pnpmPrefix}@tiptap/core/dist/index.js`)).toBe(
      'tiptap-vendor',
    );
    expect(demoVendorChunk(`${pnpmPrefix}marked/lib/marked.esm.js`)).toBe(
      'serialization-vendor',
    );
    expect(demoVendorChunk(`${pnpmPrefix}turndown/lib/turndown.es.js`)).toBe(
      'serialization-vendor',
    );
    expect(demoVendorChunk(`${pnpmPrefix}yjs/dist/yjs.mjs`)).toBe(
      'collaboration-vendor',
    );
    expect(demoVendorChunk(`${pnpmPrefix}lodash-es/lodash.js`)).toBe('vendor');
  });

  it('leaves application modules to Rollup and normalizes Windows paths', () => {
    expect(demoVendorChunk('/repo/demo/App.tsx')).toBeUndefined();
    expect(demoVendorChunk(String.raw`C:\repo\node_modules\react\index.js`)).toBe(
      'react-vendor',
    );
  });
});
