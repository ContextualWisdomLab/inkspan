import { Doc } from 'yjs';

const MAX_CONTEXT_CODE_UNITS = 256;
const MAX_RESOURCE_PROTOTYPE_DEPTH = 64;
const INITIALIZATION_FAILURE = 'collaboration lifecycle initialization failed.';
const CONNECTION_FAILURE = 'collaboration lifecycle connection failed.';
const RECONNECT_FAILURE = 'collaboration lifecycle reconnect failed.';
const TEARDOWN_FAILURE = 'collaboration lifecycle teardown failed.';
const RESOURCE_VALIDATION_ERRORS = new WeakSet();

/** Marker used by repository contracts to keep this lifecycle example out of runtime authority. */
export const REFERENCE_ONLY = true;

class ResourceValidationError extends TypeError {
  constructor(message) {
    super(message);
    this.name = 'ResourceValidationError';
    RESOURCE_VALIDATION_ERRORS.add(this);
  }
}

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

function findDataMethod(source, key, message) {
  try {
    if ((typeof source !== 'object' && typeof source !== 'function') || source === null) {
      throw new ResourceValidationError(message);
    }
    let cursor = source;
    let depth = 0;
    while (cursor !== null) {
      if (depth >= MAX_RESOURCE_PROTOTYPE_DEPTH) {
        throw new ResourceValidationError(message);
      }
      const descriptor = Object.getOwnPropertyDescriptor(cursor, key);
      if (descriptor !== undefined) {
        if (
          !Object.prototype.hasOwnProperty.call(descriptor, 'value') ||
          typeof descriptor.value !== 'function'
        ) {
          throw new ResourceValidationError(message);
        }
        return descriptor.value;
      }
      cursor = Object.getPrototypeOf(cursor);
      depth += 1;
    }
    throw new ResourceValidationError(message);
  } catch {
    throw new ResourceValidationError(message);
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

function initializationFailure() {
  return new Error(INITIALIZATION_FAILURE);
}

function connectionFailure() {
  return new Error(CONNECTION_FAILURE);
}

function reconnectFailure() {
  return new Error(RECONNECT_FAILURE);
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
 * validation never executes accessor-backed host objects. Initial document and
 * provider callback failures are payload-redacted, acquired documents unwind on
 * initial provider failure, reconnect provider-construction failures remain
 * retryable, and connect failures quarantine the indeterminate provider until
 * reconnect/dispose tears it down. The reference lifecycle is intentionally
 * synchronous: any non-void connect result is treated as indeterminate, its
 * promise/thenable settlement is consumed, and the provider is quarantined
 * instead of reporting a false successful connection. Cleanup failures do not
 * prevent remaining teardown attempts. A failed provider or document destruction
 * keeps only the incomplete cleanup live so a later dispose() retries it without
 * repeating already-successful teardown. Once disposal starts, connect/reconnect
 * stay closed while cleanup is pending.
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
  let documentCandidate;
  try {
    documentCandidate = createDocument();
  } catch {
    throw initializationFailure();
  }
  const documentResource = requireDocument(documentCandidate);
  const document = documentResource.value;

  let providerGeneration = 0;
  let providerResource = null;
  let connected = false;
  let providerConnectionIndeterminate = false;
  let documentDestroyed = false;
  let disposeStarted = false;
  let disposed = false;

  function makeProvider(privateFailure) {
    providerGeneration += 1;
    let candidate;
    try {
      candidate = createProvider({
        document,
        roomId: boundedRoomId,
        actorId: boundedActorId,
        generation: providerGeneration,
      });
    } catch {
      throw privateFailure();
    }
    providerResource = requireProvider(candidate);
    connected = false;
    providerConnectionIndeterminate = false;
  }

  function requireLive() {
    if (disposed) {
      throw new Error('collaboration lifecycle is disposed.');
    }
    if (disposeStarted) {
      throw teardownFailure();
    }
  }

  function connect() {
    requireLive();
    if (providerConnectionIndeterminate) throw connectionFailure();
    if (connected) return false;
    let connectionResult;
    try {
      connectionResult = providerResource.connect.call(providerResource.value);
    } catch {
      providerConnectionIndeterminate = true;
      throw connectionFailure();
    }
    if (connectionResult !== undefined) {
      providerConnectionIndeterminate = true;
      void Promise.resolve(connectionResult).catch(() => undefined);
      throw connectionFailure();
    }
    connected = true;
    return true;
  }

  function teardownProvider() {
    const resource = providerResource;
    if (resource === null) return;
    let failed = false;
    let destroyFailed = false;
    if (connected || providerConnectionIndeterminate) {
      connected = false;
      try {
        resource.disconnect.call(resource.value);
        providerConnectionIndeterminate = false;
      } catch {
        failed = true;
        providerConnectionIndeterminate = true;
      }
    }
    try {
      resource.destroy.call(resource.value);
    } catch {
      failed = true;
      destroyFailed = true;
    }
    if (!destroyFailed) {
      providerResource = null;
      providerConnectionIndeterminate = false;
    }
    if (failed) throw teardownFailure();
  }

  function reconnect() {
    requireLive();
    teardownProvider();
    makeProvider(reconnectFailure);
    connect();
    return getSnapshot();
  }

  function dispose() {
    if (disposed) return false;
    disposeStarted = true;
    let failed = false;
    try {
      teardownProvider();
    } catch {
      failed = true;
    }
    if (!documentDestroyed) {
      try {
        documentResource.destroy.call(document);
        documentDestroyed = true;
      } catch {
        failed = true;
      }
    }
    disposed = providerResource === null && documentDestroyed;
    if (failed || !disposed) throw teardownFailure();
    return true;
  }

  function getSnapshot() {
    return Object.freeze({
      status: disposed ? 'disposed' : connected ? 'connected' : 'disconnected',
      providerGeneration,
    });
  }

  try {
    makeProvider(initializationFailure);
  } catch (error) {
    let cleanupFailed = false;
    try {
      documentResource.destroy.call(document);
    } catch {
      cleanupFailed = true;
    }
    if (RESOURCE_VALIDATION_ERRORS.has(error) && !cleanupFailed) {
      throw error;
    }
    throw initializationFailure();
  }

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
  let firstProviderDocument = null;
  let sameDocumentAcrossReconnect = true;
  const lifecycle = createHostCollaborationLifecycle({
    documentFactory() {
      events.push('document:create');
      const document = new Doc();
      document.getText('document').insert(0, 'Buyer draft');
      document.on('destroy', () => {
        events.push('document:destroy');
      });
      return document;
    },
    providerFactory({ document }) {
      providerCounter += 1;
      const generation = providerCounter;
      if (!(document instanceof Doc)) {
        throw new TypeError('reference host must supply a Y.Doc.');
      }
      if (firstProviderDocument === null) {
        firstProviderDocument = document;
      } else if (document !== firstProviderDocument) {
        sameDocumentAcrossReconnect = false;
      }
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
  const hostDocumentIsYjs = lifecycle.document instanceof Doc;
  const yjsText = lifecycle.document.getText('document').toString();
  lifecycle.dispose();
  lifecycle.dispose();

  process.stdout.write(
    `${JSON.stringify({
      events,
      hostDocumentIsYjs,
      ...lifecycle.getSnapshot(),
      sameDocumentAcrossReconnect,
      yjsText,
    })}\n`,
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

function runInitializationFailureSelfTest() {
  const privateCause = 'private-provider-construction-cause';
  const events = [];
  let error = null;
  try {
    createHostCollaborationLifecycle({
      documentFactory() {
        events.push('document:create');
        return {
          destroy() {
            events.push('document:destroy');
          },
        };
      },
      providerFactory() {
        events.push('provider:create');
        throw new Error(privateCause);
      },
      roomId: 'reference-room',
      actorId: 'reference-actor',
    });
  } catch (failure) {
    error = failure instanceof Error ? failure.message : 'unexpected error';
  }
  process.stdout.write(
    `${JSON.stringify({
      error,
      events,
      leakedPrivateCause: typeof error === 'string' && error.includes(privateCause),
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
} else if (process.argv.includes('--initialization-failure-self-test')) {
  runInitializationFailureSelfTest();
} else if (process.argv.includes('--hostile-accessor-self-test')) {
  runHostileAccessorSelfTest();
} else if (process.argv.includes('--self-test')) {
  runSelfTest();
}
