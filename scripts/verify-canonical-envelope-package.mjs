import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const packageName = '@contextualwisdomlab/cwl-editor';
const require = createRequire(import.meta.url);
const esmPackage = await import(packageName);
const commonJsPackage = require(packageName);

/** Verify one published module-system surface of the canonical envelope API. */
function verifyModuleSurface(moduleSurface) {
  assert.equal(typeof moduleSurface.createDocumentEnvelope, 'function');
  assert.equal(typeof moduleSurface.serializeDocumentEnvelope, 'function');
  assert.equal(typeof moduleSurface.encodeDocumentEnvelope, 'function');

  const envelope = moduleSurface.createDocumentEnvelope({
    type: 'doc',
    attrs: { beta: 2, alpha: 1 },
  });
  const canonicalJson = moduleSurface.serializeDocumentEnvelope(envelope);
  assert.equal(
    canonicalJson,
    '{"documentJson":{"attrs":{"alpha":1,"beta":2},"type":"doc"},"schemaId":"https://inkspan.io/schemas/document-envelope/v1","schemaVersion":1}',
  );
  assert.deepEqual(
    [...moduleSurface.encodeDocumentEnvelope(envelope)],
    [...new TextEncoder().encode(canonicalJson)],
  );
}

verifyModuleSurface(esmPackage);
verifyModuleSurface(commonJsPackage);
console.log('Verified canonical envelope APIs through ESM and CommonJS.');
