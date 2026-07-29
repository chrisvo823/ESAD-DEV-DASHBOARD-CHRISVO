"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { ProgramConfig } from "../lib/program-config";
import type { SiteConfigPublic } from "../lib/site-config";
import { DEFAULT_PROGRAM_CONFIG } from "../lib/program-config";
import {
  getCachedSiteConfig,
  refreshSiteConfigFromHost,
  seedSiteConfigFromServer,
  subscribeSiteConfig,
} from "./site-config-client";

const HostProgramConfigContext = createContext<ProgramConfig>(
  DEFAULT_PROGRAM_CONFIG,
);

/** Host Dashboard Configuration provided by SSR for first paint + hooks. */
export function useHostProgramConfig(): ProgramConfig {
  return useContext(HostProgramConfigContext);
}

type SiteConfigBootstrapProps = {
  /** Host Admin config from the server (Card + Dashboard Configuration). */
  initial: SiteConfigPublic;
  children: ReactNode;
};

/**
 * Seed client cache from the SSR payload (already Google Doc–backed), then
 * re-pull `/api/site-config` so every user's Hero stays Doc-sourced.
 */
export function SiteConfigBootstrap({
  initial,
  children,
}: SiteConfigBootstrapProps) {
  // Client render only — avoids cross-request cache leaks on the server.
  seedSiteConfigFromServer(initial);
  const [programConfig, setProgramConfig] = useState<ProgramConfig>(
    () => getCachedSiteConfig().programConfig ?? initial.programConfig,
  );

  useEffect(() => {
    void refreshSiteConfigFromHost().then((config) => {
      setProgramConfig(config.programConfig);
    });
    return subscribeSiteConfig(() => {
      setProgramConfig(getCachedSiteConfig().programConfig);
    });
  }, []);

  return (
    <HostProgramConfigContext.Provider value={programConfig}>
      {children}
    </HostProgramConfigContext.Provider>
  );
}
