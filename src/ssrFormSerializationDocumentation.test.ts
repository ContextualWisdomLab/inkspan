import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/** Read one authoritative repository artifact for a deterministic docs contract. */
function repositoryText(path: string): string {
  return readFileSync(path, 'utf8');
}

describe('SSR native form serialization doctoring', () => {
  it('records the opt-in value, hydration, and host security boundaries', () => {
    const serverRendering = repositoryText('docs/server-rendering.md');
    const doctoring = repositoryText(
      'docs/doctoring/ssr-native-form-serialization.md',
    );
    const changelog = repositoryText('CHANGELOG.md');

    expect(serverRendering).toContain('formFieldName');
    expect(serverRendering).toContain('server-rendered hidden field');
    expect(serverRendering).toContain('client-controlled submission data');
    expect(serverRendering).toContain('CollaborativeCwlEditor');
    expect(doctoring).toContain('fb37cd9a4344a3b369553c49eb4bf557c082c7da');
    expect(doctoring).toContain('31177509823');
    expect(doctoring).toContain('defaultValue');
    expect(doctoring).toContain('hydrateRoot');
    expect(doctoring).toContain('WHATWG');
    expect(doctoring).toContain('OWASP Foundation');
    expect(doctoring).toContain('APA 7 references');
    expect(changelog).toContain('SSR native form field');
  });
});
