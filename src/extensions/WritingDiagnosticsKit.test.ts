import { describe, expect, it } from 'vitest';
import { buildExtensions } from './kit.js';

describe('shared WritingDiagnostics extension graph', () => {
  it('installs the decoration extension exactly once in the default graph', () => {
    const names = buildExtensions().map((extension) => extension.name);

    expect(names.filter((name) => name === 'writingDiagnostics')).toHaveLength(1);
  });

  it('does not duplicate the shared extension when hosts append other extensions', () => {
    const additional = buildExtensions().find(
      (extension) => extension.name === 'placeholder',
    );
    if (!additional) throw new Error('Missing additional extension fixture');

    const names = buildExtensions({ additionalExtensions: [additional] }).map(
      (extension) => extension.name,
    );

    expect(names.filter((name) => name === 'writingDiagnostics')).toHaveLength(1);
  });
});
