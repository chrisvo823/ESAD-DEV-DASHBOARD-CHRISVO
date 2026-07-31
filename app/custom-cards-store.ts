"use client";

import { useEffect, useState } from "react";
import {
  createCustomCardRecord,
  isCustomCardId,
  type CustomCardRecord,
} from "../lib/custom-cards";
import {
  DASHBOARD_CONFIGS,
  FIXED_DASHBOARD_IDS,
  type DashboardConfig,
} from "../lib/dashboard-config";
import { requireAdminSessionForDriveWrite } from "./admin-auth";
import {
  saveAllCardConfigsToGoogleDoc,
  writeDashboardConfig,
} from "./dashboard-config-store";
import { ensureGoogleDriveAccessToken } from "./ensure-google-drive-access";
import { pickAdminConfigDriveFile } from "./open-admin-config-drive";
import {
  getCachedSiteConfig,
  hydrateSiteConfigFromHost,
  persistSiteConfigPatch,
  readCachedCustomCards,
  readCachedDashboardConfigs,
  refreshSiteConfigFromHost,
  subscribeSiteConfig,
} from "./site-config-client";

/** @deprecated Admin config is host-persisted; key kept for migration only. */
export const CUSTOM_CARDS_STORAGE_KEY = "esad-custom-cards";
export const CUSTOM_CARDS_EVENT = "esad-custom-cards-change";

function emitCards(cards: CustomCardRecord[]) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(CUSTOM_CARDS_EVENT, { detail: { cards } }),
  );
}

export function readCustomCards(): CustomCardRecord[] {
  if (typeof window === "undefined") return [];
  return readCachedCustomCards();
}

function resolveBoundCardConfigDocumentId(): string | null {
  const ids = getCachedSiteConfig().cardConfigDocumentIds;
  for (const id of FIXED_DASHBOARD_IDS) {
    const documentId = ids[id]?.trim();
    if (documentId) return documentId;
  }
  for (const documentId of Object.values(ids)) {
    const trimmed = documentId?.trim();
    if (trimmed) return trimmed;
  }
  return null;
}

function allCardConfigsForPublish(
  customCards: CustomCardRecord[],
): DashboardConfig[] {
  const cached = readCachedDashboardConfigs();
  const fixed = FIXED_DASHBOARD_IDS.map(
    (id) => cached[id] ?? { ...DASHBOARD_CONFIGS[id] },
  );
  const extras = customCards.map(
    (card) => cached[card.id] ?? { ...card.config, dashboardId: card.id },
  );
  return [...fixed, ...extras];
}

/**
 * Append a new board card with the next sequential Card #, persist host
 * config, and immediately write every Card # section to the bound Google Doc.
 */
export async function addCustomCard(): Promise<CustomCardRecord> {
  requireAdminSessionForDriveWrite();
  const existing = readCustomCards();
  const cachedConfigs = readCachedDashboardConfigs();
  const card = createCustomCardRecord([
    ...FIXED_DASHBOARD_IDS,
    ...Object.keys(cachedConfigs),
    ...existing.map((entry) => entry.id),
  ]);
  const cards = [...existing, card];
  const dashboardConfigs = {
    ...cachedConfigs,
    [card.id]: card.config,
  };
  emitCards(cards);

  let documentId = resolveBoundCardConfigDocumentId();
  if (!documentId) {
    const picked = await pickAdminConfigDriveFile("card");
    if (!picked) {
      // Still persist locally/host so the card appears; Drive write deferred.
      await persistSiteConfigPatch({
        customCards: cards,
        dashboardConfigs,
      });
      return card;
    }
    documentId = picked.id;
  }

  try {
    await ensureGoogleDriveAccessToken({
      reason:
        "Sign in with Google Drive so the new card can be written to the Card Configuration Doc.",
    });
  } catch {
    // Server service-account / env token may still publish the Doc.
  }

  await saveAllCardConfigsToGoogleDoc({
    configs: allCardConfigsForPublish(cards),
    documentId,
  });
  await refreshSiteConfigFromHost();
  return card;
}

export function removeCustomCard(id: string): CustomCardRecord[] {
  const next = readCustomCards().filter((card) => card.id !== id);
  const dashboardConfigs = { ...readCachedDashboardConfigs() };
  delete dashboardConfigs[id];
  emitCards(next);
  void persistSiteConfigPatch({
    customCards: next,
    dashboardConfigs,
  }).catch(() => {
    // Host save failures are surfaced by re-hydration in persist helper.
  });

  const documentId = resolveBoundCardConfigDocumentId();
  if (documentId) {
    void (async () => {
      try {
        await ensureGoogleDriveAccessToken({
          reason:
            "Sign in with Google Drive so Card Configuration can be updated.",
        });
      } catch {
        // best-effort
      }
      await saveAllCardConfigsToGoogleDoc({
        configs: allCardConfigsForPublish(next),
        documentId,
      });
      await refreshSiteConfigFromHost();
    })().catch(() => {
      // Host/Drive failures surface via re-hydration.
    });
  }
  return next;
}

export async function syncCustomCardConfig(
  config: DashboardConfig,
): Promise<void> {
  if (!isCustomCardId(config.dashboardId)) return;
  const cards = readCustomCards();
  const index = cards.findIndex((card) => card.id === config.dashboardId);
  if (index < 0) {
    await writeDashboardConfig(config);
    return;
  }
  const next = [...cards];
  next[index] = { id: config.dashboardId, config: { ...config } };
  emitCards(next);
  await persistSiteConfigPatch({
    customCards: next,
    dashboardConfig: config,
  });
}

export function useCustomCards(): CustomCardRecord[] {
  const [cards, setCards] = useState<CustomCardRecord[]>([]);

  useEffect(() => {
    let cancelled = false;
    void hydrateSiteConfigFromHost().then(() => {
      if (!cancelled) setCards(readCachedCustomCards());
    });

    const unsubscribe = subscribeSiteConfig(() => {
      setCards(readCachedCustomCards());
    });
    const onLegacy = (event: Event) => {
      const detail = (event as CustomEvent<{ cards: CustomCardRecord[] }>).detail;
      if (Array.isArray(detail?.cards)) setCards(detail.cards);
    };
    window.addEventListener(CUSTOM_CARDS_EVENT, onLegacy);

    return () => {
      cancelled = true;
      unsubscribe();
      window.removeEventListener(CUSTOM_CARDS_EVENT, onLegacy);
    };
  }, []);

  return cards;
}
