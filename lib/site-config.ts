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
  customCards: CustomCardRecord[];
  recoveryEmail: string;
  persisted: boolean;
  updatedAt: string | null;
};

export type SiteConfigPatch = {
  programConfig?: ProgramConfig;
  dashboardConfigs?: Record<string, DashboardConfig>;
  dashboardConfig?: DashboardConfig;
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
  return withDefaultProgramLedThresholds({
    dashboardName:
      typeof stored.dashboardName === "string" && stored.dashboardName.trim()
        ? stored.dashboardName
        : DEFAULT_PROGRAM_CONFIG.dashboardName,
    programLead:
      typeof stored.programLead === "string" && stored.programLead.trim()
        ? stored.programLead
        : DEFAULT_PROGRAM_CONFIG.programLead,
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

  return {
    programConfig: sanitizeProgramConfig(entry.programConfig),
    dashboardConfigs,
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
    customCards: config.customCards,
    recoveryEmail: config.adminCredentials.recoveryEmail,
    persisted: config.updatedAt != null,
    updatedAt: config.updatedAt,
  };
}

/** Prefer host-persisted card config; fall back to the compiled default slot. */
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
