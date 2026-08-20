const MAX_DOCUMENT_ID_CODE_UNITS = 256;
const MAX_DOCUMENT_CODE_UNITS = 65_536;

/** Marker used by repository contracts to prevent this fixture being mistaken for a production adapter. */
export const REFERENCE_ONLY = true;

/** Stable failure raised by the synthetic reference persistence adapter. */
export class ReferencePersistenceError extends Error {
  constructor(code) {
    super(`Reference persistence ${code}.`);
    this.name = 'ReferencePersistenceError';
    this.code = code;
    Object.freeze(this);
  }
}

function requireBoundedString(value, maximumCodeUnits, code) {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > maximumCodeUnits
  ) {
    throw new ReferencePersistenceError(code);
  }
  return value;
}

function validatorForVersion(version) {
  return `"v${version}"`;
}

function frozenRead(document, validator) {
  return Object.freeze({ document, validator });
}

function frozenSave(status, validator) {
  return Object.freeze({ status, validator });
}

function frozenConflict(currentValidator) {
  return Object.freeze({ status: 'conflict', currentValidator });
}

/**
 * Create an in-memory host-owned reference repository with exact If-Match semantics.
 *
 * This adapter is synthetic acquisition/support evidence only. Buyers must replace
 * it with an authorized atomic durable store. Ambiguous or failed operations never
 * mutate the document or advance the strong validator.
 */
export function createSyntheticDocumentRepository(options) {
  if (
    typeof options !== 'object' ||
    options === null ||
    Object.getPrototypeOf(options) !== Object.prototype
  ) {
    throw new ReferencePersistenceError('invalid_options');
  }

  const documentId = requireBoundedString(
    options.documentId,
    MAX_DOCUMENT_ID_CODE_UNITS,
    'invalid_document_id',
  );
  let document = requireBoundedString(
    options.initialDocument,
    MAX_DOCUMENT_CODE_UNITS,
    'invalid_document',
  );
  let version = 1;
  let validator = validatorForVersion(version);

  function assertDocumentId(candidate) {
    if (candidate !== documentId) {
      throw new ReferencePersistenceError('document_not_found');
    }
  }

  function read(candidateDocumentId) {
    assertDocumentId(candidateDocumentId);
    return frozenRead(document, validator);
  }

  function save(request) {
    if (
      typeof request !== 'object' ||
      request === null ||
      Object.getPrototypeOf(request) !== Object.prototype
    ) {
      throw new ReferencePersistenceError('invalid_request');
    }

    assertDocumentId(request.documentId);
    const nextDocument = requireBoundedString(
      request.document,
      MAX_DOCUMENT_CODE_UNITS,
      'invalid_document',
    );
    const ifMatch = requireBoundedString(
      request.ifMatch,
      256,
      'invalid_if_match',
    );
    const outcome = request.outcome ?? 'saved';
    if (
      outcome !== 'saved' &&
      outcome !== 'ambiguous_failure' &&
      outcome !== 'failure'
    ) {
      throw new ReferencePersistenceError('invalid_outcome');
    }

    if (outcome === 'ambiguous_failure') {
      throw new ReferencePersistenceError('ambiguous_failure');
    }
    if (outcome === 'failure') {
      throw new ReferencePersistenceError('failure');
    }
    if (ifMatch !== validator) {
      return frozenConflict(validator);
    }

    document = nextDocument;
    version += 1;
    validator = validatorForVersion(version);
    return frozenSave('saved', validator);
  }

  return Object.freeze({ read, save });
}

function runSelfTest() {
  const repository = createSyntheticDocumentRepository({
    documentId: 'buyer-document',
    initialDocument: 'Buyer draft v1',
  });
  const initial = repository.read('buyer-document');

  let ambiguousFailureObserved = false;
  try {
    repository.save({
      documentId: 'buyer-document',
      document: 'Uncertain write',
      ifMatch: initial.validator,
      outcome: 'ambiguous_failure',
    });
  } catch (error) {
    ambiguousFailureObserved =
      error instanceof ReferencePersistenceError &&
      error.code === 'ambiguous_failure';
  }
  if (!ambiguousFailureObserved) {
    throw new Error('Synthetic ambiguous-failure evidence was not observed.');
  }

  const afterAmbiguous = repository.read('buyer-document');
  if (
    afterAmbiguous.document !== initial.document ||
    afterAmbiguous.validator !== initial.validator
  ) {
    throw new Error('Ambiguous failure advanced synthetic durable state.');
  }

  const saved = repository.save({
    documentId: 'buyer-document',
    document: 'Buyer draft v2',
    ifMatch: initial.validator,
  });
  if (saved.status !== 'saved') {
    throw new Error('Synthetic save did not report success.');
  }

  const conflict = repository.save({
    documentId: 'buyer-document',
    document: 'Stale overwrite',
    ifMatch: initial.validator,
  });
  if (conflict.status !== 'conflict') {
    throw new Error('Synthetic stale If-Match write did not conflict.');
  }

  const finalState = repository.read('buyer-document');
  process.stdout.write(
    `${JSON.stringify({
      afterAmbiguousValidator: afterAmbiguous.validator,
      conflictCurrentValidator: conflict.currentValidator,
      finalDocument: finalState.document,
      finalValidator: finalState.validator,
      initialValidator: initial.validator,
      savedValidator: saved.validator,
    })}\n`,
  );
}

if (process.argv.includes('--self-test')) {
  runSelfTest();
}
