import {
  DASHBOARD_CONFIGS,
  FIXED_DASHBOARD_IDS,
  getAdminCredentials,
  isFixedDashboardId,
  type DashboardConfig,
  type DashboardId,
  type FixedDashboardId,
} from "./dashboard-config";
import { isCustomCardId, type CustomCardRecord } from "./custom-cards";
import {
  DEFAULT_PROGRAM_CONFIG,
  withDefaultProgramLedThresholds,
  type ProgramConfig,
} from "./program-config";

/** Host-persisted Admin configuration (Themes stay in browser localStorage). */
export type SiteAdminConfig = {
  programConfig: ProgramConfig;
  dashboardConfigs: Record<string, DashboardConfig>;
  /**
   * Selected Card Configuration Google Doc id per dashboard/card id.
   * When set, that Doc is the source of truth for card fields (host values are cache).
   */
  cardConfigDocumentIds: Record<string, string>;
  customCards: CustomCardRecord[];
  adminCredentials: {
    password: string;
    recoveryEmail: string;
  };
  updatedAt: string | null;
};

export type SiteConfigPublic = {
  programConfig: ProgramConfig;
  dashboardConfigs: Record<string, DashboardConfig>;
  cardConfigDocumentIds: Record<string, string>;
  customCards: CustomCardRecord[];
  recoveryEmail: string;
  persisted: boolean;
  updatedAt: string | null;
};

export type SiteConfigPatch = {
  programConfig?: ProgramConfig;
  dashboardConfigs?: Record<string, DashboardConfig>;
  dashboardConfig?: DashboardConfig;
  cardConfigDocumentIds?: Record<string, string>;
  /**
   * When true with `dashboardConfig`, write that card's text into its mapped
   * Google Doc so every user session can pull the update.
   */
  publishCardConfigToGoogleDoc?: boolean;
  customCards?: CustomCardRecord[];
  adminCredentials?: {
    password?: string;
    recoveryEmail?: string;
  };
};

function emptyCustomFallback(id: DashboardId): DashboardConfig {
  return {
    dashboardId: id,
    responsibleEngineer: "",
    boardName: "New Board",
    boardNickname: "NEW",
    googleDriveLink: "",
    smartsheetLink: "",
  };
}

export function cloneDefaultDashboardConfigs(): Record<string, DashboardConfig> {
  return {
    "1": { ...DASHBOARD_CONFIGS["1"] },
    "2": { ...DASHBOARD_CONFIGS["2"] },
    "3": { ...DASHBOARD_CONFIGS["3"] },
    "4": { ...DASHBOARD_CONFIGS["4"] },
  };
}

function mergeDashboardEntry(
  id: DashboardId,
  entry: Partial<DashboardConfig> | undefined,
  fallback: DashboardConfig,
): DashboardConfig {
  if (!entry || typeof entry !== "object") {
    return { ...fallback, dashboardId: id };
  }
  return {
    dashboardId: id,
    responsibleEngineer:
      typeof entry.responsibleEngineer === "string"
        ? entry.responsibleEngineer
        : fallback.responsibleEngineer,
    boardName:
      typeof entry.boardName === "string" ? entry.boardName : fallback.boardName,
    boardNickname:
      typeof entry.boardNickname === "string"
        ? entry.boardNickname
        : fallback.boardNickname,
    googleDriveLink:
      typeof entry.googleDriveLink === "string"
        ? entry.googleDriveLink
        : typeof (entry as { jiraEpicLink?: unknown }).jiraEpicLink === "string"
          ? (entry as { jiraEpicLink: string }).jiraEpicLink
          : fallback.googleDriveLink,
    smartsheetLink:
      typeof entry.smartsheetLink === "string"
        ? entry.smartsheetLink
        : fallback.smartsheetLink,
  };
}

export function sanitizeDashboardConfigs(raw: unknown): Record<string, DashboardConfig> {
  const defaults = cloneDefaultDashboardConfigs();
  if (!raw || typeof raw !== "object") return defaults;

  const stored = raw as Partial<Record<string, Partial<DashboardConfig>>>;
  for (const id of FIXED_DASHBOARD_IDS) {
    defaults[id] = mergeDashboardEntry(id, stored[id], defaults[id]!);
  }

  for (const [id, entry] of Object.entries(stored)) {
    if (isFixedDashboardId(id)) continue;
    if (!isCustomCardId(id)) continue;
    defaults[id] = mergeDashboardEntry(id, entry, emptyCustomFallback(id));
  }

  return defaults;
}

