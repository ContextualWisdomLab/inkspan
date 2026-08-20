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

function requireBoundedDocument(value, code) {
  if (typeof value !== 'string' || value.length > MAX_DOCUMENT_CODE_UNITS) {
    throw new ReferencePersistenceError(code);
  }
  return value;
}

function readPlainDataRecord(source, requiredKeys, optionalKeys, code) {
  try {
    if (
      typeof source !== 'object' ||
      source === null ||
      Object.getPrototypeOf(source) !== Object.prototype
    ) {
      throw new ReferencePersistenceError(code);
    }

    const values = Object.create(null);
    for (const key of requiredKeys) {
      const descriptor = Object.getOwnPropertyDescriptor(source, key);
      if (
        descriptor === undefined ||
        !Object.prototype.hasOwnProperty.call(descriptor, 'value')
      ) {
        throw new ReferencePersistenceError(code);
      }
      values[key] = descriptor.value;
    }
    for (const key of optionalKeys) {
      const descriptor = Object.getOwnPropertyDescriptor(source, key);
      if (descriptor === undefined) continue;
      if (!Object.prototype.hasOwnProperty.call(descriptor, 'value')) {
        throw new ReferencePersistenceError(code);
      }
      values[key] = descriptor.value;
    }
    return values;
  } catch {
    throw new ReferencePersistenceError(code);
  }
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
 * mutate the document or advance the strong validator. A confirmed fork requires
 * the current strong validator and starts an independent repository at a fresh
 * validator so source and fork cannot silently share revision authority.
 * Configuration, save, and fork request fields are snapshotted from own data
 * properties without invoking caller-owned accessors.
 */
export function createSyntheticDocumentRepository(options) {
  const configuration = readPlainDataRecord(
    options,
    ['documentId', 'initialDocument'],
    [],
    'invalid_options',
  );
  const documentId = requireBoundedString(
    configuration.documentId,
    MAX_DOCUMENT_ID_CODE_UNITS,
    'invalid_document_id',
  );
  let document = requireBoundedDocument(
    configuration.initialDocument,
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
    const candidate = readPlainDataRecord(
      request,
      ['documentId', 'document', 'ifMatch'],
      ['outcome'],
      'invalid_request',
    );

    assertDocumentId(candidate.documentId);
    const nextDocument = requireBoundedDocument(
      candidate.document,
      'invalid_document',
    );
    const ifMatch = requireBoundedString(
      candidate.ifMatch,
      256,
      'invalid_if_match',
    );
    const outcome = candidate.outcome ?? 'saved';
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

  function fork(request) {
    const candidate = readPlainDataRecord(
      request,
      ['documentId', 'forkDocumentId', 'ifMatch'],
      [],
      'invalid_fork_request',
    );

    assertDocumentId(candidate.documentId);
    const forkDocumentId = requireBoundedString(
      candidate.forkDocumentId,
      MAX_DOCUMENT_ID_CODE_UNITS,
      'invalid_fork_document_id',
    );
    const ifMatch = requireBoundedString(
      candidate.ifMatch,
      256,
      'invalid_if_match',
    );
    if (ifMatch !== validator) {
      return frozenConflict(validator);
    }
    if (forkDocumentId === documentId) {
      throw new ReferencePersistenceError('invalid_fork_document_id');
    }

    return Object.freeze({
      status: 'forked',
      repository: createSyntheticDocumentRepository({
        documentId: forkDocumentId,
        initialDocument: document,
      }),
    });
  }

  return Object.freeze({ fork, read, save });
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

  let failureObserved = false;
  try {
    repository.save({
      documentId: 'buyer-document',
      document: 'Buyer draft v3',
      ifMatch: saved.validator,
      outcome: 'failure',
    });
  } catch (error) {
    failureObserved =
      error instanceof ReferencePersistenceError && error.code === 'failure';
  }
  if (!failureObserved) {
    throw new Error('Synthetic failure evidence was not observed.');
  }

  const afterFailure = repository.read('buyer-document');
  if (
    afterFailure.document !== 'Buyer draft v2' ||
    afterFailure.validator !== saved.validator
  ) {
    throw new Error('Failure advanced synthetic durable state.');
  }

  const retried = repository.save({
    documentId: 'buyer-document',
    document: 'Buyer draft v3',
    ifMatch: afterFailure.validator,
  });
  if (retried.status !== 'saved') {
    throw new Error('Synthetic retry did not report success.');
  }

  const restored = repository.save({
    documentId: 'buyer-document',
    document: initial.document,
    ifMatch: retried.validator,
  });
  if (restored.status !== 'saved') {
    throw new Error('Synthetic restore did not report success.');
  }

  const forked = repository.fork({
    documentId: 'buyer-document',
    forkDocumentId: 'buyer-document-fork',
    ifMatch: restored.validator,
  });
  if (forked.status !== 'forked') {
    throw new Error('Synthetic fork did not report success.');
  }
  const forkInitial = forked.repository.read('buyer-document-fork');
  const forkSaved = forked.repository.save({
    documentId: 'buyer-document-fork',
    document: 'Fork-only edit',
    ifMatch: forkInitial.validator,
  });
  if (forkSaved.status !== 'saved') {
    throw new Error('Synthetic fork save did not report success.');
  }

  const forkFinal = forked.repository.read('buyer-document-fork');
  const sourceAfterFork = repository.read('buyer-document');
  process.stdout.write(
    `${JSON.stringify({
      afterAmbiguousValidator: afterAmbiguous.validator,
      afterFailureValidator: afterFailure.validator,
      conflictCurrentValidator: conflict.currentValidator,
      forkDocument: forkInitial.document,
      forkFinalDocument: forkFinal.document,
      forkInitialValidator: forkInitial.validator,
      forkSavedValidator: forkSaved.validator,
      initialValidator: initial.validator,
      restoredValidator: restored.validator,
      retrySavedValidator: retried.validator,
      savedValidator: saved.validator,
      sourceDocumentAfterFork: sourceAfterFork.document,
      sourceValidatorAfterFork: sourceAfterFork.validator,
    })}\n`,
  );
}

function runEmptyDocumentSelfTest() {
  const emptyRepository = createSyntheticDocumentRepository({
    documentId: 'buyer-empty',
    initialDocument: '',
  });
  const initialEmptyDocument = emptyRepository.read('buyer-empty').document;

  const repository = createSyntheticDocumentRepository({
    documentId: 'buyer-document',
    initialDocument: 'Not empty',
  });
  const initial = repository.read('buyer-document');
  const cleared = repository.save({
    documentId: 'buyer-document',
    document: '',
    ifMatch: initial.validator,
  });
  if (cleared.status !== 'saved') {
    throw new Error('Synthetic empty-document save did not report success.');
  }
  const afterClear = repository.read('buyer-document');

  let emptyDocumentIdError = null;
  try {
    createSyntheticDocumentRepository({
      documentId: '',
      initialDocument: '',
    });
  } catch (error) {
    emptyDocumentIdError =
      error instanceof ReferencePersistenceError ? error.code : 'unexpected_error';
  }

  process.stdout.write(
    `${JSON.stringify({
      clearedDocument: afterClear.document,
      clearedValidator: afterClear.validator,
      emptyDocumentIdError,
      initialEmptyDocument,
    })}\n`,
  );
}

function runHostileAccessorSelfTest() {
  let optionGetterCalls = 0;
  let optionErrorCode = null;
  const hostileOptions = { initialDocument: 'Buyer draft v1' };
  Object.defineProperty(hostileOptions, 'documentId', {
    enumerable: true,
    get() {
      optionGetterCalls += 1;
      return 'buyer-document';
    },
  });
  try {
    createSyntheticDocumentRepository(hostileOptions);
  } catch (error) {
    optionErrorCode =
      error instanceof ReferencePersistenceError ? error.code : 'unexpected_error';
  }

  const repository = createSyntheticDocumentRepository({
    documentId: 'buyer-document',
    initialDocument: 'Buyer draft v1',
  });
  const initial = repository.read('buyer-document');
  let requestGetterCalls = 0;
  let requestErrorCode = null;
  const hostileRequest = {
    documentId: 'buyer-document',
    ifMatch: initial.validator,
  };
  Object.defineProperty(hostileRequest, 'document', {
    enumerable: true,
    get() {
      requestGetterCalls += 1;
      return 'Hostile write';
    },
  });
  try {
    repository.save(hostileRequest);
  } catch (error) {
    requestErrorCode =
      error instanceof ReferencePersistenceError ? error.code : 'unexpected_error';
  }

  let forkGetterCalls = 0;
  let forkErrorCode = null;
  const hostileFork = {
    documentId: 'buyer-document',
    ifMatch: initial.validator,
  };
  Object.defineProperty(hostileFork, 'forkDocumentId', {
    enumerable: true,
    get() {
      forkGetterCalls += 1;
      return 'buyer-document-fork';
    },
  });
  try {
    repository.fork(hostileFork);
  } catch (error) {
    forkErrorCode =
      error instanceof ReferencePersistenceError ? error.code : 'unexpected_error';
  }

  process.stdout.write(
    `${JSON.stringify({
      forkErrorCode,
      forkGetterCalls,
      optionErrorCode,
      optionGetterCalls,
      requestErrorCode,
      requestGetterCalls,
    })}\n`,
  );
}

if (process.argv.includes('--empty-document-self-test')) {
  runEmptyDocumentSelfTest();
} else if (process.argv.includes('--hostile-accessor-self-test')) {
  runHostileAccessorSelfTest();
} else if (process.argv.includes('--self-test')) {
  runSelfTest();
}
