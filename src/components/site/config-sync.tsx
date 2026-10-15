"use client";

import { usePathname, useRouter } from "next/navigation";
import * as React from "react";

/**
 * Foreground content synchronizer (renders nothing).
 *
 * Route-handler revalidation clears the server ISR cache, but an already-open
 * tab may continue using Next's client router cache. Poll the content digest and
 * refresh the current route when an admin edit is detected. The digest covers
 * site settings, posts, videos, albums/media, friends, and approved comments.
 */
const CHECK_INTERVAL_MS = 10_000;
const REFRESH_RETRY_MS = 30_000;

export function ConfigSync({ version }: { version: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const lastRefresh = React.useRef<{ target: string; at: number } | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    let checking = false;

    async function checkVersion() {
      if (checking) return;
      checking = true;

      try {
        const response = await fetch("/api/site-version", { cache: "no-store" });
        if (!response.ok) return;

        const data = (await response.json()) as { version?: string };
        if (cancelled || !data.version) return;
        if (data.version === version) {
          lastRefresh.current = null;
          return;
        }

        const now = performance.now();
        const previous = lastRefresh.current;
        if (
          !previous ||
          previous.target !== data.version ||
          now - previous.at >= REFRESH_RETRY_MS
        ) {
          // Retry stale/failed refreshes without refreshing on every polling tick.
          lastRefresh.current = { target: data.version, at: now };
          router.refresh();
        }
      } catch {
        // Network errors are transient; the next polling tick will retry.
      } finally {
        checking = false;
      }
    }

    void checkVersion();
    const timer = window.setInterval(() => void checkVersion(), CHECK_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [version, pathname, router]);

  return null;
}
