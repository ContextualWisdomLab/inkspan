'use client';

import { ReferenceHostHydrationGate } from './hydration-gate.js';
import {
  NativeFormHost,
  type NativeFormHostProps,
} from './native-form-host.js';

export interface ReferenceHostClientProps extends NativeFormHostProps {
  /** Host-localized label rendered before the interactive editor hydrates. */
  loadingLabel: string;
}

/**
 * Narrow client boundary for the reference-host editor composition.
 *
 * Browser-only hydration and the native form/editor lifecycle stay behind this
 * boundary. The embedding host still owns authorization and durable persistence
 * through onAuthorizedSubmit; this component adds no transport, credential, or
 * storage authority.
 */
export function ReferenceHostClient({
  loadingLabel,
  onAuthorizedSubmit,
  controlMode,
  readOnly,
}: ReferenceHostClientProps) {
  return (
    <ReferenceHostHydrationGate
      loadingLabel={loadingLabel}
      renderEditor={() => (
        <NativeFormHost
          onAuthorizedSubmit={onAuthorizedSubmit}
          controlMode={controlMode}
          readOnly={readOnly}
        />
      )}
    />
  );
}
