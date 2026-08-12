import { describe, expect, it } from 'vitest';
import {
  WritingDiagnosticError,
  validateWritingDiagnostics,
  type CwlWritingDiagnostic,
  type WritingDiagnosticLimits,
} from './writingDiagnostics.js';

const DIGEST = 'b'.repeat(64);

function diagnostic(
  overrides: Partial<CwlWritingDiagnostic> = {},
): CwlWritingDiagnostic {
  return {
    diagnosticId: 'boundary-diagnostic',
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
      start: 0,
      end: 1,
    },
    categoryCode: 'host.category',
    priority: 'advisory',
    title: 'Host title',
    explanation: '',
    provenance: {
      workflowId: 'workflow',
      workflowVersion: '1',
      judgePolicyVersion: '1',
    },
    ...overrides,
  };
}

function expectCode(
  input: unknown,
  code: WritingDiagnosticError['code'],
  limits?: WritingDiagnosticLimits,
): void {
  try {
    validateWritingDiagnostics(input, limits);
  } catch (error) {
    expect(error).toBeInstanceOf(WritingDiagnosticError);
    expect((error as WritingDiagnosticError).code).toBe(code);
    return;
  }
  throw new Error(`Expected WritingDiagnosticError(${code})`);
}

describe('writing diagnostic hostile-boundary coverage', () => {
  it('accepts a genuinely partial stricter-limit object', () => {
    const result = validateWritingDiagnostics([diagnostic()], {
      maxTitleCodeUnits: 32,
    });

    expect(result[0].title).toBe('Host title');
  });

  it('rejects non-object diagnostic and nested contract values', () => {
    expectCode([null], 'contract');
    expectCode([[]], 'contract');
    expectCode(['diagnostic'], 'contract');
    expectCode(
      [diagnostic({ documentRevision: [] as unknown as CwlWritingDiagnostic['documentRevision'] })],
      'revision',
    );
  });

  it('rejects a missing required own field', () => {
    const { title: omittedTitle, ...missingTitle } = diagnostic();
    expect(omittedTitle).toBe('Host title');

    expectCode([missingTitle], 'contract');
  });

  it('redacts a revoked array proxy before any member access', () => {
    const revocable = Proxy.revocable([diagnostic()], {});
    revocable.revoke();

    expectCode(revocable.proxy, 'contract');
  });

  it('rejects an invalid array length descriptor', () => {
    const target = [diagnostic()];
    const input = new Proxy(target, {
      getOwnPropertyDescriptor(currentTarget, key) {
        if (key === 'length') {
          return {
            value: '1',
            writable: true,
            enumerable: false,
            configurable: false,
          };
        }
        return Reflect.getOwnPropertyDescriptor(currentTarget, key);
      },
    });

    expectCode(input, 'contract');
  });

  it('redacts an array own-key reflection failure', () => {
    const input = new Proxy([diagnostic()], {
      ownKeys() {
        throw new Error('private array key material');
      },
    });

    expectCode(input, 'contract');
  });

  it('rejects a dense-array key set that omits the required index', () => {
    const target = [diagnostic()];
    const replacement = diagnostic({ diagnosticId: 'replacement' });
    const input = new Proxy(target, {
      ownKeys() {
        return ['1', 'length'];
      },
      getOwnPropertyDescriptor(currentTarget, key) {
        if (key === '1') {
          return {
            value: replacement,
            writable: true,
            enumerable: true,
            configurable: true,
          };
        }
        return Reflect.getOwnPropertyDescriptor(currentTarget, key);
      },
    });

    expectCode(input, 'contract');
  });

  it('rejects an index hidden after the exact key inventory', () => {
    const target = [diagnostic()];
    const input = new Proxy(target, {
      getOwnPropertyDescriptor(currentTarget, key) {
        if (key === '0') {
          return undefined;
        }
        return Reflect.getOwnPropertyDescriptor(currentTarget, key);
      },
    });

    expectCode(input, 'contract');
  });

  it('rejects an accessor-backed array member without evaluating it', () => {
    const input: unknown[] = [];
    Object.defineProperty(input, '0', {
      enumerable: true,
      configurable: true,
      get() {
        throw new Error('array accessor must never execute');
      },
    });

    expectCode(input, 'contract');
  });

  it('redacts an own-property-descriptor reflection failure', () => {
    const input = new Proxy([diagnostic()], {
      getOwnPropertyDescriptor(currentTarget, key) {
        if (key === 'length') {
          throw new Error('private descriptor material');
        }
        return Reflect.getOwnPropertyDescriptor(currentTarget, key);
      },
    });

    expectCode(input, 'contract');
  });
});
