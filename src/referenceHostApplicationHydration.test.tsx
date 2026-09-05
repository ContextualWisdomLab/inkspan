import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const applicationPath = resolve(
  process.cwd(),
  'examples/reference-host/reference-host-app.tsx',
);
const clientBoundaryPath = resolve(
  process.cwd(),
  'examples/reference-host/reference-host-client.tsx',
);
const applicationSource = readFileSync(applicationPath, 'utf8');
const clientBoundarySource = existsSync(clientBoundaryPath)
  ? readFileSync(clientBoundaryPath, 'utf8')
  : '';
const nativeFormSource = readFileSync(
  resolve(process.cwd(), 'examples/reference-host/native-form-host.tsx'),
  'utf8',
);

describe('reference-host application hydration contract', () => {
  it('keeps the deterministic server shell outside a narrow client hydration boundary', () => {
    expect(applicationSource.startsWith("'use client';\n")).toBe(false);
    expect(applicationSource).toContain(
      "from './reference-host-client.js'",
    );
    expect(clientBoundarySource.startsWith("'use client';\n")).toBe(true);
    expect(applicationSource).toContain(
      '<main aria-labelledby="reference-host-heading">',
    );
    expect(applicationSource).toContain('<ReferenceHostClient');
    expect(applicationSource).not.toContain('<ReferenceHostHydrationGate');
    expect(applicationSource).not.toContain('<NativeFormHost');
    expect(clientBoundarySource).toContain(
      "from './hydration-gate.js'",
    );
    expect(clientBoundarySource).toContain(
      "from './native-form-host.js'",
    );
    expect(clientBoundarySource).toContain('<ReferenceHostHydrationGate');
    expect(clientBoundarySource).toContain('renderEditor={() => (');
    expect(clientBoundarySource).toContain('<NativeFormHost');
    expect(clientBoundarySource).toContain(
      'onAuthorizedSubmit={onAuthorizedSubmit}',
    );
    expect(clientBoundarySource).toContain('readOnly={readOnly}');
  });

  it('forwards the declared controlled or uncontrolled composition mode through the client boundary', () => {
    expect(applicationSource).toContain("controlMode = 'uncontrolled'");
    expect(applicationSource).toContain('controlMode={controlMode}');
    expect(clientBoundarySource).toContain('controlMode={controlMode}');
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
    expect(clientBoundarySource).not.toContain('/src/');
    expect(clientBoundarySource).not.toContain('../../src');
    expect(clientBoundarySource).not.toContain('fetch(');
    expect(clientBoundarySource).not.toContain('localStorage');
    expect(clientBoundarySource).not.toContain('process.env');
  });
});