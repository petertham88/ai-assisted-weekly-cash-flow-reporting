"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";

/**
 * Small helper for mutating API calls: tracks busy state, surfaces errors, and
 * refreshes server components on success so the UI always reflects DB state.
 */
export function useApi() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const call = useCallback(
    async (
      url: string,
      opts: { method?: string; body?: unknown; refresh?: boolean } = {},
    ): Promise<{ ok: boolean; data?: any }> => {
      setBusy(true);
      setError(null);
      try {
        const res = await fetch(url, {
          method: opts.method ?? "POST",
          headers: opts.body != null ? { "Content-Type": "application/json" } : undefined,
          body: opts.body != null ? JSON.stringify(opts.body) : undefined,
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(data?.error ?? `Request failed (${res.status})`);
          return { ok: false, data };
        }
        if (opts.refresh !== false) router.refresh();
        return { ok: true, data };
      } catch (e) {
        setError(e instanceof Error ? e.message : "Network error");
        return { ok: false };
      } finally {
        setBusy(false);
      }
    },
    [router],
  );

  return { call, busy, error, setError };
}
