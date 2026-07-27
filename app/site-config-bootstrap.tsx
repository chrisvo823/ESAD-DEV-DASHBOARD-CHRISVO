"use client";

import {
  createContext,
  useContext,
  useEffect,
  type ReactNode,
} from "react";
import type { ProgramConfig } from "../lib/program-config";
import type { SiteConfigPublic } from "../lib/site-config";
import { DEFAULT_PROGRAM_CONFIG } from "../lib/program-config";
import {
  refreshSiteConfigFromHost,
  seedSiteConfigFromServer,
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
 * Seed client cache from the host-loaded SSR payload, then re-pull from
 * `/api/site-config` so Card and Dashboard Configuration stay host-sourced.
 */
export function SiteConfigBootstrap({
  initial,
  children,
}: SiteConfigBootstrapProps) {
  // Client render only — avoids cross-request cache leaks on the server.
  seedSiteConfigFromServer(initial);

  useEffect(() => {
    void refreshSiteConfigFromHost();
  }, []);

  return (
    <HostProgramConfigContext.Provider value={initial.programConfig}>
      {children}
    </HostProgramConfigContext.Provider>
  );
}
