import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { Schema } from '@tiptap/pm/model';
import { EditorState } from '@tiptap/pm/state';
import { EditorView } from '@tiptap/pm/view';
import { describe, expect, it } from 'vitest';
import {
  WritingDiagnostics,
  clearWritingDiagnostics,
  createWritingDiagnosticsPlugin,
  focusWritingDiagnostic,
  installWritingDiagnostics,
  writingDiagnosticsPluginKey,
  type CwlResolvedWritingDiagnosticDecoration,
  type WritingDiagnosticsPluginState,
} from './WritingDiagnostics.js';

const schema = new Schema({
  nodes: {
    doc: { content: 'paragraph+' },
    paragraph: {
      content: 'text*',
      toDOM: () => ['p', 0],
    },
    text: {},
  },
});

function documentWithText(text = 'Alpha beta gamma') {
  return schema.node('doc', undefined, [
    schema.node('paragraph', undefined, text ? [schema.text(text)] : []),
  ]);
}

function stateWithText(text = 'Alpha beta gamma') {
  return EditorState.create({
    schema,
    doc: documentWithText(text),
    plugins: [createWritingDiagnosticsPlugin()],
  });
}

function pluginState(state: EditorState): WritingDiagnosticsPluginState {
  const value = writingDiagnosticsPluginKey.getState(state);
  if (!value) throw new Error('Missing writing diagnostics plugin state');
  return value;
}

function diagnostic(
  overrides: Partial<CwlResolvedWritingDiagnosticDecoration> = {},
): CwlResolvedWritingDiagnosticDecoration {
  return {
    diagnosticId: 'diag-1',
    from: 1,
    to: 6,
    priority: 'important',
    ...overrides,
  };
}

/** Create one deliberately forged runtime shape outside the public type. */
function diagnosticWithSemanticAttribute(
  value: string,
): CwlResolvedWritingDiagnosticDecoration {
  return {
    ...diagnostic(),
    ariaInvalid: value,
  } as unknown as CwlResolvedWritingDiagnosticDecoration;
}

function decorationAttributes(state: EditorState): Record<string, string> {
  const [decoration] = pluginState(state).decorations.find();
  if (!decoration) throw new Error('Missing writing diagnostic decoration');
  return (
    decoration as unknown as {
      type: { attrs: Record<string, string> };
    }
  ).type.attrs;
}

