const MAX_CONTEXT_CODE_UNITS = 256;

/** Marker used by repository contracts to keep this lifecycle example out of runtime authority. */
export const REFERENCE_ONLY = true;

function requireContextString(value, label) {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > MAX_CONTEXT_CODE_UNITS
  ) {
    throw new TypeError(`${label} is invalid.`);
  }
  return value;
}

function requireFactory(value, label) {
  if (typeof value !== 'function') {
    throw new TypeError(`${label} is invalid.`);
  }
  return value;
}

function requireDocument(value) {
  if (
    typeof value !== 'object' ||
    value === null ||
    typeof value.destroy !== 'function'
  ) {
    throw new TypeError('documentFactory returned an invalid document.');
  }
  return value;
}

function requireProvider(value) {
  if (
    typeof value !== 'object' ||
    value === null ||
    typeof value.connect !== 'function' ||
    typeof value.disconnect !== 'function' ||
    typeof value.destroy !== 'function'
  ) {
    throw new TypeError('providerFactory returned an invalid provider.');
  }
  return value;
}

/**
 * Create one provider-neutral collaboration lifecycle owned entirely by the host.
 *
 * The host supplies the document/provider factories and authorized room/actor
 * context. Inkspan receives the resulting stable document/provider references;
 * it does not create, reconnect, disconnect, or destroy either resource.
 */
export function createHostCollaborationLifecycle({
  documentFactory,
  providerFactory,
  roomId,
  actorId,
}) {
  const createDocument = requireFactory(documentFactory, 'documentFactory');
  const createProvider = requireFactory(providerFactory, 'providerFactory');
  const boundedRoomId = requireContextString(roomId, 'roomId');
  const boundedActorId = requireContextString(actorId, 'actorId');
  const document = requireDocument(createDocument());

  let providerGeneration = 0;
  let provider = null;
  let connected = false;
  let disposed = false;

  function makeProvider() {
    providerGeneration += 1;
    provider = requireProvider(
      createProvider({
        document,
        roomId: boundedRoomId,
        actorId: boundedActorId,
        generation: providerGeneration,
      }),
    );
    connected = false;
  }

  function requireLive() {
    if (disposed) {
      throw new Error('collaboration lifecycle is disposed.');
    }
  }

  function connect() {
    requireLive();
    if (connected) return false;
    provider.connect();
    connected = true;
    return true;
  }

  function teardownProvider() {
    if (provider === null) return;
    if (connected) {
      provider.disconnect();
      connected = false;
    }
    provider.destroy();
    provider = null;
  }

  function reconnect() {
    requireLive();
    teardownProvider();
    makeProvider();
    connect();
    return getSnapshot();
  }

  function dispose() {
    if (disposed) return false;
    teardownProvider();
    document.destroy();
    disposed = true;
    return true;
  }

  function getSnapshot() {
    return Object.freeze({
      status: disposed ? 'disposed' : connected ? 'connected' : 'disconnected',
      providerGeneration,
    });
  }

  makeProvider();

  return Object.freeze({
    document,
    connect,
    reconnect,
    dispose,
    getSnapshot,
  });
}

function runSelfTest() {
  const events = [];
  let providerCounter = 0;
  const lifecycle = createHostCollaborationLifecycle({
    documentFactory() {
      events.push('document:create');
      return {
        destroy() {
          events.push('document:destroy');
        },
      };
    },
    providerFactory() {
      providerCounter += 1;
      const generation = providerCounter;
      events.push(`provider:create:${generation}`);
      return {
        connect() {
          events.push(`provider:connect:${generation}`);
        },
        disconnect() {
          events.push(`provider:disconnect:${generation}`);
        },
        destroy() {
          events.push(`provider:destroy:${generation}`);
        },
      };
    },
    roomId: 'reference-room',
    actorId: 'reference-actor',
  });

  lifecycle.connect();
  lifecycle.reconnect();
  lifecycle.dispose();
  lifecycle.dispose();

  process.stdout.write(
    `${JSON.stringify({ events, ...lifecycle.getSnapshot() })}\n`,
  );
}

if (process.argv.includes('--self-test')) {
  runSelfTest();
}
