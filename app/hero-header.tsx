"use client";

import { useEffect } from "react";
import { AdminAccountPanel } from "./admin-account-panel";
import { AdminLogin } from "./admin-login";
import { AdminLoginsPanel } from "./admin-logins-panel";
import { useAdminSessionPassword } from "./admin-auth";
import { ProgramConfigWindow } from "./program-config-window";
import { ThemePicker } from "./theme-picker";
import { useProgramConfig } from "./program-config-store";
import { hydrateSiteConfigFromHost } from "./site-config-client";
import { useThemeState } from "./theme-store";

type HeroHeaderProps = {
  adminUsername: string;
  adminPassword: string;
};

export function HeroHeader({
  adminUsername,
  adminPassword,
}: HeroHeaderProps) {
  const programConfig = useProgramConfig();
  const sessionPassword = useAdminSessionPassword();
  // Keep theme subscription mounted so document theme applies for all users.
  useThemeState();

  useEffect(() => {
    void hydrateSiteConfigFromHost();
  }, []);

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
