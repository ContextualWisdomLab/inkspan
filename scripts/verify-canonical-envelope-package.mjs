import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const packageName = '@contextualwisdomlab/cwl-editor';
const require = createRequire(import.meta.url);
const esmPackage = await import(packageName);
const commonJsPackage = require(packageName);

/** Verify one published module-system surface of the canonical envelope API. */
function verifyModuleSurface(moduleSurface) {
  assert.equal(typeof moduleSurface.createDocumentEnvelope, 'function');
  assert.equal(typeof moduleSurface.parseDocumentEnvelope, 'function');
  assert.equal(typeof moduleSurface.parseDocumentEnvelopeBytes, 'function');
  assert.equal(typeof moduleSurface.serializeDocumentEnvelope, 'function');
  assert.equal(typeof moduleSurface.encodeDocumentEnvelope, 'function');
  assert.deepEqual(moduleSurface.DEFAULT_DOCUMENT_ENVELOPE_LIMITS, {
    maxUtf8Bytes: 64 * 1024 * 1024,
    maxJsonTextCodeUnits: 64 * 1024 * 1024,
    maxJsonValues: 1_000_000,
    maxStringCodeUnits: 32 * 1024 * 1024,
    maxNestingDepth: 128,
  });
  assert.equal(
    Object.isFrozen(moduleSurface.DEFAULT_DOCUMENT_ENVELOPE_LIMITS),
    true,
  );

  const envelope = moduleSurface.createDocumentEnvelope({
    type: 'doc',
    attrs: { beta: 2, alpha: 1 },
  });
  const canonicalJson = moduleSurface.serializeDocumentEnvelope(envelope);
  const canonicalBytes = moduleSurface.encodeDocumentEnvelope(envelope);
  assert.equal(
    canonicalJson,
    '{"documentJson":{"attrs":{"alpha":1,"beta":2},"type":"doc"},"schemaId":"https://inkspan.io/schemas/document-envelope/v1","schemaVersion":1}',
  );
  assert.deepEqual(
    [...canonicalBytes],
    [...new TextEncoder().encode(canonicalJson)],
  );
  assert.deepEqual(
    moduleSurface.parseDocumentEnvelope(canonicalJson, {
      maxJsonTextCodeUnits: canonicalJson.length,
    }),
    envelope,
  );
  assert.deepEqual(
    moduleSurface.parseDocumentEnvelopeBytes(canonicalBytes, {
      maxUtf8Bytes: canonicalBytes.byteLength,
    }),
    envelope,
  );
  assert.throws(
    () =>
      moduleSurface.parseDocumentEnvelope(canonicalJson, {
        maxJsonTextCodeUnits: canonicalJson.length - 1,
      }),
    /JSON text exceeds/u,
  );
  assert.throws(
    () =>
      moduleSurface.parseDocumentEnvelopeBytes(canonicalBytes, {
        maxUtf8Bytes: canonicalBytes.byteLength - 1,
      }),
    /UTF-8 bytes exceed/u,
  );
}

verifyModuleSurface(esmPackage);
verifyModuleSurface(commonJsPackage);
console.log('Verified canonical envelope APIs through ESM and CommonJS.');
