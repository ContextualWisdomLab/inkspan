import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const doctoringPath = 'docs/doctoring/tiptap-v2-prosemirror-paste-adapter.md';
const adapterPath = 'src/extensions/SafeClipboardExtension.ts';
const kitPath = 'src/extensions/kit.ts';
const lockPath = 'pnpm-lock.yaml';
const workspacePath = 'pnpm-workspace.yaml';
const packagePath = 'package.json';
const reactPatchPath = 'patches/@tiptap__react@3.30.4.patch';
const changelogPath = 'CHANGELOG.md';

/** Read one authoritative repository artifact for deterministic contract tests. */
function readRepositoryText(path: string): string {
  return readFileSync(path, 'utf8');
}

describe('TipTap SafeClipboard adapter doctoring', () => {
  it('records the locked-version root cause and actual ProseMirror registration path', () => {
    const doctoring = readRepositoryText(doctoringPath);
    const adapter = readRepositoryText(adapterPath);
    const kit = readRepositoryText(kitPath);
    const lock = readRepositoryText(lockPath);
    const workspace = readRepositoryText(workspacePath);
    const manifest = JSON.parse(readRepositoryText(packagePath)) as {
      dependencies?: Record<string, string>;
    };
    const reactPatch = readRepositoryText(reactPatchPath);
    const changelog = readRepositoryText(changelogPath);

    expect(lock).toMatch(
      /^\s+'@tiptap\/core':\n\s+specifier: 3\.30\.4$/mu,
    );
    expect(doctoring).toContain('TipTap 3.30.4 package family');
    expect(doctoring).toContain('packed strict-TypeScript consumer check');
    expect(workspace).toContain("'@tiptap/react@3.30.4':");
    expect(manifest.dependencies?.['@tiptap/y-tiptap']).toBe('3.0.9');
    expect(manifest.dependencies?.['prosemirror-model']).toBe('^1.7.1');
    expect(manifest.dependencies?.['prosemirror-state']).toBe('^1.2.3');
    expect(manifest.dependencies?.['prosemirror-view']).toBe('^1.9.10');
    expect(manifest.dependencies?.['y-protocols']).toBe('^1.0.1');
    expect(manifest.dependencies).not.toHaveProperty('y-prosemirror');
    expect(reactPatch).toContain('EditorStateSnapshot<Editor>');
    expect(doctoring).toContain('addProseMirrorPlugins');
    expect(doctoring).toContain('transformPastedHTML');
    expect(doctoring).toContain('before ProseMirror parses');
    expect(doctoring).toContain('residual host boundary');
    expect(doctoring).toContain('APA 7 references');
    expect(adapter).toContain('addProseMirrorPlugins()');
    expect(adapter).toContain('transformPastedHTML:');
    expect(kit).toContain("from './SafeClipboardExtension.js'");
    expect(changelog).toContain(
      'registered TipTap v2.27.2 ProseMirror plugin adapter',
    );
  });

  it('binds test-first evidence and distinguishes mutable documentation', () => {
    const doctoring = readRepositoryText(doctoringPath);

    expect(doctoring).toContain('2e1d634bd819686b298256f9bac161e4f6e90067');
    expect(doctoring).toContain('31172315841');
    expect(doctoring).toContain('locked source is authoritative');
    expect(doctoring).not.toContain(
      'current Tiptap documentation proves the v2 registration path',
    );
  });
});
