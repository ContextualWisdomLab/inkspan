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

/**
 * Produce one deterministic asynchronous proposal bound to the revision captured by the host.
 *
 * This fixture deliberately contains no provider SDK, credential, prompt log, or remote call.
 * Real hosts replace proposal generation with an approved model boundary while preserving the
 * expectedRevision conflict gate before applying untrusted proposal data.
 */
export async function createDelayedProposal({ expectedRevision, replacement }) {
  const boundedRevision = requireBoundedString(
    expectedRevision,
    MAX_REVISION_CODE_UNITS,
    'expectedRevision',
  );
  const boundedReplacement = requireBoundedString(
    replacement,
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
 */
export function applyDelayedProposal({ proposal, currentRevision, apply }) {
  if (
    typeof proposal !== 'object' ||
    proposal === null ||
    typeof apply !== 'function'
  ) {
    throw new TypeError('proposal application is invalid.');
  }
  const boundedCurrentRevision = requireBoundedString(
    currentRevision,
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

  apply(replacement);
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

if (process.argv.includes('--self-test')) {
  await runSelfTest();
}
