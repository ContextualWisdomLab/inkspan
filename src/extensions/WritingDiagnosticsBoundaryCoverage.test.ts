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

function stateWithText(): EditorState {
  return EditorState.create({
    schema,
    doc: schema.node('doc', undefined, [
      schema.node('paragraph', undefined, [schema.text('Alpha beta gamma')]),
    ]),
    plugins: [createWritingDiagnosticsPlugin()],
  });
}

function pluginState(state: EditorState): WritingDiagnosticsPluginState {
  const result = writingDiagnosticsPluginKey.getState(state);
  if (result === undefined) throw new Error('Missing writing diagnostics state');
  return result;
}

function diagnostic(): CwlResolvedWritingDiagnosticDecoration {
  return {
    diagnosticId: 'diag-boundary',
    from: 1,
    to: 6,
    priority: 'important',
  };
}

function applyCandidate(state: EditorState, candidate: unknown): EditorState {
  return state.apply(
    state.tr.setMeta(writingDiagnosticsPluginKey, {
      type: 'install',
      generation: 1,
      diagnostics: [candidate],
    }),
  );
}

describe('WritingDiagnostics reflection failure coverage', () => {
  it('contains candidate prototype and key reflection failures', () => {
    for (const candidate of [
      new Proxy(diagnostic(), {
        getPrototypeOf() {
          throw new Error('private prototype detail');
        },
      }),
      new Proxy(diagnostic(), {
        ownKeys() {
          throw new Error('private key detail');
        },
      }),
    ]) {
      const state = stateWithText();
      const initial = pluginState(state);
      expect(() => applyCandidate(state, candidate)).not.toThrow();
      expect(pluginState(applyCandidate(state, candidate))).toBe(initial);
    }
  });

  it('contains candidate property-descriptor reflection failures', () => {
    const state = stateWithText();
    const initial = pluginState(state);
    const candidate = new Proxy(diagnostic(), {
      getOwnPropertyDescriptor() {
        throw new Error('private descriptor detail');
      },
    });

    expect(() => applyCandidate(state, candidate)).not.toThrow();
    expect(pluginState(applyCandidate(state, candidate))).toBe(initial);
  });
});
