const MAX_REVISION_CODE_UNITS = 256;
const MAX_PROPOSAL_CODE_UNITS = 65_536;

/** Marker used by repository contracts to prevent this fixture being mistaken for a production model adapter. */
export const REFERENCE_ONLY = true;

function requireBoundedString(value, maximumCodeUnits, label) {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > maximumCodeUnits
  ) {
    throw new TypeError(`${label} is invalid.`);
  }
  return value;
}

function readPlainDataRecord(source, keys, message) {
  try {
    if (
      typeof source !== 'object' ||
      source === null ||
      Object.getPrototypeOf(source) !== Object.prototype
    ) {
      throw new TypeError(message);
    }

    const values = Object.create(null);
    for (const key of keys) {
      const descriptor = Object.getOwnPropertyDescriptor(source, key);
      if (
        descriptor === undefined ||
        !Object.prototype.hasOwnProperty.call(descriptor, 'value')
      ) {
        throw new TypeError(message);
      }
      values[key] = descriptor.value;
    }
    return values;
  } catch (error) {
    if (error instanceof TypeError && error.message === message) throw error;
    throw new TypeError(message);
  }
}

/**
 * Produce one deterministic asynchronous proposal bound to the revision captured by the host.
 *
 * This fixture deliberately contains no provider SDK, credential, prompt log, or remote call.
 * Real hosts replace proposal generation with an approved model boundary while preserving the
 * expectedRevision conflict gate before applying untrusted proposal data. Candidate fields are
 * snapshotted from own data properties without invoking caller-owned accessors.
 */
export async function createDelayedProposal(source) {
  const input = readPlainDataRecord(
    source,
    ['expectedRevision', 'replacement'],
    'proposal creation is invalid.',
  );
  const boundedRevision = requireBoundedString(
    input.expectedRevision,
    MAX_REVISION_CODE_UNITS,
    'expectedRevision',
  );
  const boundedReplacement = requireBoundedString(
    input.replacement,
    MAX_PROPOSAL_CODE_UNITS,
    'replacement',
  );

  await Promise.resolve();
  return Object.freeze({
    expectedRevision: boundedRevision,
    replacement: boundedReplacement,
  });
}

/**
 * Apply one untrusted proposal only when the host's current revision still matches its capture.
 * Top-level application metadata and model proposal fields must be own data properties so
 * validation never executes accessor-backed untrusted proposal data.
 */
export function applyDelayedProposal(source) {
  const application = readPlainDataRecord(
    source,
    ['proposal', 'currentRevision', 'apply'],
    'proposal application is invalid.',
  );
  if (typeof application.apply !== 'function') {
    throw new TypeError('proposal application is invalid.');
  }
  const proposal = readPlainDataRecord(
    application.proposal,
    ['expectedRevision', 'replacement'],
    'proposal application is invalid.',
  );
  const boundedCurrentRevision = requireBoundedString(
    application.currentRevision,
    MAX_REVISION_CODE_UNITS,
    'currentRevision',
  );
  const expectedRevision = requireBoundedString(
    proposal.expectedRevision,
    MAX_REVISION_CODE_UNITS,
    'expectedRevision',
  );
  const replacement = requireBoundedString(
    proposal.replacement,
    MAX_PROPOSAL_CODE_UNITS,
    'replacement',
  );

  if (expectedRevision !== boundedCurrentRevision) {
    return Object.freeze({ status: 'conflict' });
  }

  application.apply(replacement);
  return Object.freeze({ status: 'applied' });
}

async function runSelfTest() {
  let staleDocument = 'Original draft';
  let staleRevision = 'revision-v1';
  const staleProposalPromise = createDelayedProposal({
    expectedRevision: staleRevision,
    replacement: 'Stale proposal',
  });

  staleDocument = 'User typed newer text';
  staleRevision = 'revision-v2';
  const staleProposal = await staleProposalPromise;
  const staleResult = applyDelayedProposal({
    proposal: staleProposal,
    currentRevision: staleRevision,
    apply(replacement) {
      staleDocument = replacement;
    },
  });

  let acceptedDocument = 'Current draft';
  const acceptedRevision = 'revision-v3';
  const acceptedProposal = await createDelayedProposal({
    expectedRevision: acceptedRevision,
    replacement: 'Accepted proposal',
  });
  const acceptedResult = applyDelayedProposal({
    proposal: acceptedProposal,
    currentRevision: acceptedRevision,
    apply(replacement) {
      acceptedDocument = replacement;
    },
  });

  process.stdout.write(
    `${JSON.stringify({
      acceptedDocument,
      acceptedStatus: acceptedResult.status,
      staleDocument,
      staleStatus: staleResult.status,
    })}\n`,
  );
}

async function runHostileAccessorSelfTest() {
  let creationGetterCalls = 0;
  let creationError = null;
  const hostileCreation = { replacement: 'Hostile proposal' };
  Object.defineProperty(hostileCreation, 'expectedRevision', {
    enumerable: true,
    get() {
      creationGetterCalls += 1;
      return 'revision-v1';
    },
  });
  try {
    await createDelayedProposal(hostileCreation);
  } catch (error) {
    creationError = error instanceof Error ? error.message : 'unexpected error';
  }

  const validProposal = await createDelayedProposal({
    expectedRevision: 'revision-v1',
    replacement: 'Valid proposal',
  });
  let applicationGetterCalls = 0;
  let applicationError = null;
  const hostileApplication = {
    proposal: validProposal,
    currentRevision: 'revision-v1',
  };
  Object.defineProperty(hostileApplication, 'apply', {
    enumerable: true,
    get() {
      applicationGetterCalls += 1;
      return () => undefined;
    },
  });
  try {
    applyDelayedProposal(hostileApplication);
  } catch (error) {
    applicationError = error instanceof Error ? error.message : 'unexpected error';
  }

  let proposalGetterCalls = 0;
  let proposalError = null;
  const hostileProposal = { replacement: 'Hostile proposal' };
  Object.defineProperty(hostileProposal, 'expectedRevision', {
    enumerable: true,
    get() {
      proposalGetterCalls += 1;
      return 'revision-v1';
    },
  });
  try {
    applyDelayedProposal({
      proposal: hostileProposal,
      currentRevision: 'revision-v1',
      apply() {},
    });
  } catch (error) {
    proposalError = error instanceof Error ? error.message : 'unexpected error';
  }

  process.stdout.write(
    `${JSON.stringify({
      applicationError,
      applicationGetterCalls,
      creationError,
      creationGetterCalls,
      proposalError,
      proposalGetterCalls,
    })}\n`,
  );
}

if (process.argv.includes('--hostile-accessor-self-test')) {
  await runHostileAccessorSelfTest();
} else if (process.argv.includes('--self-test')) {
  await runSelfTest();
}
