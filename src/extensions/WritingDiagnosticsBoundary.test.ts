import { Schema } from '@tiptap/pm/model';
import { EditorState } from '@tiptap/pm/state';
import { describe, expect, it, vi } from 'vitest';
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

function stateWithText() {
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
  if (!result) throw new Error('Missing plugin state');
  return result;
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

function applyForgedMeta(state: EditorState, meta: unknown): EditorState {
  return state.apply(state.tr.setMeta(writingDiagnosticsPluginKey, meta));
}

describe('WritingDiagnostics transaction metadata boundary', () => {
  it('returns no decorations when the plugin is absent', () => {
    const plugin = createWritingDiagnosticsPlugin();
    const state = EditorState.create({ schema });

    expect(plugin.props.decorations?.call(plugin, state)).toBeNull();
  });

  it('ignores null, primitive, unknown, and revoked metadata without throwing', () => {
    let state = stateWithText();
    const initial = pluginState(state);
    const revoked = Proxy.revocable(
      { type: 'clear' },
      {},
    );
    revoked.revoke();

    for (const meta of [null, false, 'clear', { type: 'unknown' }, revoked.proxy]) {
      expect(() => {
        state = applyForgedMeta(state, meta);
      }).not.toThrow();
      expect(pluginState(state)).toBe(initial);
    }
  });

  it('ignores install metadata whose diagnostics array is revoked or trap-backed', () => {
    let state = stateWithText();
    const initial = pluginState(state);
    const revoked = Proxy.revocable([diagnostic()], {});
    revoked.revoke();
    const trapBacked = new Proxy([diagnostic()], {
      get(target, key, receiver) {
        if (key === 'length' || key === Symbol.iterator) {
          throw new Error('private diagnostics-array detail');
        }
        return Reflect.get(target, key, receiver);
      },
    });

    for (const diagnostics of [revoked.proxy, trapBacked]) {
      expect(() => {
        state = applyForgedMeta(state, {
          type: 'install',
          generation: 1,
          diagnostics,
        });
      }).not.toThrow();
      expect(pluginState(state)).toBe(initial);
    }
  });

  it('never evaluates resolved-diagnostic accessors', () => {
    let state = stateWithText();
    const getter = vi.fn(() => 1);
    const candidate = {
      diagnosticId: 'diag-accessor',
      to: 4,
      priority: 'important',
    } as Record<string, unknown>;
    Object.defineProperty(candidate, 'from', {
      enumerable: true,
      get: getter,
    });

    state = applyForgedMeta(state, {
      type: 'install',
      generation: 1,
      diagnostics: [candidate],
    });

    expect(getter).not.toHaveBeenCalled();
    expect(pluginState(state).generation).toBe(-1);
  });

  it('contains hostile object reflection failures', () => {
    let state = stateWithText();
    const prototypeTrap = new Proxy(diagnostic(), {
      getPrototypeOf() {
        throw new Error('private prototype detail');
      },
    });
    const descriptorTrap = new Proxy(diagnostic(), {
      getOwnPropertyDescriptor() {
        throw new Error('private descriptor detail');
      },
    });

    for (const candidate of [prototypeTrap, descriptorTrap]) {
      const previous = pluginState(state);
      expect(() => {
        state = applyForgedMeta(state, {
          type: 'install',
          generation: 1,
          diagnostics: [candidate],
        });
      }).not.toThrow();
      expect(pluginState(state)).toBe(previous);
    }
  });

  it('rejects extra, symbol, inherited, missing, and non-enumerable fields', () => {
    let state = stateWithText();
    const inherited = Object.assign(
      Object.create({ inherited: true }),
      diagnostic({ diagnosticId: 'inherited' }),
    );
    const missing = { ...diagnostic({ diagnosticId: 'missing' }) } as Record<
      string,
      unknown
    >;
    delete missing.priority;
    const hidden = { ...diagnostic({ diagnosticId: 'hidden' }) } as Record<
      string,
      unknown
    >;
    Object.defineProperty(hidden, 'from', {
      value: 1,
      enumerable: false,
    });
    const candidates = [
      { ...diagnostic({ diagnosticId: 'extra' }), extra: true },
      {
        ...diagnostic({ diagnosticId: 'symbol' }),
        [Symbol('private')]: true,
      },
      inherited,
      missing,
      hidden,
    ];

    for (const candidate of candidates) {
      const previous = pluginState(state);
      state = applyForgedMeta(state, {
        type: 'install',
        generation: 1,
        diagnostics: [candidate],
      });
      expect(pluginState(state)).toBe(previous);
    }
  });

  it('rejects oversized sets and invalid scalar fields', () => {
    let state = stateWithText();
    const tooMany = Array.from({ length: 257 }, (_, index) =>
      diagnostic({ diagnosticId: `diag-${index}` }),
    );
    const invalid = [
      diagnostic({ diagnosticId: '' }),
      diagnostic({ diagnosticId: 'x'.repeat(257) }),
      diagnostic({ from: Number.NaN }),
      diagnostic({ to: Number.POSITIVE_INFINITY }),
      diagnostic({ priority: 'urgent' as CwlResolvedWritingDiagnosticDecoration['priority'] }),
    ];

    for (const diagnostics of [
      tooMany,
      ...invalid.map((item) => [item]),
      [null],
      [false],
      [[]],
    ]) {
      const previous = pluginState(state);
      state = applyForgedMeta(state, {
        type: 'install',
        generation: 1,
        diagnostics,
      });
      expect(pluginState(state)).toBe(previous);
    }
  });

  it('accepts an empty exact generation as a monotonic fence', () => {
    let state = stateWithText();
    state = applyForgedMeta(state, {
      type: 'install',
      generation: 4,
      diagnostics: [],
    });

    expect(pluginState(state)).toEqual(
      expect.objectContaining({
        generation: 4,
        diagnostics: [],
        focusedDiagnosticId: null,
      }),
    );
    expect(pluginState(state).decorations.find()).toEqual([]);
  });

  it('keeps opaque hostile-looking identifiers as inert data attributes only', () => {
    let state = stateWithText();
    const diagnosticId = '<img src=x onerror=alert(1)>';
    state = applyForgedMeta(state, {
      type: 'install',
      generation: 1,
      diagnostics: [diagnostic({ diagnosticId })],
    });

    const [decoration] = pluginState(state).decorations.find();
    const attributes = (
      decoration as unknown as { type: { attrs: Record<string, string> } }
    ).type.attrs;
    expect(attributes['data-cwl-diagnostic-id']).toBe(diagnosticId);
    expect(attributes).not.toHaveProperty('title');
    expect(attributes).not.toHaveProperty('href');
    expect(attributes).not.toHaveProperty('onclick');
  });
});
