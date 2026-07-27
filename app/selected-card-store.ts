"use client";

import { useEffect, useState } from "react";

export const SELECTED_CARD_EVENT = "esad-selected-card-change";

type SelectedCardDetail = {
  dashboardId: string | null;
};

let selectedDashboardId: string | null = null;
let outsideClickBound = false;

function emitSelectedCardChange(dashboardId: string | null) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<SelectedCardDetail>(SELECTED_CARD_EVENT, {
      detail: { dashboardId },
    }),
  );
}

function handleDocumentPointerDown(event: Event) {
  if (!selectedDashboardId) return;
  const target = event.target as HTMLElement | null;
  if (target?.closest(".project-panel")) return;
  setSelectedCardId(null);
}

function ensureOutsideClickListener() {
  if (typeof window === "undefined" || outsideClickBound) return;
  document.addEventListener("pointerdown", handleDocumentPointerDown);
  outsideClickBound = true;
}

export function getSelectedCardId(): string | null {
  return selectedDashboardId;
}

export function setSelectedCardId(dashboardId: string | null): void {
  if (selectedDashboardId === dashboardId) return;
  selectedDashboardId = dashboardId;
  if (dashboardId) {
    ensureOutsideClickListener();
  }
  emitSelectedCardChange(dashboardId);
}

export function toggleSelectedCardId(dashboardId: string): void {
  setSelectedCardId(
    selectedDashboardId === dashboardId ? null : dashboardId,
  );
}

export function useSelectedCardId(): string | null {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    setSelectedId(getSelectedCardId());
    const onChange = (event: Event) => {
      const detail = (event as CustomEvent<SelectedCardDetail>).detail;
      setSelectedId(detail?.dashboardId ?? null);
    };
    window.addEventListener(SELECTED_CARD_EVENT, onChange);
    return () => window.removeEventListener(SELECTED_CARD_EVENT, onChange);
  }, []);

  useEffect(() => {
    if (selectedId) {
      ensureOutsideClickListener();
    }
  }, [selectedId]);

  return selectedId;
}
