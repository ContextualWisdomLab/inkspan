'use client';

import { useEffect, useState, type ReactNode } from 'react';

export interface ReferenceHostHydrationGateProps {
  loadingLabel: string;
  renderEditor: () => ReactNode;
}

export function ReferenceHostHydrationGate({
  loadingLabel,
  renderEditor,
}: ReferenceHostHydrationGateProps) {
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  if (!hydrated) {
    return <div aria-busy="true">{loadingLabel}</div>;
  }

  return <>{renderEditor()}</>;
}
