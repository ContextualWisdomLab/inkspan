const AUTOSAVE_STATES = new Set([
  'idle',
  'saving',
  'blocked',
  'closing',
  'closed',
]);
const BLOCKED_REASONS = new Set(['conflict', 'failure']);
const SNAPSHOT_KEYS = [
  'state',
  'blockedReason',
  'activeStrongEntityTag',
  'pendingStrongEntityTag',
  'lastSavedStrongEntityTag',
];

/** Marker used by repository contracts to prevent this host fixture becoming runtime authority. */
export const REFERENCE_ONLY = true;

function requireNullableString(value, label) {
  if (value !== null && (typeof value !== 'string' || value.length === 0)) {
    throw new TypeError(`${label} is invalid.`);
  }
  return value;
}

function snapshotData(source) {
  try {
    if (typeof source !== 'object' || source === null) {
      throw new TypeError('autosave snapshot is invalid.');
    }
    const values = Object.create(null);
    for (const key of SNAPSHOT_KEYS) {
      const descriptor = Object.getOwnPropertyDescriptor(source, key);
      if (
        descriptor === undefined ||
        !Object.prototype.hasOwnProperty.call(descriptor, 'value')
      ) {
        throw new TypeError('autosave snapshot is invalid.');
      }
      values[key] = descriptor.value;
    }
    const ownKeys = Reflect.ownKeys(source);
    if (
      ownKeys.length !== SNAPSHOT_KEYS.length ||
      ownKeys.some(
        (key) => typeof key !== 'string' || !SNAPSHOT_KEYS.includes(key),
      )
    ) {
      throw new TypeError('autosave snapshot is invalid.');
    }
    return values;
  } catch {
    throw new TypeError('autosave snapshot is invalid.');
  }
}

function readSnapshot(source) {
  const snapshot = snapshotData(source);
  if (
    !AUTOSAVE_STATES.has(snapshot.state) ||
    (snapshot.blockedReason !== null &&
      !BLOCKED_REASONS.has(snapshot.blockedReason))
  ) {
    throw new TypeError('autosave snapshot is invalid.');
  }

  if (
    (snapshot.state === 'blocked' && snapshot.blockedReason === null) ||
    (snapshot.state !== 'blocked' && snapshot.blockedReason !== null)
  ) {
    throw new TypeError('autosave snapshot lifecycle is inconsistent.');
  }

  return Object.freeze({
    state: snapshot.state,
    blockedReason: snapshot.blockedReason,
    activeStrongEntityTag: requireNullableString(
      snapshot.activeStrongEntityTag,
      'activeStrongEntityTag',
    ),
    pendingStrongEntityTag: requireNullableString(
      snapshot.pendingStrongEntityTag,
      'pendingStrongEntityTag',
    ),
    lastSavedStrongEntityTag: requireNullableString(
      snapshot.lastSavedStrongEntityTag,
      'lastSavedStrongEntityTag',
    ),
  });
}

function presentation(viewState) {
  return Object.freeze({
    viewState,
    messageKey: `referenceHost.autosave.${viewState}`,
    busy:
      viewState === 'saving' ||
      viewState === 'queued' ||
      viewState === 'retrying',
    blocked: viewState === 'conflict' || viewState === 'failed',
    canRetry: viewState === 'conflict' || viewState === 'failed',
  });
}

/**
 * Create one host-owned projection of Inkspan autosave lifecycle transitions.
 *
 * `observe()` consumes only programmatic queue/session snapshots. Snapshot fields
 * must be an exact own-data-property shape so presentation never invokes
 * caller-owned accessors or silently admits authority-looking metadata.
 * A blocked to saving transition is presented as retrying, and only a later idle
 * transition after that observed retry is presented as recovered. A blocked to
 * idle transition without an intervening save returns to clean instead of
 * manufacturing recovery evidence. The projection never returns local or durable
 * validators; hosts localize `messageKey` and keep authenticated recovery controls
 * outside Inkspan.
 */
