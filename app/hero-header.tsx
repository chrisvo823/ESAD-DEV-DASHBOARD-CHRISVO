"use client";

import { AdminAccountPanel } from "./admin-account-panel";
import { AdminLogin } from "./admin-login";
import { ProgramConfigWindow } from "./program-config-window";
import { ThemePicker } from "./theme-picker";
import { useProgramConfig } from "./program-config-store";
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
  // Keep theme subscription mounted so document theme applies for all users.
  useThemeState();

  return (
    <>
      <div className="admin-toolbar">
        <ThemePicker />
        <ProgramConfigWindow config={programConfig} />
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
