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
    expect(nativeFormHostSource).toContain('createSingleFlightSubmission');
    expect(nativeFormHostSource).toContain(
      'onAuthorizedSubmitRef.current(messageBody)',
    );
    expect(nativeFormHostSource).toContain(
      'await submitAuthorized(messageBodyEntry)',
    );
    expect(nativeFormHostSource).toContain(
      "disabled={readOnly || submissionState === 'saving'}",
    );
    expect(nativeFormHostSource).not.toContain('fetch(');
    expect(nativeFormHostSource).not.toContain('localStorage');
  });

  it('blocks form reset while durable submission is in flight and marks a later reset unsaved', () => {
    expect(nativeFormHostSource).toContain(
      '<form onSubmit={handleSubmit} onReset={handleReset}>',
    );
    expect(nativeFormHostSource).toContain(
      "if (readOnly || submissionState === 'saving') {",
    );
    expect(nativeFormHostSource).toContain('event.preventDefault();');
    expect(nativeFormHostSource).toContain("setSubmissionState('idle');");
    expect(nativeFormHostSource).toMatch(
      /type="reset"\s+disabled=\{readOnly \|\| submissionState === 'saving'\}/u,
    );
  });

  it('makes host write permission explicit and fail-closes native form writes while read-only', () => {
    expect(nativeFormHostSource).toContain('readOnly?: boolean;');
    expect(nativeFormHostSource).toContain('readOnly = false');
    expect(nativeFormHostSource).toContain('editable={!readOnly}');
    expect(nativeFormHostSource).toContain('formFieldDisabled={readOnly}');
    expect(nativeFormHostSource).toContain(
      "if (readOnly || submissionState === 'saving') {",
    );
    expect(nativeFormHostSource).toMatch(
      /type="submit"\s+disabled=\{readOnly \|\| submissionState === 'saving'\}/u,
    );
    expect(nativeFormHostSource).toMatch(
      /type="reset"\s+disabled=\{readOnly \|\| submissionState === 'saving'\}/u,
    );
  });
});
