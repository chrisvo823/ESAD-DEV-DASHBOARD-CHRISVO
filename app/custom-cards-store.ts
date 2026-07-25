"use client";

import { useEffect, useState } from "react";
import {
  createCustomCardRecord,
  isCustomCardId,
  type CustomCardRecord,
} from "../lib/custom-cards";
import type { DashboardConfig } from "../lib/dashboard-config";
import {
  DASHBOARD_CONFIG_STORAGE_KEY,
  readDashboardConfigs,
  writeDashboardConfig,
} from "./dashboard-config-store";

export const CUSTOM_CARDS_STORAGE_KEY = "esad-custom-cards";
export const CUSTOM_CARDS_EVENT = "esad-custom-cards-change";

function sanitizeRecord(raw: unknown): CustomCardRecord | null {
  if (!raw || typeof raw !== "object") return null;
  const entry = raw as Partial<CustomCardRecord> & {
    config?: Partial<DashboardConfig>;
  };
  const id = typeof entry.id === "string" ? entry.id.trim() : "";
  if (!id || !isCustomCardId(id)) return null;

  const config = entry.config;
  if (!config || typeof config !== "object") return null;

  return {
    id,
    config: {
      dashboardId: id,
      responsibleEngineer:
        typeof config.responsibleEngineer === "string"
          ? config.responsibleEngineer
          : "",
      boardName:
        typeof config.boardName === "string" && config.boardName.trim()
          ? config.boardName
          : "New Board",
      boardNickname:
        typeof config.boardNickname === "string" && config.boardNickname.trim()
          ? config.boardNickname
          : "NEW",
      googleDriveLink:
        typeof config.googleDriveLink === "string"
          ? config.googleDriveLink
          : typeof (config as { jiraEpicLink?: unknown }).jiraEpicLink ===
              "string"
            ? (config as { jiraEpicLink: string }).jiraEpicLink
            : "",
      smartsheetLink:
        typeof config.smartsheetLink === "string" ? config.smartsheetLink : "",
    },
  };
}

export function readCustomCards(): CustomCardRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(CUSTOM_CARDS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((entry) => sanitizeRecord(entry))
      .filter((entry): entry is CustomCardRecord => entry != null);
  } catch {
    return [];
  }
}

function persistCustomCards(cards: CustomCardRecord[]): CustomCardRecord[] {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(
      CUSTOM_CARDS_STORAGE_KEY,
      JSON.stringify(cards),
    );
    window.dispatchEvent(
      new CustomEvent(CUSTOM_CARDS_EVENT, { detail: { cards } }),
    );
  }
  return cards;
}

export function addCustomCard(): CustomCardRecord {
  const existing = readCustomCards();
  const card = createCustomCardRecord(existing.length + 1);
  writeDashboardConfig(card.config);
  return persistCustomCards([...existing, card])[existing.length] ?? card;
}

export function removeCustomCard(id: string): CustomCardRecord[] {
  const next = readCustomCards().filter((card) => card.id !== id);
  // Drop orphaned config entry for this custom id.
  if (typeof window !== "undefined") {
    const configs = readDashboardConfigs();
    if (id in configs) {
      delete configs[id];
      window.localStorage.setItem(
        DASHBOARD_CONFIG_STORAGE_KEY,
        JSON.stringify(configs),
      );
    }
  }
  return persistCustomCards(next);
}

export function syncCustomCardConfig(config: DashboardConfig): void {
  if (!isCustomCardId(config.dashboardId)) return;
  const cards = readCustomCards();
  const index = cards.findIndex((card) => card.id === config.dashboardId);
  if (index < 0) return;
  const next = [...cards];
  next[index] = { id: config.dashboardId, config: { ...config } };
  persistCustomCards(next);
}

export function useCustomCards(): CustomCardRecord[] {
  const [cards, setCards] = useState<CustomCardRecord[]>([]);

  useEffect(() => {
    setCards(readCustomCards());
    const onChange = (event: Event) => {
      const detail = (event as CustomEvent<{ cards: CustomCardRecord[] }>)
        .detail;
      if (Array.isArray(detail?.cards)) {
        setCards(detail.cards);
        return;
      }
      setCards(readCustomCards());
    };
    const onStorage = (event: StorageEvent) => {
      if (
        event.key === CUSTOM_CARDS_STORAGE_KEY ||
        event.key === "esad-dashboard-configs"
      ) {
        setCards(readCustomCards());
      }
    };
    window.addEventListener(CUSTOM_CARDS_EVENT, onChange);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(CUSTOM_CARDS_EVENT, onChange);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  return cards;
}