describe('WritingDiagnostics extension contract', () => {
  it('exposes one stable TipTap extension and plugin key', () => {
    expect(WritingDiagnostics.name).toBe('writingDiagnostics');
    expect(typeof writingDiagnosticsPluginKey.getState).toBe('function');
  });

  it('validates and dispatches the public TipTap commands', () => {
    const editor = new Editor({
      extensions: [StarterKit, WritingDiagnostics],
      content: '<p>Alpha beta gamma</p>',
    });

    expect(editor.can().installWritingDiagnostics(1, [diagnostic()])).toBe(true);
    expect(editor.commands.installWritingDiagnostics(1, [diagnostic()])).toBe(true);
    expect(editor.can().focusWritingDiagnostic(1, 'diag-1')).toBe(true);
    expect(editor.commands.focusWritingDiagnostic(1, 'diag-1')).toBe(true);
    expect(editor.can().clearWritingDiagnostics()).toBe(true);
    expect(editor.commands.clearWritingDiagnostics()).toBe(true);

    expect(editor.commands.installWritingDiagnostics(Number.NaN, [])).toBe(false);
    expect(editor.commands.installWritingDiagnostics(-1, [])).toBe(false);
    expect(
      editor.commands.installWritingDiagnostics(2, [diagnostic({ from: -1 })]),
    ).toBe(false);
    expect(editor.commands.focusWritingDiagnostic(Number.NaN, 'diag-1')).toBe(false);
    expect(editor.commands.focusWritingDiagnostic(-1, 'diag-1')).toBe(false);
    expect(
      editor.commands.focusWritingDiagnostic(1, 1 as unknown as string),
    ).toBe(false);
    expect(editor.commands.focusWritingDiagnostic(1, '')).toBe(false);
    expect(editor.commands.focusWritingDiagnostic(1, 'x'.repeat(257))).toBe(false);

    editor.destroy();
  });

  it('starts empty without mutating the document or rendering decorations', () => {
    const state = stateWithText();
    const current = pluginState(state);

    expect(state.doc.textContent).toBe('Alpha beta gamma');
    expect(current.generation).toBe(-1);
    expect(current.diagnostics).toEqual([]);
    expect(current.focusedDiagnosticId).toBeNull();
    expect(current.decorations.find()).toEqual([]);
  });

  it('installs verified ranges with only static privacy-minimized attributes', () => {
    let state = stateWithText();
    state = state.apply(
      installWritingDiagnostics(state.tr, 4, [diagnostic()]),
    );

    const current = pluginState(state);
    expect(current.generation).toBe(4);
    expect(current.diagnostics).toEqual([diagnostic()]);
    expect(Object.isFrozen(current.diagnostics)).toBe(true);
    expect(Object.isFrozen(current.diagnostics[0])).toBe(true);
    expect(decorationAttributes(state)).toEqual({
      class: 'cwl-writing-diagnostic cwl-writing-diagnostic--important',
      'data-cwl-diagnostic-id': 'diag-1',
    });
    expect(JSON.stringify(decorationAttributes(state))).not.toContain('Alpha');
  });

  it('never infers semantic ARIA state from category-like identifiers', () => {
    let state = stateWithText();
    state = state.apply(
      installWritingDiagnostics(state.tr, 1, [
        diagnostic({ diagnosticId: 'grammar.spelling.issue' }),
      ]),
    );

    expect(decorationAttributes(state)).toEqual({
      class: 'cwl-writing-diagnostic cwl-writing-diagnostic--important',
      'data-cwl-diagnostic-id': 'grammar.spelling.issue',
    });
  });

  it('retains collapsed diagnostics without creating an inline decoration', () => {
    let state = stateWithText();
    state = state.apply(
      installWritingDiagnostics(state.tr, 1, [
        diagnostic({ from: 3, to: 3 }),
      ]),
    );

    expect(pluginState(state).diagnostics).toHaveLength(1);
    expect(pluginState(state).decorations.find()).toEqual([]);
  });

  it('ignores duplicate and stale install generations', () => {
    let state = stateWithText();
    state = state.apply(
      installWritingDiagnostics(state.tr, 7, [diagnostic()]),
    );
    const accepted = pluginState(state);

    state = state.apply(
      installWritingDiagnostics(state.tr, 7, [
        diagnostic({ diagnosticId: 'same-generation', from: 7, to: 10 }),
      ]),
    );
    expect(pluginState(state)).toBe(accepted);

    state = state.apply(
      installWritingDiagnostics(state.tr, 6, [
        diagnostic({ diagnosticId: 'stale-generation', from: 7, to: 10 }),
      ]),
    );
    expect(pluginState(state)).toBe(accepted);
  });

  it('focuses only an installed diagnostic from the active generation', () => {
    let state = stateWithText();
    state = state.apply(
      installWritingDiagnostics(state.tr, 3, [
        diagnostic(),
        diagnostic({ diagnosticId: 'diag-2', from: 7, to: 11 }),
      ]),
    );

    state = state.apply(focusWritingDiagnostic(state.tr, 3, 'diag-2'));
    expect(pluginState(state).focusedDiagnosticId).toBe('diag-2');

    const focused = pluginState(state);
    state = state.apply(focusWritingDiagnostic(state.tr, 2, 'diag-1'));
    expect(pluginState(state)).toBe(focused);
    state = state.apply(focusWritingDiagnostic(state.tr, 3, 'missing'));
    expect(pluginState(state)).toBe(focused);
  });

  it('clears active state while retaining the monotonic generation fence', () => {
    let state = stateWithText();
    state = state.apply(
      installWritingDiagnostics(state.tr, 9, [diagnostic()]),
    );
    state = state.apply(clearWritingDiagnostics(state.tr));

    expect(pluginState(state)).toEqual(
      expect.objectContaining({
        generation: 9,
        diagnostics: [],
        focusedDiagnosticId: null,
      }),
    );
    expect(pluginState(state).decorations.find()).toEqual([]);

    const cleared = pluginState(state);
    state = state.apply(
      installWritingDiagnostics(state.tr, 9, [diagnostic()]),
    );
    expect(pluginState(state)).toBe(cleared);
  });

  it('keeps an already empty state when cleared', () => {
    const state = stateWithText();
    expect(
      pluginState(state.apply(clearWritingDiagnostics(state.tr))),
    ).toBe(pluginState(state));
  });

  it('clears before processing metadata on every document-changing transaction', () => {
    let state = stateWithText();
    state = state.apply(
      installWritingDiagnostics(state.tr, 5, [diagnostic()]),
    );

    const transaction = installWritingDiagnostics(
      state.tr.insertText('!', 2),
      6,
      [diagnostic({ diagnosticId: 'must-not-install' })],
    );
    state = state.apply(transaction);

    expect(state.doc.textContent).toBe('A!lpha beta gamma');
    expect(pluginState(state).generation).toBe(5);
    expect(pluginState(state).diagnostics).toEqual([]);
    expect(pluginState(state).decorations.find()).toEqual([]);
  });

  it('does not map diagnostics through an ordinary remote-like document change', () => {
    let state = stateWithText();
    state = state.apply(
      installWritingDiagnostics(state.tr, 2, [diagnostic()]),
    );

    const remoteLike = state.tr.insertText('remote ', 1).setMeta('y-sync$', {
      isChangeOrigin: true,
    });
    state = state.apply(remoteLike);

    expect(pluginState(state).generation).toBe(2);
    expect(pluginState(state).diagnostics).toEqual([]);
    expect(pluginState(state).decorations.find()).toEqual([]);
  });

  it('fails closed for invalid ranges, duplicate ids, or semantic attributes', () => {
    let state = stateWithText();
    const invalidSets: readonly (readonly CwlResolvedWritingDiagnosticDecoration[])[] = [
      [diagnostic({ from: -1 })],
      [diagnostic({ from: 9, to: 8 })],
      [diagnostic({ to: state.doc.content.size + 1 })],
      [diagnostic(), diagnostic()],
      [diagnosticWithSemanticAttribute('spelling')],
      [diagnosticWithSemanticAttribute('grammar')],
    ];

    for (const invalid of invalidSets) {
      const previous = pluginState(state);
      state = state.apply(installWritingDiagnostics(state.tr, 1, invalid));
      expect(pluginState(state)).toBe(previous);
    }
  });

  it('releases with the editor view and retains no external lifecycle resource', () => {
    const host = document.createElement('div');
    document.body.append(host);
    const view = new EditorView(host, { state: stateWithText() });

    expect(() => view.destroy()).not.toThrow();
    expect(host.childNodes).toHaveLength(0);
    host.remove();
  });
});
