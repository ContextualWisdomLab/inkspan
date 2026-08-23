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

  it('binds submit/reset admission to the synchronous durable gate rather than deferred presentation state', () => {
    expect(
      nativeFormHostSource.match(
        /if \(readOnly \|\| submitAuthorized\.isInFlight\(\)\) \{/gu,
      ),
    ).toHaveLength(2);
    expect(nativeFormHostSource).not.toContain(
      "if (readOnly || submissionState === 'saving') {",
    );
  });

  it('blocks form reset while durable submission is in flight and marks a later reset unsaved', () => {
    expect(nativeFormHostSource).toMatch(
      /onInput=\{handleNativeInput\}\s+onSubmit=\{handleSubmit\}\s+onReset=\{handleReset\}/u,
    );
    expect(nativeFormHostSource).toContain('submitAuthorized.isInFlight()');
    expect(nativeFormHostSource).toContain('event.preventDefault();');
    expect(nativeFormHostSource).toContain("setSubmissionState('idle');");
    expect(nativeFormHostSource).toMatch(
      /type="reset"\s+disabled=\{readOnly \|\| submissionState === 'saving'\}/u,
    );
  });

  it('invalidates stale persistence presentation through independent editor and native-input mutation signals', () => {
    expect(nativeFormHostSource).toContain('const documentGenerationRef = useRef(0);');
    expect(nativeFormHostSource).toContain('function markDocumentDirty() {');
    expect(nativeFormHostSource).toContain(
      'documentGenerationRef.current += 1;',
    );
    expect(nativeFormHostSource).toContain(
      'const submittedGeneration = documentGenerationRef.current;',
    );
    expect(nativeFormHostSource).toContain(
      'if (documentGenerationRef.current !== submittedGeneration) {',
    );
    expect(nativeFormHostSource).toContain(
      "setSubmissionState((state) => (state === 'saving' ? state : 'idle'));",
    );
    expect(nativeFormHostSource).toContain('onChange={handleDocumentChange}');
    expect(nativeFormHostSource).toContain('function handleNativeInput() {');
    expect(nativeFormHostSource).toContain('onInput={handleNativeInput}');
    expect(
      nativeFormHostSource.match(/markDocumentDirty\(\);/gu),
    ).toHaveLength(2);
  });

  it('makes host write permission explicit and fail-closes native form writes while read-only', () => {
    expect(nativeFormHostSource).toContain('readOnly?: boolean;');
    expect(nativeFormHostSource).toContain('readOnly = false');
    expect(nativeFormHostSource).toContain('editable={!readOnly}');
    expect(nativeFormHostSource).toContain('formFieldDisabled={readOnly}');
    expect(nativeFormHostSource).toContain(
      'if (readOnly || submitAuthorized.isInFlight()) {',
    );
    expect(nativeFormHostSource).toMatch(
      /type="submit"\s+disabled=\{readOnly \|\| submissionState === 'saving'\}/u,
    );
    expect(nativeFormHostSource).toMatch(
      /type="reset"\s+disabled=\{readOnly \|\| submissionState === 'saving'\}/u,
    );
  });

  it('demonstrates both uncontrolled and host-controlled editor composition without moving persistence authority into Inkspan', () => {
    expect(nativeFormHostSource).toContain(
      "controlMode?: 'controlled' | 'uncontrolled';",
    );
    expect(nativeFormHostSource).toContain("controlMode = 'uncontrolled'");
    expect(nativeFormHostSource).toContain(
      'data-reference-host-control-mode={controlMode}',
    );
    expect(nativeFormHostSource).toContain(
      "const [controlledValue, setControlledValue] = useState('# Draft');",
    );
    expect(nativeFormHostSource).toContain(
      "value={controlMode === 'controlled' ? controlledValue : undefined}",
    );
    expect(nativeFormHostSource).toContain('onChange={handleDocumentChange}');
    expect(nativeFormHostSource).toContain(
      "defaultValue={controlMode === 'uncontrolled' ? '# Draft' : undefined}",
    );
    expect(nativeFormHostSource).toContain(
      "if (controlMode === 'controlled') {",
    );
    expect(nativeFormHostSource).toContain("setControlledValue('# Draft');");
  });
});
