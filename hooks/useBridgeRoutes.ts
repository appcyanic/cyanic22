"use client";

import { useState, useEffect, useCallback } from "react";
import type { Route } from "@lifi/sdk";
import { fetchBridgeRoutes, type BridgeRouteParams } from "@/lib/lifi";

interface UseBridgeRoutesResult {
  routes: Route[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useBridgeRoutes(params: BridgeRouteParams | null): UseBridgeRoutesResult {
  const [routes,    setRoutes]    = useState<Route[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!params) { setRoutes([]); return; }
    setIsLoading(true);
    setError(null);
    try {
      const result = await fetchBridgeRoutes(params);
      setRoutes(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch routes");
      setRoutes([]);
    } finally {
      setIsLoading(false);
    }
  }, [JSON.stringify(params)]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetch();
    // Refresh every 30s
    const id = setInterval(fetch, 30_000);
    return () => clearInterval(id);
  }, [fetch]);

  return { routes, isLoading, error, refetch: fetch };
}