export function createAutosaveViewModel() {
  let retryPending = false;
  let retryInFlight = false;

  function clearRetryEvidence() {
    retryPending = false;
    retryInFlight = false;
  }

  function observe(snapshot) {
    const current = readSnapshot(snapshot);

    if (current.state === 'blocked') {
      retryPending = true;
      retryInFlight = false;
      return presentation(
        current.blockedReason === 'conflict' ? 'conflict' : 'failed',
      );
    }
    if (current.state === 'closing') {
      clearRetryEvidence();
      return presentation('closing');
    }
    if (current.state === 'closed') {
      clearRetryEvidence();
      return presentation('closed');
    }
    if (current.state === 'saving' && (retryPending || retryInFlight)) {
      retryPending = false;
      retryInFlight = true;
      return presentation('retrying');
    }
    if (current.state === 'saving' && current.pendingStrongEntityTag !== null) {
      return presentation('queued');
    }
    if (current.state === 'saving') return presentation('saving');
    if (retryInFlight) {
      clearRetryEvidence();
      return presentation('recovered');
    }
    retryPending = false;
    return presentation('clean');
  }

  return Object.freeze({ observe });
}

function snapshot({
  state,
  blockedReason = null,
  activeStrongEntityTag = null,
  pendingStrongEntityTag = null,
  lastSavedStrongEntityTag = null,
}) {
  return Object.freeze({
    state,
    blockedReason,
    activeStrongEntityTag,
    pendingStrongEntityTag,
    lastSavedStrongEntityTag,
  });
}

function runSelfTest() {
  const steady = createAutosaveViewModel();
  const clean = steady.observe(snapshot({ state: 'idle' })).viewState;
  const saving = steady.observe(
    snapshot({
      state: 'saving',
      activeStrongEntityTag: '"local-active"',
    }),
  ).viewState;
  const queued = steady.observe(
    snapshot({
      state: 'saving',
      activeStrongEntityTag: '"local-active"',
      pendingStrongEntityTag: '"local-pending"',
    }),
  ).viewState;

  const recovery = createAutosaveViewModel();
  const conflict = recovery.observe(
    snapshot({ state: 'blocked', blockedReason: 'conflict' }),
  ).viewState;
  const retrying = recovery.observe(
    snapshot({
      state: 'saving',
      activeStrongEntityTag: '"local-retry"',
    }),
  ).viewState;
  const recovered = recovery.observe(
    snapshot({
      state: 'idle',
      lastSavedStrongEntityTag: '"local-saved"',
    }),
  ).viewState;

  const failed = createAutosaveViewModel().observe(
    snapshot({ state: 'blocked', blockedReason: 'failure' }),
  ).viewState;
  const closing = createAutosaveViewModel().observe(
    snapshot({ state: 'closing' }),
  ).viewState;
  const closed = createAutosaveViewModel().observe(
    snapshot({ state: 'closed' }),
  ).viewState;

  process.stdout.write(
    `${JSON.stringify({
      clean,
      closed,
      closing,
      conflict,
      failed,
      queued,
      recovered,
      retrying,
      saving,
    })}\n`,
  );
}

function runInvalidValidatorSelfTest() {
  function observeError(candidate) {
    try {
      createAutosaveViewModel().observe(candidate);
      return null;
    } catch (error) {
      return error instanceof Error ? error.message : 'unexpected error';
    }
  }

  const activeError = observeError(
    snapshot({ state: 'saving', activeStrongEntityTag: '' }),
  );
  const pendingError = observeError(
    snapshot({
      state: 'saving',
      activeStrongEntityTag: '"local-active"',
      pendingStrongEntityTag: '',
    }),
  );
  const lastSavedError = observeError(
    snapshot({ state: 'idle', lastSavedStrongEntityTag: '' }),
  );

  process.stdout.write(
    `${JSON.stringify({ activeError, lastSavedError, pendingError })}\n`,
  );
}

function runHostileAccessorSelfTest() {
  let getterCalls = 0;
  let error = null;
  const hostile = {
    blockedReason: null,
    activeStrongEntityTag: null,
    pendingStrongEntityTag: null,
    lastSavedStrongEntityTag: null,
  };
  Object.defineProperty(hostile, 'state', {
    enumerable: true,
    get() {
      getterCalls += 1;
      return 'idle';
    },
  });
  try {
    createAutosaveViewModel().observe(hostile);
  } catch (failure) {
    error = failure instanceof Error ? failure.message : 'unexpected error';
  }
  process.stdout.write(`${JSON.stringify({ error, getterCalls })}\n`);
}

if (process.argv.includes('--invalid-validator-self-test')) {
  runInvalidValidatorSelfTest();
} else if (process.argv.includes('--hostile-accessor-self-test')) {
  runHostileAccessorSelfTest();
} else if (process.argv.includes('--self-test')) {
  runSelfTest();
}
