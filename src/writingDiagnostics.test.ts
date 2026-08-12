import { describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_WRITING_DIAGNOSTIC_LIMITS,
  WritingDiagnosticError,
  validateWritingDiagnostics,
  type CwlWritingDiagnostic,
} from './writingDiagnostics.js';

const DIGEST = 'a'.repeat(64);

function validDiagnostic(
  overrides: Partial<CwlWritingDiagnostic> = {},
): CwlWritingDiagnostic {
  return {
    diagnosticId: 'diag-1',
    documentRevision: {
      algorithm: 'SHA-256',
      digestHex: DIGEST,
      strongEntityTag: `"sha256-${DIGEST}"`,
    },
    textProjection: {
      id: 'inkspan-prosemirror-text',
      version: 1,
    },
    selector: {
      type: 'TextPositionSelector',
      start: 1,
      end: 3,
    },
    categoryCode: 'grammar.subject_verb',
    priority: 'important',
    title: 'Check agreement',
    explanation: 'The host judged this range as worth reviewing.',
    suggestedReplacement: 'were',
    confidence: 0.75,
    provenance: {
      workflowId: 'naruon-writing-review',
      workflowVersion: '2026-08-12',
      judgePolicyVersion: 'criterion-set-v3',
      orchestrationMode: 'quality',
    },
    ...overrides,
  };
}

function expectCode(input: unknown, code: WritingDiagnosticError['code']): void {
  try {
    validateWritingDiagnostics(input);
  } catch (error) {
    expect(error).toBeInstanceOf(WritingDiagnosticError);
    expect((error as WritingDiagnosticError).code).toBe(code);
    return;
  }
  throw new Error(`Expected WritingDiagnosticError(${code})`);
}

