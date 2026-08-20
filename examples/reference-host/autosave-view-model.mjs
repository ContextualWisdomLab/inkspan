const AUTOSAVE_STATES = new Set([
  'idle',
  'saving',
  'blocked',
  'closing',
  'closed',
]);
const BLOCKED_REASONS = new Set(['conflict', 'failure']);
const RECOVERY_PHASES = new Set(['none', 'retrying', 'recovered']);

/** Marker used by repository contracts to prevent this host fixture becoming runtime authority. */
export const REFERENCE_ONLY = true;

function requireNullableString(value, label) {
  if (value !== null && typeof value !== 'string') {
    throw new TypeError(`${label} is invalid.`);
  }
  return value;
}

function readSnapshot(snapshot) {
  if (
    typeof snapshot !== 'object' ||
    snapshot === null ||
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

function readRecoveryPhase(recoveryPhase) {
  if (!RECOVERY_PHASES.has(recoveryPhase)) {
    throw new TypeError('recoveryPhase is invalid.');
  }
  return recoveryPhase;
}

function presentation(viewState) {
  return Object.freeze({
    viewState,
    messageKey: `referenceHost.autosave.${viewState}`,
    busy: viewState === 'saving' || viewState === 'queued' || viewState === 'retrying',
    canRetry: viewState === 'conflict' || viewState === 'failed',
  });
}

/**
 * Convert one Inkspan autosave lifecycle snapshot into host-owned presentation metadata.
 *
 * The result intentionally excludes local and durable validators. Hosts localize
 * `messageKey` and keep authenticated recovery controls outside Inkspan.
 */
export function createAutosaveViewModel({ snapshot, recoveryPhase = 'none' }) {
  const current = readSnapshot(snapshot);
  const phase = readRecoveryPhase(recoveryPhase);

  if (current.state === 'blocked') {
    return presentation(
      current.blockedReason === 'conflict' ? 'conflict' : 'failed',
    );
  }
  if (current.state === 'closing') return presentation('closing');
  if (current.state === 'closed') return presentation('closed');
  if (current.state === 'saving' && phase === 'retrying') {
    return presentation('retrying');
  }
  if (current.state === 'saving' && current.pendingStrongEntityTag !== null) {
    return presentation('queued');
  }
  if (current.state === 'saving') return presentation('saving');
  if (phase === 'recovered') return presentation('recovered');
  return presentation('clean');
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
  const states = {
    clean: createAutosaveViewModel({
      snapshot: snapshot({ state: 'idle' }),
    }).viewState,
    saving: createAutosaveViewModel({
      snapshot: snapshot({
        state: 'saving',
        activeStrongEntityTag: '"local-active"',
      }),
    }).viewState,
    queued: createAutosaveViewModel({
      snapshot: snapshot({
        state: 'saving',
        activeStrongEntityTag: '"local-active"',
        pendingStrongEntityTag: '"local-pending"',
      }),
    }).viewState,
    conflict: createAutosaveViewModel({
      snapshot: snapshot({ state: 'blocked', blockedReason: 'conflict' }),
    }).viewState,
    failed: createAutosaveViewModel({
      snapshot: snapshot({ state: 'blocked', blockedReason: 'failure' }),
    }).viewState,
    retrying: createAutosaveViewModel({
      snapshot: snapshot({
        state: 'saving',
        activeStrongEntityTag: '"local-retry"',
      }),
      recoveryPhase: 'retrying',
    }).viewState,
    recovered: createAutosaveViewModel({
      snapshot: snapshot({
        state: 'idle',
        lastSavedStrongEntityTag: '"local-saved"',
      }),
      recoveryPhase: 'recovered',
    }).viewState,
    closing: createAutosaveViewModel({
      snapshot: snapshot({ state: 'closing' }),
    }).viewState,
    closed: createAutosaveViewModel({
      snapshot: snapshot({ state: 'closed' }),
    }).viewState,
  };
  process.stdout.write(`${JSON.stringify(states)}\n`);
}

if (process.argv.includes('--self-test')) {
  runSelfTest();
}