export function sanitizeProgramConfig(raw: unknown): ProgramConfig {
  if (!raw || typeof raw !== "object") {
    return { ...DEFAULT_PROGRAM_CONFIG };
  }
  const stored = raw as Partial<ProgramConfig> & {
    ledGreenLessThan?: number;
    ledYellowGreaterThan?: number;
    ledRedGreaterThan?: number;
  };
  const dashboardName =
    typeof stored.dashboardName === "string" ? stored.dashboardName.trim() : "";
  const storedLead =
    typeof stored.programLead === "string" ? stored.programLead : "";
  // Preserve a single trailing space when present (default "Project Lead: ").
  const programLead = storedLead.trim()
    ? `${storedLead.trim()}${storedLead.endsWith(" ") ? " " : ""}`
    : "";

  return withDefaultProgramLedThresholds({
    dashboardName: dashboardName || DEFAULT_PROGRAM_CONFIG.dashboardName,
    programLead: programLead || DEFAULT_PROGRAM_CONFIG.programLead,
    openTasksLabel: stored.openTasksLabel,
    overDueLabel: stored.overDueLabel,
    currentTaskLabel: stored.currentTaskLabel,
    nextTaskLabel: stored.nextTaskLabel,
    ledGreenAtMost: stored.ledGreenAtMost,
    ledYellowAtLeast: stored.ledYellowAtLeast,
    ledRedAtLeast: stored.ledRedAtLeast,
    ledGreenLessThan: stored.ledGreenLessThan,
    ledYellowGreaterThan: stored.ledYellowGreaterThan,
    ledRedGreaterThan: stored.ledRedGreaterThan,
  });
}

export function sanitizeCustomCard(raw: unknown): CustomCardRecord | null {
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
    config: mergeDashboardEntry(id, config, emptyCustomFallback(id)),
  };
}

export function sanitizeCustomCards(raw: unknown): CustomCardRecord[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((entry) => sanitizeCustomCard(entry))
    .filter((entry): entry is CustomCardRecord => entry != null);
}

/** Keep only fixed/custom card ids mapped to non-empty Google Doc ids. */
export function sanitizeCardConfigDocumentIds(
  raw: unknown,
): Record<string, string> {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, string> = {};
  for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!isFixedDashboardId(id) && !isCustomCardId(id)) continue;
    if (typeof value !== "string") continue;
    const documentId = value.trim();
    if (!documentId) continue;
    out[id] = documentId;
  }
  return out;
}

export function sanitizeAdminCredentials(
  raw: unknown,
  fallbackPassword: string,
): { password: string; recoveryEmail: string } {
  if (!raw || typeof raw !== "object") {
    return { password: fallbackPassword, recoveryEmail: "" };
  }
  const entry = raw as { password?: unknown; recoveryEmail?: unknown };
  return {
    password:
      typeof entry.password === "string" && entry.password.length > 0
        ? entry.password
        : fallbackPassword,
    recoveryEmail:
      typeof entry.recoveryEmail === "string" ? entry.recoveryEmail.trim() : "",
  };
}

export function createDefaultSiteAdminConfig(): SiteAdminConfig {
  const { password } = getAdminCredentials();
  return {
    programConfig: { ...DEFAULT_PROGRAM_CONFIG },
    dashboardConfigs: cloneDefaultDashboardConfigs(),
    cardConfigDocumentIds: {},
    customCards: [],
    adminCredentials: {
      password,
      recoveryEmail: "",
    },
    updatedAt: null,
  };
}

export function sanitizeSiteAdminConfig(raw: unknown): SiteAdminConfig {
  const defaults = createDefaultSiteAdminConfig();
  if (!raw || typeof raw !== "object") return defaults;

  const entry = raw as Partial<SiteAdminConfig>;
  const dashboardConfigs = sanitizeDashboardConfigs(entry.dashboardConfigs);
  const customCards = sanitizeCustomCards(entry.customCards);

  // Keep custom card configs mirrored into dashboardConfigs.
  for (const card of customCards) {
    dashboardConfigs[card.id] = { ...card.config, dashboardId: card.id };
  }

  // Drop orphaned custom configs not listed in customCards.
  for (const id of Object.keys(dashboardConfigs)) {
    if (isFixedDashboardId(id)) continue;
    if (!customCards.some((card) => card.id === id)) {
      delete dashboardConfigs[id];
    }
  }

  const cardConfigDocumentIds = sanitizeCardConfigDocumentIds(
    entry.cardConfigDocumentIds,
  );
  // Drop orphaned document bindings for removed custom cards.
  for (const id of Object.keys(cardConfigDocumentIds)) {
    if (isFixedDashboardId(id)) continue;
    if (!customCards.some((card) => card.id === id)) {
      delete cardConfigDocumentIds[id];
    }
  }

  return {
    programConfig: sanitizeProgramConfig(entry.programConfig),
    dashboardConfigs,
    cardConfigDocumentIds,
    customCards,
    adminCredentials: sanitizeAdminCredentials(
      entry.adminCredentials,
      defaults.adminCredentials.password,
    ),
    updatedAt:
      typeof entry.updatedAt === "string" && entry.updatedAt.trim()
        ? entry.updatedAt
        : null,
  };
}

