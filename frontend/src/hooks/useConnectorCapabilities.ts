'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { ConnectorCapabilitiesResponse } from '@/lib/connectorCapabilities';

export function useConnectorCapabilities() {
  const [data, setData] = useState<ConnectorCapabilitiesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const response = await api.get<ConnectorCapabilitiesResponse>('/api/integrations/capabilities');
      setData(response.data);
    } catch {
      setData(null);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { data, loading, error, refresh };
}
