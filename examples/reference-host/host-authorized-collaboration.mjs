const AUTHORIZATION_FAILURE = 'collaboration provider authorization failed.';
const OPTIONS_FAILURE = 'collaboration authorization options are invalid.';
const CONTEXT_FAILURE = 'collaboration provider context is invalid.';

/** Marker used by repository contracts to keep this host example out of runtime authority. */
export const REFERENCE_ONLY = true;

function readExactOwnDataRecord(source, keys, message) {
  try {
    if (typeof source !== 'object' || source === null) {
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
    const ownKeys = Reflect.ownKeys(source);
    if (
      ownKeys.length !== keys.length ||
      ownKeys.some(
        (key) =>
          typeof key !== 'string' ||
          !keys.some((candidate) => candidate === key),
      )
    ) {
      throw new TypeError(message);
    }
    return values;
  } catch {
    throw new TypeError(message);
  }
}

function requireFunction(value, message) {
  if (typeof value !== 'function') {
    throw new TypeError(message);
  }
  return value;
}

function requireContextString(value) {
  if (typeof value !== 'string' || value.length === 0 || value.length > 256) {
    throw new TypeError(CONTEXT_FAILURE);
  }
  return value;
}

function requireGeneration(value) {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new TypeError(CONTEXT_FAILURE);
  }
  return value;
}

/**
 * Wrap one host-owned collaboration provider factory with a synchronous host
 * authorization decision. The authorization callback receives only the bounded
 * room/actor/generation identity needed for admission; the host-owned Y.Doc is
 * supplied only to the provider constructor after authorization succeeds.
 *
 * Inkspan does not authenticate or authorize here. This reference-only adapter
 * demonstrates where an integrating host must enforce its own policy before a
 * provider is constructed. Only the exact boolean `true` admits construction;
 * false, thrown, asynchronous, malformed, or otherwise indeterminate decisions
 * fail closed with a payload-redacted error.
 */
export function createHostAuthorizedProviderFactory(source) {
  const options = readExactOwnDataRecord(
    source,
    ['authorize', 'createProvider'],
    OPTIONS_FAILURE,
  );
  const authorize = requireFunction(options.authorize, OPTIONS_FAILURE);
  const createProvider = requireFunction(options.createProvider, OPTIONS_FAILURE);

  return function authorizedProviderFactory(sourceContext) {
    const context = readExactOwnDataRecord(
      sourceContext,
      ['document', 'roomId', 'actorId', 'generation'],
      CONTEXT_FAILURE,
    );
    const roomId = requireContextString(context.roomId);
    const actorId = requireContextString(context.actorId);
    const generation = requireGeneration(context.generation);
    const authorizationContext = Object.freeze({ roomId, actorId, generation });

    let decision;
    try {
      decision = authorize(authorizationContext);
    } catch {
      throw new Error(AUTHORIZATION_FAILURE);
    }
    if (decision !== true) {
      throw new Error(AUTHORIZATION_FAILURE);
    }

    return createProvider(
      Object.freeze({
        document: context.document,
        roomId,
        actorId,
        generation,
      }),
    );
  };
}

function runSelfTest() {
  const events = [];
  const document = Object.freeze({ reference: 'host-owned-document' });
  const authorizedFactory = createHostAuthorizedProviderFactory({
    authorize(context) {
      if (Object.prototype.hasOwnProperty.call(context, 'document')) {
        throw new Error('authorization context must not receive the host document.');
      }
      events.push(
        `authorize:${context.actorId}:${context.roomId}:${context.generation}`,
      );
      return true;
    },
    createProvider(context) {
      if (context.document !== document) {
        throw new Error('provider construction lost the host-owned document.');
      }
      events.push(`provider:create:${context.generation}`);
      return Object.freeze({ generation: context.generation });
    },
  });

  const provider1 = authorizedFactory({
    document,
    roomId: 'reference-room',
    actorId: 'reference-actor',
    generation: 1,
  });
  const provider2 = authorizedFactory({
    document,
    roomId: 'reference-room',
    actorId: 'reference-actor',
    generation: 2,
  });

  let deniedProviderConstructed = false;
  let deniedError = null;
  const deniedFactory = createHostAuthorizedProviderFactory({
    authorize() {
      events.push('authorize:denied');
      return false;
    },
    createProvider() {
      deniedProviderConstructed = true;
      return {};
    },
  });
  try {
    deniedFactory({
      document,
      roomId: 'reference-room',
      actorId: 'denied-actor',
      generation: 3,
    });
  } catch (error) {
    deniedError = error instanceof Error ? error.message : 'unexpected error';
  }

  const expectedEvents = [
    'authorize:reference-actor:reference-room:1',
    'provider:create:1',
    'authorize:reference-actor:reference-room:2',
    'provider:create:2',
    'authorize:denied',
  ];
  if (
    provider1.generation !== 1 ||
    provider2.generation !== 2 ||
    deniedProviderConstructed ||
    deniedError !== AUTHORIZATION_FAILURE ||
    events.length !== expectedEvents.length ||
    events.some((event, index) => event !== expectedEvents[index])
  ) {
    throw new Error('host-authorized collaboration self-test failed.');
  }

  process.stdout.write(
    `${JSON.stringify({
      authorizationBeforeConstruction: true,
      deniedProviderConstructed,
      deniedError,
      events,
      hostDocumentPreserved: true,
      status: 'completed',
    })}\n`,
  );
}

if (process.argv.includes('--self-test')) {
  runSelfTest();
}
