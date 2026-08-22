import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const applicationSource = readFileSync(
  resolve(process.cwd(), 'examples/reference-host/reference-host-app.tsx'),
  'utf8',
);
const nativeFormSource = readFileSync(
  resolve(process.cwd(), 'examples/reference-host/native-form-host.tsx'),
  'utf8',
);

describe('reference-host application hydration contract', () => {
  it('keeps a deterministic server shell and mounts the real native-form host through the client hydration gate', () => {
    expect(applicationSource.startsWith("'use client';\n")).toBe(true);
    expect(applicationSource).toContain(
      "from './hydration-gate.js'",
    );
    expect(applicationSource).toContain(
      "from './native-form-host.js'",
    );
    expect(applicationSource).toContain(
      '<main aria-labelledby="reference-host-heading">',
    );
    expect(applicationSource).toContain(
      '<ReferenceHostHydrationGate',
    );
    expect(applicationSource).toContain(
      'renderEditor={() => (',
    );
    expect(applicationSource).toContain(
      '<NativeFormHost',
    );
    expect(applicationSource).toContain(
      'onAuthorizedSubmit={onAuthorizedSubmit}',
    );
    expect(applicationSource).toContain('readOnly={readOnly}');
  });

  it('preserves the public-package and host-authority boundary for the hydrated form', () => {
    expect(nativeFormSource).toContain(
      "from '@contextualwisdomlab/cwl-editor'",
    );
    expect(nativeFormSource).toContain('formFieldName="message_body"');
    expect(applicationSource).not.toContain('/src/');
    expect(applicationSource).not.toContain('../../src');
    expect(applicationSource).not.toContain('fetch(');
    expect(applicationSource).not.toContain('localStorage');
    expect(applicationSource).not.toContain('process.env');
  });
});
