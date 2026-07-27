"use client";

import { useEffect, useState } from "react";
import {
  createCustomCardRecord,
  isCustomCardId,
  type CustomCardRecord,
} from "../lib/custom-cards";
import type { DashboardConfig } from "../lib/dashboard-config";
import { writeDashboardConfig } from "./dashboard-config-store";
import {
  hydrateSiteConfigFromHost,
  persistSiteConfigPatch,
  readCachedCustomCards,
  readCachedDashboardConfigs,
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

export function addCustomCard(): CustomCardRecord {
  const existing = readCustomCards();
  const card = createCustomCardRecord(existing.length + 1);
  const cards = [...existing, card];
  const dashboardConfigs = {
    ...readCachedDashboardConfigs(),
    [card.id]: card.config,
  };
  emitCards(cards);
  void persistSiteConfigPatch({
    customCards: cards,
    dashboardConfigs,
  }).catch(() => {
    // Host save failures are surfaced by re-hydration in persist helper.
  });
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
  return next;
}

export function syncCustomCardConfig(config: DashboardConfig): void {
  if (!isCustomCardId(config.dashboardId)) return;
  const cards = readCustomCards();
  const index = cards.findIndex((card) => card.id === config.dashboardId);
  if (index < 0) {
    writeDashboardConfig(config);
    return;
  }
  const next = [...cards];
  next[index] = { id: config.dashboardId, config: { ...config } };
  emitCards(next);
  void persistSiteConfigPatch({
    customCards: next,
    dashboardConfig: config,
  }).catch(() => {
    // Host save failures are surfaced by re-hydration in persist helper.
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
