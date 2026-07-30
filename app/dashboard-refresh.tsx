"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { refreshSiteConfigFromHost } from "./site-config-client";

/** How often the dashboard re-pulls Google Drive config + card data. */
export const DASHBOARD_REFRESH_INTERVAL_MS = 3 * 60 * 1000;

/**
 * Periodically refresh host Admin config from Google Drive and re-render
 * server card metrics (Google Sheets / Smartsheet). Uses Next.js
 * router.refresh() so RSC data is re-fetched without a full browser reload.
 */
export function DashboardRefresh() {
  const router = useRouter();
  const lastRefreshAtRef = useRef(0);
  const inFlightRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    lastRefreshAtRef.current = Date.now();

    async function refreshDashboard() {
      if (cancelled || inFlightRef.current) return;
      inFlightRef.current = true;
      lastRefreshAtRef.current = Date.now();
      try {
        try {
          await refreshSiteConfigFromHost();
        } catch {
          // Host / Google Drive config refresh is best-effort; still refresh RSC.
        }
        if (!cancelled) {
          router.refresh();
        }
      } finally {
        inFlightRef.current = false;
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
