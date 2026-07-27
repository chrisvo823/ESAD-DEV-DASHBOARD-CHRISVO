"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { refreshSiteConfigFromHost } from "./site-config-client";

/** How often the dashboard re-pulls card data (Google Sheets + Smartsheet + host config). */
export const DASHBOARD_REFRESH_INTERVAL_MS = 5 * 60 * 1000;

/**
 * Periodically refresh the server-rendered dashboard and host Admin card config.
 * Uses Next.js router.refresh() so RSC data (Open Tasks, Over Due, Current/Next)
 * is re-fetched without a full browser reload.
 */
export function DashboardRefresh() {
  const router = useRouter();
  const lastRefreshAtRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    lastRefreshAtRef.current = Date.now();

    async function refreshDashboard() {
      if (cancelled) return;
      lastRefreshAtRef.current = Date.now();
      try {
        await refreshSiteConfigFromHost();
      } catch {
        // Host config refresh is best-effort; still refresh RSC card metrics.
      }
      if (!cancelled) {
        router.refresh();
      }
    }

    const timer = window.setInterval(() => {
      if (document.visibilityState === "hidden") return;
      void refreshDashboard();
    }, DASHBOARD_REFRESH_INTERVAL_MS);

    const onVisibilityChange = () => {
      if (document.visibilityState !== "visible") return;
      if (
        Date.now() - lastRefreshAtRef.current >=
        DASHBOARD_REFRESH_INTERVAL_MS
      ) {
        void refreshDashboard();
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [router]);

  return null;
}
