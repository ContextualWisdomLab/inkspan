const MAX_CONTEXT_CODE_UNITS = 256;
const TEARDOWN_FAILURE = 'collaboration lifecycle teardown failed.';

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

function readOwnDataRecord(source, keys, message) {
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
    return values;
  } catch (error) {
    if (error instanceof TypeError && error.message === message) throw error;
    throw new TypeError(message);
  }
}

function findDataMethod(source, key, message) {
  try {
    if ((typeof source !== 'object' && typeof source !== 'function') || source === null) {
      throw new TypeError(message);
    }
    let cursor = source;
    while (cursor !== null) {
      const descriptor = Object.getOwnPropertyDescriptor(cursor, key);
      if (descriptor !== undefined) {
        if (
          !Object.prototype.hasOwnProperty.call(descriptor, 'value') ||
          typeof descriptor.value !== 'function'
        ) {
          throw new TypeError(message);
        }
        return descriptor.value;
      }
      cursor = Object.getPrototypeOf(cursor);
    }
    throw new TypeError(message);
  } catch (error) {
    if (error instanceof TypeError && error.message === message) throw error;
    throw new TypeError(message);
  }
}

function requireDocument(value) {
  const message = 'documentFactory returned an invalid document.';
  return Object.freeze({
    value,
    destroy: findDataMethod(value, 'destroy', message),
  });
}

function requireProvider(value) {
  const message = 'providerFactory returned an invalid provider.';
  return Object.freeze({
    value,
    connect: findDataMethod(value, 'connect', message),
    disconnect: findDataMethod(value, 'disconnect', message),
    destroy: findDataMethod(value, 'destroy', message),
  });
}

function teardownFailure() {
  return new Error(TEARDOWN_FAILURE);
}

/**
 * Create one provider-neutral collaboration lifecycle owned entirely by the host.
 *
 * The host supplies the document/provider factories and authorized room/actor
 * context. Inkspan receives the resulting stable document/provider references;
 * it does not create, reconnect, disconnect, or destroy either resource. Option
 * fields and resource methods are captured from data descriptors so lifecycle
 * validation never executes accessor-backed host objects. Cleanup failures are
 * payload-redacted and do not prevent remaining teardown attempts.
 */
export function createHostCollaborationLifecycle(source) {
  const options = readOwnDataRecord(
    source,
    ['documentFactory', 'providerFactory', 'roomId', 'actorId'],
    'collaboration options are invalid.',
  );
  const createDocument = requireFactory(options.documentFactory, 'documentFactory');
  const createProvider = requireFactory(options.providerFactory, 'providerFactory');
  const boundedRoomId = requireContextString(options.roomId, 'roomId');
  const boundedActorId = requireContextString(options.actorId, 'actorId');
  const documentResource = requireDocument(createDocument());
  const document = documentResource.value;

  let providerGeneration = 0;
  let providerResource = null;
  let connected = false;
  let disposed = false;

  function makeProvider() {
    providerGeneration += 1;
    providerResource = requireProvider(
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
    providerResource.connect.call(providerResource.value);
    connected = true;
    return true;
  }

  function teardownProvider() {
    const resource = providerResource;
    if (resource === null) return;
    providerResource = null;
    let failed = false;
    if (connected) {
      connected = false;
      try {
        resource.disconnect.call(resource.value);
      } catch {
        failed = true;
      }
    }
    try {
      resource.destroy.call(resource.value);
    } catch {
      failed = true;
    }
    if (failed) throw teardownFailure();
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
    let failed = false;
    try {
      teardownProvider();
    } catch {
      failed = true;
    }
    try {
      documentResource.destroy.call(document);
    } catch {
      failed = true;
    }
    disposed = true;
    if (failed) throw teardownFailure();
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

function runHostileAccessorSelfTest() {
  let optionsGetterCalls = 0;
  let optionsError = null;
  const hostileOptions = {
    providerFactory() {
      return { connect() {}, disconnect() {}, destroy() {} };
    },
    roomId: 'reference-room',
    actorId: 'reference-actor',
  };
  Object.defineProperty(hostileOptions, 'documentFactory', {
    enumerable: true,
    get() {
      optionsGetterCalls += 1;
      return () => ({ destroy() {} });
    },
  });
  try {
    createHostCollaborationLifecycle(hostileOptions);
  } catch (error) {
    optionsError = error instanceof Error ? error.message : 'unexpected error';
  }

  let documentGetterCalls = 0;
  let documentError = null;
  try {
    createHostCollaborationLifecycle({
      documentFactory() {
        const hostileDocument = {};
        Object.defineProperty(hostileDocument, 'destroy', {
          enumerable: true,
          get() {
            documentGetterCalls += 1;
            return () => undefined;
          },
        });
        return hostileDocument;
      },
      providerFactory() {
        return { connect() {}, disconnect() {}, destroy() {} };
      },
      roomId: 'reference-room',
      actorId: 'reference-actor',
    });
  } catch (error) {
    documentError = error instanceof Error ? error.message : 'unexpected error';
  }

  let providerGetterCalls = 0;
  let providerError = null;
  try {
    createHostCollaborationLifecycle({
      documentFactory() {
        return { destroy() {} };
      },
      providerFactory() {
        const hostileProvider = { disconnect() {}, destroy() {} };
        Object.defineProperty(hostileProvider, 'connect', {
          enumerable: true,
          get() {
            providerGetterCalls += 1;
            return () => undefined;
          },
        });
        return hostileProvider;
      },
      roomId: 'reference-room',
      actorId: 'reference-actor',
    });
  } catch (error) {
    providerError = error instanceof Error ? error.message : 'unexpected error';
  }

  process.stdout.write(
    `${JSON.stringify({
      documentError,
      documentGetterCalls,
      optionsError,
      optionsGetterCalls,
      providerError,
      providerGetterCalls,
    })}\n`,
  );
}

function runCleanupFailureSelfTest() {
  const privateCause = 'private-provider-disconnect-cause';
  const events = [];
  const lifecycle = createHostCollaborationLifecycle({
    documentFactory() {
      return {
        destroy() {
          events.push('document:destroy');
        },
      };
    },
    providerFactory() {
      return {
        connect() {
          events.push('provider:connect');
        },
        disconnect() {
          events.push('provider:disconnect');
          throw new Error(privateCause);
        },
        destroy() {
          events.push('provider:destroy');
        },
      };
    },
    roomId: 'reference-room',
    actorId: 'reference-actor',
  });
  lifecycle.connect();
  let error = null;
  try {
    lifecycle.dispose();
  } catch (failure) {
    error = failure instanceof Error ? failure.message : 'unexpected error';
  }
  process.stdout.write(
    `${JSON.stringify({
      error,
      events,
      leakedPrivateCause: typeof error === 'string' && error.includes(privateCause),
      status: lifecycle.getSnapshot().status,
    })}\n`,
  );
}

if (process.argv.includes('--cleanup-failure-self-test')) {
  runCleanupFailureSelfTest();
} else if (process.argv.includes('--hostile-accessor-self-test')) {
  runHostileAccessorSelfTest();
} else if (process.argv.includes('--self-test')) {
  runSelfTest();
}