export function toPublicSiteConfig(config: SiteAdminConfig): SiteConfigPublic {
  return {
    programConfig: config.programConfig,
    dashboardConfigs: config.dashboardConfigs,
    cardConfigDocumentIds: { ...config.cardConfigDocumentIds },
    customCards: config.customCards,
    recoveryEmail: config.adminCredentials.recoveryEmail,
    persisted: config.updatedAt != null,
    updatedAt: config.updatedAt,
  };
}

/**
 * Prefer live/host card config (already overlaid from the selected Google Doc
 * when a document id is mapped); fall back to the compiled default slot.
 */
export function resolveHostDashboardConfig(
  dashboardId: DashboardId,
  hostConfigs: Record<string, DashboardConfig>,
  fallback: DashboardConfig,
): DashboardConfig {
  const host = hostConfigs[dashboardId];
  if (!host) return { ...fallback, dashboardId };
  return { ...host, dashboardId };
}

export function applySiteConfigPatch(
  current: SiteAdminConfig,
  patch: SiteConfigPatch,
): SiteAdminConfig {
  const next: SiteAdminConfig = {
    ...current,
    programConfig: { ...current.programConfig },
    dashboardConfigs: { ...current.dashboardConfigs },
    cardConfigDocumentIds: { ...current.cardConfigDocumentIds },
    customCards: current.customCards.map((card) => ({
      id: card.id,
      config: { ...card.config },
    })),
    adminCredentials: { ...current.adminCredentials },
  };

  if (patch.programConfig) {
    next.programConfig = sanitizeProgramConfig(patch.programConfig);
  }

  if (patch.dashboardConfigs) {
    next.dashboardConfigs = sanitizeDashboardConfigs(patch.dashboardConfigs);
  }

  if (patch.dashboardConfig) {
    const config = mergeDashboardEntry(
      patch.dashboardConfig.dashboardId,
      patch.dashboardConfig,
      emptyCustomFallback(patch.dashboardConfig.dashboardId),
    );
    next.dashboardConfigs[config.dashboardId] = config;
    if (isCustomCardId(config.dashboardId)) {
      const index = next.customCards.findIndex(
        (card) => card.id === config.dashboardId,
      );
      if (index >= 0) {
        next.customCards[index] = { id: config.dashboardId, config };
      }
    }
  }

  if (patch.cardConfigDocumentIds) {
    next.cardConfigDocumentIds = {
      ...next.cardConfigDocumentIds,
      ...sanitizeCardConfigDocumentIds(patch.cardConfigDocumentIds),
    };
  }

  if (patch.customCards) {
    next.customCards = sanitizeCustomCards(patch.customCards);
    for (const card of next.customCards) {
      next.dashboardConfigs[card.id] = { ...card.config, dashboardId: card.id };
    }
    for (const id of Object.keys(next.dashboardConfigs)) {
      if (isFixedDashboardId(id as FixedDashboardId)) continue;
      if (!next.customCards.some((card) => card.id === id)) {
        delete next.dashboardConfigs[id];
      }
    }
    for (const id of Object.keys(next.cardConfigDocumentIds)) {
      if (isFixedDashboardId(id as FixedDashboardId)) continue;
      if (!next.customCards.some((card) => card.id === id)) {
        delete next.cardConfigDocumentIds[id];
      }
    }
  }

  if (patch.adminCredentials) {
    next.adminCredentials = sanitizeAdminCredentials(
      {
        password:
          patch.adminCredentials.password ?? next.adminCredentials.password,
        recoveryEmail:
          patch.adminCredentials.recoveryEmail ??
          next.adminCredentials.recoveryEmail,
      },
      getAdminCredentials().password,
    );
  }

  next.updatedAt = new Date().toISOString();
  return sanitizeSiteAdminConfig(next);
}
