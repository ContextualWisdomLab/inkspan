import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const doctoringPath = 'docs/doctoring/tiptap-v2-prosemirror-paste-adapter.md';
const adapterPath = 'src/extensions/SafeClipboardExtension.ts';
const kitPath = 'src/extensions/kit.ts';
const lockPath = 'pnpm-lock.yaml';

/** Read one authoritative repository artifact for deterministic contract tests. */
function readRepositoryText(path: string): string {
  return readFileSync(path, 'utf8');
}

describe('TipTap v2 SafeClipboard adapter doctoring', () => {
  it('records the locked-version root cause and actual ProseMirror registration path', () => {
    const doctoring = readRepositoryText(doctoringPath);
    const adapter = readRepositoryText(adapterPath);
    const kit = readRepositoryText(kitPath);
    const lock = readRepositoryText(lockPath);

    expect(lock).toContain("'@tiptap/core':");
    expect(lock).toContain('version: 2.27.2');
    expect(doctoring).toContain('@tiptap/core 2.27.2');
    expect(doctoring).toContain('addProseMirrorPlugins');
    expect(doctoring).toContain('transformPastedHTML');
    expect(doctoring).toContain('before ProseMirror parses');
    expect(doctoring).toContain('residual host boundary');
    expect(doctoring).toContain('APA 7 references');
    expect(adapter).toContain('addProseMirrorPlugins()');
    expect(adapter).toContain('transformPastedHTML:');
    expect(kit).toContain("from './SafeClipboardExtension.js'");
  });

  it('binds the test-first evidence and forbids a mutable-documentation claim', () => {
    const doctoring = readRepositoryText(doctoringPath);

    expect(doctoring).toContain('2e1d634bd819686b298256f9bac161e4f6e90067');
    expect(doctoring).toContain('31172315841');
    expect(doctoring).toContain('locked source is authoritative');
    expect(doctoring).not.toContain(
      'current Tiptap documentation proves the v2 registration path',
    );
  });
});
