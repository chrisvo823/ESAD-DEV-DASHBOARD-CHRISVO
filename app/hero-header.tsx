"use client";

import { AdminAccountPanel } from "./admin-account-panel";
import { AdminLogin } from "./admin-login";
import { AdminLoginsPanel } from "./admin-logins-panel";
import { useAdminSessionPassword } from "./admin-auth";
import { ProgramConfigWindow } from "./program-config-window";
import { ThemePicker } from "./theme-picker";
import type { ProgramConfig } from "../lib/program-config";
import { useProgramConfig } from "./program-config-store";
import { useThemeState } from "./theme-store";

type HeroHeaderProps = {
  adminUsername: string;
  adminPassword: string;
  /** Google Doc Dashboard Configuration (title, lead, LED thresholds). */
  initialProgramConfig: ProgramConfig;
};

export function HeroHeader({
  adminUsername,
  adminPassword,
  initialProgramConfig,
}: HeroHeaderProps) {
  const programConfig = useProgramConfig(initialProgramConfig);
  const sessionPassword = useAdminSessionPassword();
  // Keep theme subscription mounted so document theme applies for all users.
  useThemeState();

  return (
    <>
      <div className="admin-toolbar">
        <ThemePicker />
        <ProgramConfigWindow config={programConfig} />
        <AdminLoginsPanel
          adminPassword={sessionPassword || adminPassword}
        />
        <AdminAccountPanel fallbackPassword={adminPassword} />
        <AdminLogin username={adminUsername} password={adminPassword} />
      </div>
      <header className="hero-header">
        <div className="hero-title-row">
          <img
            className="hero-logo"
            src="/mach-industries-logo.png"
            alt="Mach Industries"
            width={72}
            height={72}
          />
          <h1>{programConfig.dashboardName}</h1>
        </div>
        <div className="hero-subtitle">
          <span />
          {programConfig.programLead}
          <span />
        </div>
      </header>
    </>
  );
}
