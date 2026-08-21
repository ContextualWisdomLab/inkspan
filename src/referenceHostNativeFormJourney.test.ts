import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const nativeFormHostSource = readFileSync(
  resolve(process.cwd(), 'examples/reference-host/native-form-host.tsx'),
  'utf8',
);

describe('reference-host native form journey', () => {
  it('uses the published editor package and delegates serialization to Inkspan native form integration', () => {
    expect(nativeFormHostSource).toContain(
      "from '@contextualwisdomlab/cwl-editor'",
    );
    expect(nativeFormHostSource).toContain('formFieldName="message_body"');
    expect(nativeFormHostSource).toContain('formResetValue="# Draft"');
    expect(nativeFormHostSource).toContain('new FormData(event.currentTarget)');
    expect(nativeFormHostSource).toContain('type="submit"');
    expect(nativeFormHostSource).toContain('type="reset"');

    expect(nativeFormHostSource).not.toMatch(/<input[^>]+type=["']hidden["']/i);
    expect(nativeFormHostSource).not.toContain('/src/');
    expect(nativeFormHostSource).not.toContain('../../src');
  });

  it('keeps host authorization and durable persistence explicitly outside the component submit callback', () => {
    expect(nativeFormHostSource).toContain('onAuthorizedSubmit');
    expect(nativeFormHostSource).toContain('await onAuthorizedSubmit(messageBody)');
    expect(nativeFormHostSource).not.toContain('fetch(');
    expect(nativeFormHostSource).not.toContain('localStorage');
  });
});