describe('validateWritingDiagnostics', () => {
  it('returns a deeply detached and frozen host-ordered tuple', () => {
    const first = validDiagnostic();
    const second = validDiagnostic({
      diagnosticId: 'diag-2',
      selector: { type: 'TextPositionSelector', start: 8, end: 8 },
      suggestedReplacement: undefined,
      confidence: undefined,
    });
    const input = [first, second];

    const result = validateWritingDiagnostics(input);

    expect(result).toHaveLength(2);
    expect(result.map((entry) => entry.diagnosticId)).toEqual(['diag-1', 'diag-2']);
    expect(result).not.toBe(input);
    expect(result[0]).not.toBe(first);
    expect(result[0].documentRevision).not.toBe(first.documentRevision);
    expect(result[0].selector).not.toBe(first.selector);
    expect(result[0].provenance).not.toBe(first.provenance);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result[0])).toBe(true);
    expect(Object.isFrozen(result[0].documentRevision)).toBe(true);
    expect(Object.isFrozen(result[0].textProjection)).toBe(true);
    expect(Object.isFrozen(result[0].selector)).toBe(true);
    expect(Object.isFrozen(result[0].provenance)).toBe(true);
  });

  it('accepts an empty diagnostic array', () => {
    expect(validateWritingDiagnostics([])).toEqual([]);
  });

  it('rejects duplicate diagnostic identifiers', () => {
    expectCode([validDiagnostic(), validDiagnostic()], 'conflict');
  });

  it('rejects non-array input and array own-property surprises', () => {
    expectCode({}, 'contract');
    const input = [validDiagnostic()];
    Object.defineProperty(input, 'extra', { value: true, enumerable: true });
    expectCode(input, 'contract');
  });

  it('rejects too many diagnostics before inspecting members', () => {
    const member = new Proxy(validDiagnostic(), {
      ownKeys() {
        throw new Error('member should not be inspected');
      },
    });
    const input = Array.from(
      { length: DEFAULT_WRITING_DIAGNOSTIC_LIMITS.maxDiagnostics + 1 },
      () => member,
    );
    expectCode(input, 'limit');
  });

  it('rejects unexpected, inherited, accessor-backed, non-enumerable, and symbol fields', () => {
    expectCode([{ ...validDiagnostic(), unexpected: true }], 'contract');

    const inherited = Object.create({ inherited: 'value' }) as CwlWritingDiagnostic;
    Object.assign(inherited, validDiagnostic());
    expectCode([inherited], 'contract');

    const accessor = { ...validDiagnostic() } as Record<string, unknown>;
    const getter = vi.fn(() => 'secret');
    Object.defineProperty(accessor, 'title', { enumerable: true, get: getter });
    expectCode([accessor], 'contract');
    expect(getter).not.toHaveBeenCalled();

    const hidden = { ...validDiagnostic() } as Record<string, unknown>;
    Object.defineProperty(hidden, 'hidden', { value: true, enumerable: false });
    expectCode([hidden], 'contract');

    const symbol = { ...validDiagnostic(), [Symbol('private')]: true };
    expectCode([symbol], 'contract');
  });

  it('redacts hostile reflection failures', () => {
    const input = [
      new Proxy(validDiagnostic(), {
        ownKeys() {
          throw new Error('private diagnostic payload');
        },
      }),
    ];

    try {
      validateWritingDiagnostics(input);
    } catch (error) {
      expect(error).toBeInstanceOf(WritingDiagnosticError);
      expect((error as Error).message).not.toContain('private diagnostic payload');
      return;
    }
    throw new Error('Expected hostile reflection to fail closed');
  });

  it('bounds identifiers, metadata, prose, and replacement text', () => {
    expectCode(
      [validDiagnostic({ diagnosticId: 'x'.repeat(257) })],
      'limit',
    );
    expectCode(
      [validDiagnostic({ categoryCode: 'x'.repeat(129) })],
      'limit',
    );
    expectCode([validDiagnostic({ title: 'x'.repeat(257) })], 'limit');
    expectCode(
      [validDiagnostic({ explanation: 'x'.repeat(4001) })],
      'limit',
    );
    expectCode(
      [validDiagnostic({ suggestedReplacement: 'x'.repeat(20_001) })],
      'limit',
    );
    expectCode(
      [
        validDiagnostic({
          provenance: {
            workflowId: 'x'.repeat(129),
            workflowVersion: '1',
            judgePolicyVersion: '1',
          },
        }),
      ],
      'limit',
    );
  });

  it('rejects empty required identifiers and malformed string runtime values', () => {
    expectCode([validDiagnostic({ diagnosticId: '' })], 'contract');
    expectCode([validDiagnostic({ categoryCode: '' })], 'contract');
    expectCode([validDiagnostic({ title: '' })], 'contract');
    expectCode(
      [validDiagnostic({ title: 7 as unknown as string })],
      'contract',
    );
    expectCode(
      [
        validDiagnostic({
          suggestedReplacement: 7 as unknown as string,
        }),
      ],
      'contract',
    );
  });

  it('accepts only the finite priority contract', () => {
    for (const priority of ['advisory', 'important', 'critical'] as const) {
      expect(validateWritingDiagnostics([validDiagnostic({ priority })])[0].priority).toBe(
        priority,
      );
    }
    expectCode(
      [validDiagnostic({ priority: 'urgent' as CwlWritingDiagnostic['priority'] })],
      'contract',
    );
  });

  it('accepts confidence only in the closed interval from zero through one', () => {
    expect(validateWritingDiagnostics([validDiagnostic({ confidence: 0 })])[0].confidence).toBe(0);
    expect(validateWritingDiagnostics([validDiagnostic({ confidence: 1 })])[0].confidence).toBe(1);
    for (const confidence of [-0.01, 1.01, Number.NaN, Number.POSITIVE_INFINITY]) {
      expectCode([validDiagnostic({ confidence })], 'contract');
    }
  });

  it('requires an exact SHA-256 revision shape and matching strong entity tag', () => {
    expectCode(
      [
        validDiagnostic({
          documentRevision: {
            algorithm: 'SHA-256',
            digestHex: 'A'.repeat(64),
            strongEntityTag: `"sha256-${'A'.repeat(64)}"`,
          },
        }),
      ],
      'revision',
    );
    expectCode(
      [
        validDiagnostic({
          documentRevision: {
            algorithm: 'SHA-256',
            digestHex: DIGEST,
            strongEntityTag: '"sha256-wrong"',
          },
        }),
      ],
      'revision',
    );
  });

  it('requires the exact supported text projection', () => {
    expectCode(
      [
        validDiagnostic({
          textProjection: {
            id: 'other' as 'inkspan-prosemirror-text',
            version: 1,
          },
        }),
      ],
      'projection',
    );
    expectCode(
      [
        validDiagnostic({
          textProjection: {
            id: 'inkspan-prosemirror-text',
            version: 2 as 1,
          },
        }),
      ],
      'projection',
    );
  });

  it('requires finite non-negative integral selectors in source order', () => {
    for (const selector of [
      { type: 'TextPositionSelector' as const, start: -1, end: 1 },
      { type: 'TextPositionSelector' as const, start: 0.5, end: 1 },
      { type: 'TextPositionSelector' as const, start: 3, end: 2 },
      { type: 'TextPositionSelector' as const, start: 0, end: Number.POSITIVE_INFINITY },
    ]) {
      expectCode([validDiagnostic({ selector })], 'selector');
    }
    expect(
      validateWritingDiagnostics([
        validDiagnostic({
          selector: { type: 'TextPositionSelector', start: 3, end: 3 },
        }),
      ])[0].selector,
    ).toEqual({ type: 'TextPositionSelector', start: 3, end: 3 });
  });

  it('strictly validates provenance without evaluating accessors', () => {
    const getter = vi.fn(() => 'secret');
    const provenance = {
      workflowId: 'wf',
      workflowVersion: '1',
      judgePolicyVersion: '2',
    } as Record<string, unknown>;
    Object.defineProperty(provenance, 'orchestrationMode', {
      enumerable: true,
      get: getter,
    });
    expectCode(
      [validDiagnostic({ provenance: provenance as CwlWritingDiagnostic['provenance'] })],
      'contract',
    );
    expect(getter).not.toHaveBeenCalled();
  });

  it('supports stricter caller limits without mutating defaults', () => {
    const result = validateWritingDiagnostics([validDiagnostic()], {
      ...DEFAULT_WRITING_DIAGNOSTIC_LIMITS,
      maxTitleCodeUnits: 32,
    });
    expect(result[0].title).toBe('Check agreement');
    expectCode(
      [validDiagnostic({ title: 'x'.repeat(33) })],
      'limit',
    );
    expect(DEFAULT_WRITING_DIAGNOSTIC_LIMITS.maxTitleCodeUnits).toBe(256);
  });

  it('rejects malformed limit configuration without reading diagnostics', () => {
    const diagnostics = new Proxy([validDiagnostic()], {
      get() {
        throw new Error('diagnostics should not be read');
      },
    });
    expect(() =>
      validateWritingDiagnostics(diagnostics, {
        ...DEFAULT_WRITING_DIAGNOSTIC_LIMITS,
        maxDiagnostics: 0,
      }),
    ).toThrow(WritingDiagnosticError);
  });
});
