import { Schema } from '@tiptap/pm/model';
import { EditorState } from '@tiptap/pm/state';
import { describe, expect, it } from 'vitest';
import {
  createWritingDiagnosticsPlugin,
  writingDiagnosticsPluginKey,
  type CwlResolvedWritingDiagnosticDecoration,
  type WritingDiagnosticsPluginState,
} from './WritingDiagnostics.js';

const schema = new Schema({
  nodes: {
    doc: { content: 'paragraph+' },
    paragraph: { content: 'text*', toDOM: () => ['p', 0] },
    text: {},
  },
});

/** Create one real plugin state for metadata-boundary assertions. */
function stateWithText(): EditorState {
  return EditorState.create({
    schema,
    doc: schema.node('doc', undefined, [
      schema.node('paragraph', undefined, [schema.text('Alpha beta gamma')]),
    ]),
    plugins: [createWritingDiagnosticsPlugin()],
  });
}

/** Read the writing-diagnostics state or fail the test fixture explicitly. */
function pluginState(state: EditorState): WritingDiagnosticsPluginState {
  const result = writingDiagnosticsPluginKey.getState(state);
  if (result === undefined) throw new Error('Missing writing diagnostics state');
  return result;
}

/** Build one ordinary resolved diagnostic before wrapping it in hostile proxies. */
function diagnostic(): CwlResolvedWritingDiagnosticDecoration {
  return {
    diagnosticId: 'diag-reflection',
    from: 1,
    to: 6,
    priority: 'important',
  };
}

describe('WritingDiagnostics hostile reflection failures', () => {
  it('rejects prototype and property-descriptor traps without leaking or throwing', () => {
    let state = stateWithText();
    const initial = pluginState(state);
    const prototypeTrap = new Proxy(diagnostic(), {
      getPrototypeOf() {
        throw new Error('private prototype detail');
      },
    });
    const descriptorTrap = new Proxy(diagnostic(), {
      getOwnPropertyDescriptor(target, key) {
        if (key === 'from') throw new Error('private descriptor detail');
        return Reflect.getOwnPropertyDescriptor(target, key);
      },
    });

    for (const candidate of [prototypeTrap, descriptorTrap]) {
      expect(() => {
        state = state.apply(
          state.tr.setMeta(writingDiagnosticsPluginKey, {
            type: 'install',
            generation: 1,
            diagnostics: [candidate],
          }),
        );
      }).not.toThrow();
      expect(pluginState(state)).toBe(initial);
    }
  });
});
