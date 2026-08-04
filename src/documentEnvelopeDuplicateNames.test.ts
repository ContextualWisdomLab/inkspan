import { describe, expect, it } from 'vitest';
import {
  DOCUMENT_ENVELOPE_SCHEMA_ID,
  DocumentEnvelopeError,
  parseDocumentEnvelope,
} from './documentEnvelope.js';

const envelopePrefix = `{"schemaId":"${DOCUMENT_ENVELOPE_SCHEMA_ID}","schemaVersion":1,"documentJson":`;

describe('document envelope duplicate-name rejection', () => {
  it('rejects duplicate envelope fields before JSON.parse discards them', () => {
    const source = `{"schemaId":"${DOCUMENT_ENVELOPE_SCHEMA_ID}","schemaId":"https://attacker.invalid/schema","schemaVersion":1,"documentJson":{"type":"doc"}}`;

    expect(() => parseDocumentEnvelope(source)).toThrow(
      DocumentEnvelopeError,
    );
    expect(() => parseDocumentEnvelope(source)).toThrow(
      'must not contain duplicate object names',
    );
  });

  it('rejects duplicate and escaped-equivalent names in document JSON', () => {
    expect(() =>
      parseDocumentEnvelope(
        `${envelopePrefix}{"type":"doc","attrs":{"role":"safe","role":"unsafe"}}}`,
      ),
    ).toThrow('must not contain duplicate object names');

    expect(() =>
      parseDocumentEnvelope(
        `${envelopePrefix}{"type":"doc","attrs":{"name":"first","\\u006eame":"second"}}}`,
      ),
    ).toThrow('must not contain duplicate object names');
  });

  it('does not disclose duplicate names or values in the public error', () => {
    const source = `${envelopePrefix}{"type":"doc","attrs":{"tenant-secret":"first-value","tenant-secret":"second-value"}}}`;

    try {
      parseDocumentEnvelope(source);
      throw new Error('Expected duplicate-name rejection');
    } catch (error) {
      expect(error).toBeInstanceOf(DocumentEnvelopeError);
      expect(String(error)).not.toContain('tenant-secret');
      expect(String(error)).not.toContain('first-value');
      expect(String(error)).not.toContain('second-value');
    }
  });

  it('preserves valid JSON diagnostics for malformed duplicate-free text', () => {
    expect(() =>
      parseDocumentEnvelope('{"schemaId":"unterminated"'),
    ).toThrow('must contain valid JSON');
  });
});
