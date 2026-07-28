import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function readHostProgramIdentity() {
  try {
    const raw = await readFile(
      new URL("../.data/admin-site-config.json", import.meta.url),
      "utf8",
    );
    const parsed = JSON.parse(raw);
    return {
      dashboardName: parsed.programConfig?.dashboardName?.trim() ?? "",
      programLead: parsed.programConfig?.programLead?.trim() ?? "",
    };
  } catch {
    return { dashboardName: "", programLead: "" };
  }
}

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the host-configured dashboard", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  // Identity must come from host Dashboard Configuration (not compiled defaults).
  const { dashboardName, programLead } = await readHostProgramIdentity();
  if (dashboardName) {
    assert.match(
      html,
      new RegExp(`<title>${escapeRegExp(dashboardName)}<\\/title>`, "i"),
    );
    assert.match(html, new RegExp(escapeRegExp(dashboardName)));
  } else {
    assert.match(html, /<title>Dashboard<\/title>/i);
  }
  if (programLead) {
    assert.match(html, new RegExp(escapeRegExp(programLead)));
  }
  assert.doesNotMatch(
    await readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    /MACH ESAD Development Dashboard/,
  );
  assert.doesNotMatch(
    await readFile(new URL("../lib/program-config.ts", import.meta.url), "utf8"),
    /MACH ESAD Development Dashboard|Engineering Program Office/,
  );
  assert.doesNotMatch(
    await readFile(new URL("../app/company-auth-gate.tsx", import.meta.url), "utf8"),
    /MACH ESAD Dashboard|MACH ESAD Development Dashboard/,
  );
  assert.match(html, /Admin login/);
  assert.match(html, /Responsible Engineer/);
  assert.match(html, /Bruno Abousleiman/);
  assert.match(html, /Digital Safety Board/);
  assert.match(html, /High Voltage Fireset Board/);
  assert.match(html, /CPLD - Primary/);
  assert.match(html, /CPLD - Independent/);
  assert.match(html, /data-dashboard-id="1"/);
  assert.match(html, /data-dashboard-id="2"/);
  assert.match(html, /data-dashboard-id="3"/);
  assert.match(html, /data-dashboard-id="4"/);
  assert.match(html, /Program status/);
  assert.match(html, /Completed Tasks/);
  assert.match(html, /Open Tasks/);
  assert.match(html, /Overdue Tasks/);
  assert.match(
    html,
    /Program status: \d+(?:\.\d+)?% completed tasks, \d+(?:\.\d+)?% open tasks, \d+(?:\.\d+)?% overdue tasks/,
  );
  assert.match(
    html,
    /Completed Tasks<\/span><strong>\d+(?:\.\d+)?%<\/strong>/,
  );
  assert.match(
    html,
    /Overdue Tasks<\/span><strong>\d+(?:\.\d+)?%<\/strong>/,
  );
  assert.doesNotMatch(html, /60 percent on track/);
  assert.match(html, /Task progress [\d.]+ percent done versus open/);
  assert.match(html, /\d+(?:\.\d+)?% done · \d+ done \/ \d+ open/);
  assert.match(html, /SYNC <!-- -->JUL \d{1,2}, 2026/);
  assert.match(
    html,
    /href="https:\/\/docs\.google\.com\/spreadsheets\/d\/1RbnLe7FBrnT1njFWnsVyW74Iq2N5miTH9vFmRwagzps\/edit\?usp=drive_link"/,
  );
  assert.match(
    html,
    /href="https:\/\/docs\.google\.com\/spreadsheets\/d\/1CQrxwKHPkqQhaFarLwiuUW9zUMU_yTRlfArl_lNzdZ8\/edit\?usp=drive_link"/,
  );
  assert.match(
    html,
    /href="https:\/\/docs\.google\.com\/spreadsheets\/d\/1kW_IlmrhvNfyVXYB-5gph5UOo1wR40SaaL1oZgLr29U\/edit\?usp=drive_link"/,
  );
  assert.match(
    html,
    /href="https:\/\/docs\.google\.com\/spreadsheets\/d\/1ZjX1S4u3OfrCWuNbITP8CltV0tNezXpml7V8dQqur4M\/edit\?usp=drive_link"/,
  );
  assert.match(html, />Open Tasks<\/a>/);
  assert.match(html, /Over Due/);
  assert.match(html, /Current Task/);
  assert.match(html, /Next Task/);
  assert.match(
    html,
    /Digital Safety Board[\s\S]*?Open Tasks[\s\S]*?<dd>\d+<\/dd>/,
  );
  assert.match(
    html,
    /Digital Safety Board[\s\S]*?Over Due[\s\S]*?<dd>\d+<\/dd>/,
  );
  assert.match(
    html,
    /High Voltage Fireset Board[\s\S]*?Open Tasks[\s\S]*?Over Due[\s\S]*?Current Task[\s\S]*?Next Task/,
  );
  assert.match(
    html,
    /CPLD - Primary[\s\S]*?Open Tasks[\s\S]*?Over Due[\s\S]*?Current Task[\s\S]*?Next Task/,
  );
  assert.match(
    html,
    /CPLD - Independent[\s\S]*?Open Tasks[\s\S]*?Over Due[\s\S]*?Current Task[\s\S]*?Next Task/,
  );
  assert.match(html, /task-hover-trigger--open/);
  assert.match(html, /task-hover-trigger--overdue/);
  assert.match(html, /task-hover-trigger--schedule/);
  assert.match(html, /metric-row--text/);
  assert.match(html, /metric-task-name/);
  assert.match(html, /metric-task-name-link/);
  assert.match(html, /metric-task-date/);
  assert.match(html, /Current Task[\s\S]*?metric-task-date[\s\S]*?Next Task/);
  assert.match(html, /Current Task[\s\S]*?Next Task/);
  // Without SMARTSHEET_ACCESS_TOKEN, schedule falls back to static revisions —
  // never wipe Current/Next Task into an unlinked Error state.
  assert.doesNotMatch(
    html,
    /Current Task[\s\S]*?metric-task-name[\s\S]*?>Error</,
  );
  assert.doesNotMatch(
    html,
    /Next Task[\s\S]*?metric-task-name[\s\S]*?>Error</,
  );
  // Today (late Jul 2026): Schematic is Current; Layout is Next (not Rev B Requirements).
  assert.match(html, /Schematic/);
  assert.match(html, /Jul 24 – Aug 20, 2026/);
  assert.match(html, /Layout/);
  assert.match(html, /Aug 21 – Sep 29, 2026/);
  // DSB Block Diagram + Review must keep Smartsheet Start/Finish (07/17–07/23).
  assert.match(html, /Block Diagram \+ Review/);
  assert.match(html, /2026-07-17T08:00:00/);
  assert.match(html, /2026-07-23T16:59:59/);
  assert.doesNotMatch(html, /2026-07-22T16:59:59/);
  assert.doesNotMatch(html, /2026-08-07T08:00:00/);
  assert.doesNotMatch(html, />Schedule</);
  assert.doesNotMatch(
    html,
    /metric-task-name[\s\S]*?Digital Safety Board \(DSB\)/,
  );
  assert.match(
    html,
    /href="https:\/\/app\.smartsheet\.com\/sheets\/MQWP7M7WVcg7J7q5JFqvwV8mMpHVMx8w3wmXwMW1\?rowId=\d+"/,
  );
  assert.match(html, /Over Due/);
  assert.match(
    html,
    /aria-label="(?:No open tasks with due dates|\d+ open tasks with due dates)"[^>]*>[\s\S]*?class="metric-fill metric-fill--0 metric-fill--program-open"[^>]*style="width:\d+(?:\.\d+)?%"/,
  );
  assert.match(
    html,
    /aria-label="(?:No open tasks with due dates|\d+ of \d+ open tasks overdue)"[^>]*>[\s\S]*?class="metric-fill metric-fill--1 metric-fill--program-overdue"/,
  );
  // Open Tasks bar is full-scale; Over Due is overdue/open (≤ 100%).
  assert.match(html, /metric-fill--program-open"[^>]*style="width:100%"/);
  assert.match(
    html,
    /metric-fill--program-overdue"[^>]*style="width:\d+(?:\.\d+)?%"/,
  );
  assert.doesNotMatch(html, /Your site is taking shape|react-loading-skeleton|Codex/i);
});

test("keeps dashboard metadata and project data in source", async () => {
  const [page, layout, packageJson, hover, scheduleHover] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../app/task-hover.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/schedule-hover.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(page, /const projects: Project\[\] = \[/);
  assert.match(page, /name: "Digital Safety Board"/);
  assert.match(page, /label: "Open Tasks"/);
  assert.match(page, /label: "Over Due"/);
  assert.match(page, /statusFromOverdueCount/);
  assert.match(page, /label: "Current Task"/);
  assert.match(page, /label: "Next Task"/);
  assert.match(page, /valueText: current\?\.name|const valueText = current\?\.name/);
  assert.match(
    page,
    /valueText: schedule\.nextTask\?\.name|const valueText = next\?\.name|const valueText = schedule\.nextTask\?\.name/,
  );
  assert.match(page, /valuePercentLabel/);
  assert.match(page, /valueDateLabel/);
  assert.match(page, /formatSchedulePercentComplete/);
  assert.match(page, /formatScheduleDateRange/);
  assert.match(page, /current\?\.start,\s*current\?\.finish/);
  assert.match(page, /next\?\.start,\s*next\?\.finish/);
  assert.match(
    page,
    /"Block Diagram \+ Review",\s*(?:\/\/[^\n]*\n\s*)*"2026-07-17T08:00:00",\s*(?:\/\/[^\n]*\n\s*)*"2026-07-23T16:59:59"/,
  );
  assert.match(page, /focusTaskId: current\?\.id/);
  assert.match(page, /focusTaskId: next\?\.id/);
  assert.match(page, /current\?\.permalink/);
  assert.match(page, /next\?\.permalink/);
  assert.match(page, /smartsheetConfigHref/);
  assert.match(page, /smartsheetHrefFromConfig/);
  assert.match(page, /metricsWithScheduleStats/);
  assert.match(page, /fallbackScheduleFromMetrics/);
  assert.match(page, /findCurrentScheduleTask/);
  assert.match(page, /findNextScheduleTask/);
  assert.match(page, /isSchedulePlaceholder/);
  assert.match(page, /hideValueBar: true/);
  assert.match(
    await readFile(new URL("../app/project-panel.tsx", import.meta.url), "utf8"),
    /smartsheetHrefFromConfig/,
  );
  assert.match(
    await readFile(new URL("../app/project-panel.tsx", import.meta.url), "utf8"),
    /hrefMatchesSmartsheetConfig/,
  );
  assert.match(
    await readFile(new URL("../app/project-panel.tsx", import.meta.url), "utf8"),
    /metric-task-percent/,
  );
  assert.match(
    await readFile(new URL("../app/project-panel.tsx", import.meta.url), "utf8"),
    /metric-task-date/,
  );
  assert.match(scheduleHover, /focusTaskIdProp/);
  assert.match(page, /stats\.overdueTasks/);
  assert.match(scheduleHover, /findCurrentScheduleTaskId/);
  assert.match(scheduleHover, /findNextScheduleTaskId/);
  assert.match(scheduleHover, /is-\$\{focus\}-work/);
  assert.match(scheduleHover, /schedule-focus-arrow/);
  assert.match(scheduleHover, /focus === "next"/);
  assert.match(page, /detailItems: stats\.openItems/);
  assert.match(page, /detailItems: stats\.overdueItems/);
  assert.match(page, /fetchAllProjectTaskStats/);
  assert.match(page, /fetchAllProjectScheduleStats/);
  assert.match(page, /ESAD_PROJECT_INTEGRATIONS/);
  assert.match(page, /sheetEditUrlFor/);
  assert.match(page, /googleDriveLinksByCode/);
  assert.match(page, /resolveGoogleDriveSource/);
  assert.match(page, /resolveSmartsheetSource/);
  assert.match(page, /HeroHeader/);
  assert.match(page, /ProjectPanel/);
  assert.match(page, /CustomCardsSection/);
  assert.match(page, /DashboardRefresh/);
  assert.match(page, /loadSiteAdminConfig/);
  assert.match(page, /DASHBOARD_CONFIGS/);

  const dashboardRefresh = await readFile(
    new URL("../app/dashboard-refresh.tsx", import.meta.url),
    "utf8",
  );
  assert.match(dashboardRefresh, /DASHBOARD_REFRESH_INTERVAL_MS/);
  assert.match(dashboardRefresh, /5 \* 60 \* 1000/);
  assert.match(dashboardRefresh, /router\.refresh\(\)/);
  assert.match(dashboardRefresh, /refreshSiteConfigFromHost/);
  assert.match(dashboardRefresh, /visibilitychange/);

  const customCardsSection = await readFile(
    new URL("../app/custom-cards-section.tsx", import.meta.url),
    "utf8",
  );
  assert.match(customCardsSection, /Add Card/);
  assert.match(customCardsSection, /addCustomCard/);
  assert.match(customCardsSection, /custom-systems-grid/);
  assert.match(customCardsSection, /layout="custom"/);
  assert.match(customCardsSection, /Remove Card/);

  const heroHeader = await readFile(
    new URL("../app/hero-header.tsx", import.meta.url),
    "utf8",
  );
  assert.match(heroHeader, /AdminLogin/);
  assert.match(heroHeader, /ProgramConfigWindow/);
  assert.match(heroHeader, /ThemePicker/);
  assert.match(heroHeader, /AdminLoginsPanel/);
  assert.match(heroHeader, /AdminAccountPanel/);
  assert.match(heroHeader, /admin-toolbar/);
  assert.match(heroHeader, /programConfig\.dashboardName/);
  assert.match(heroHeader, /programConfig\.programLead/);
  assert.match(heroHeader, /hero-logo/);
  assert.match(heroHeader, /mach-industries-logo\.png/);
  assert.match(heroHeader, /Mach Industries/);
  assert.match(heroHeader, /hero-title-row/);

  const themePicker = await readFile(
    new URL("../app/theme-picker.tsx", import.meta.url),
    "utf8",
  );
  assert.match(themePicker, /THEME_OPTIONS/);
  assert.match(themePicker, /writeThemeSelection/);
  // Themes are available without admin login.
  assert.doesNotMatch(themePicker, /useAdminAuthenticated/);
  assert.doesNotMatch(themePicker, /if \(!authenticated\) return null/);
  assert.match(themePicker, /no admin login required/i);

  // Admin configuration is host-persisted; only Themes stay in localStorage.
  const [
    siteConfigClient,
    themeStore,
    siteConfigRoute,
    programConfigStore,
    dashboardConfigStore,
  ] = await Promise.all([
    readFile(new URL("../app/site-config-client.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/theme-store.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/site-config/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/program-config-store.ts", import.meta.url), "utf8"),
    readFile(
      new URL("../app/dashboard-config-store.ts", import.meta.url),
      "utf8",
    ),
  ]);
  assert.match(siteConfigRoute, /getPublicSiteConfig/);
  assert.match(siteConfigRoute, /updateSiteAdminConfig/);
  assert.match(siteConfigClient, /persistSiteConfigPatch/);
  assert.match(siteConfigClient, /hydrateSiteConfigFromHost/);
  assert.match(siteConfigClient, /seedSiteConfigFromServer/);
  assert.match(siteConfigClient, /\/api\/site-config/);
  assert.match(programConfigStore, /persistSiteConfigPatch/);
  assert.match(programConfigStore, /programConfig:\s*next/);
  assert.match(dashboardConfigStore, /persistSiteConfigPatch/);
  assert.match(dashboardConfigStore, /dashboardConfig:/);
  assert.doesNotMatch(
    programConfigStore,
    /localStorage\.setItem\(\s*PROGRAM_CONFIG_STORAGE_KEY/,
  );
  assert.doesNotMatch(
    dashboardConfigStore,
    /localStorage\.setItem\(\s*DASHBOARD_CONFIG_STORAGE_KEY/,
  );

  assert.match(themeStore, /localStorage\.setItem\(THEME_STORAGE_KEY/);
  assert.match(themeStore, /esad-dashboard-theme/);
  assert.match(heroHeader, /initialProgramConfig/);
  assert.match(heroHeader, /useProgramConfig\(initialProgramConfig\)/);

  const [siteConfigBootstrap, pageSourceForHost] = await Promise.all([
    readFile(
      new URL("../app/site-config-bootstrap.tsx", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(siteConfigBootstrap, /seedSiteConfigFromServer/);
  assert.match(siteConfigBootstrap, /refreshSiteConfigFromHost/);
  assert.match(pageSourceForHost, /SiteConfigBootstrap/);
  assert.match(pageSourceForHost, /withHostCardConfigs/);
  assert.match(pageSourceForHost, /loadSiteAdminConfig/);
  assert.match(
    pageSourceForHost,
    /initialProgramConfig=\{siteConfig\.programConfig\}/,
  );

  const themesSource = await readFile(
    new URL("../lib/themes.ts", import.meta.url),
    "utf8",
  );
  assert.match(themesSource, /Theme Default/);
  assert.match(themesSource, /Theme 1: Light/);
  assert.match(themesSource, /Theme 2: Dark/);
  assert.match(themesSource, /Theme 3: Futuristic/);
  assert.match(themesSource, /Theme 4: Feeling Lucky/);
  assert.match(themesSource, /LUCKY_THEME_POOL/);
  assert.match(themesSource, /lucky-brass/);
  assert.match(themesSource, /lucky-ember/);
  assert.match(themesSource, /lucky-slate/);
  assert.match(themesSource, /lucky-forest/);
  assert.match(themesSource, /lucky-sand/);

  const adminAccount = await readFile(
    new URL("../app/admin-account-panel.tsx", import.meta.url),
    "utf8",
  );
  assert.match(adminAccount, /Change password/);
  assert.match(adminAccount, /Reset password/);
  assert.match(adminAccount, /Recovery email/);

  const adminLogin = await readFile(
    new URL("../app/admin-login.tsx", import.meta.url),
    "utf8",
  );
  assert.match(adminLogin, /Reset password/);
  assert.match(adminLogin, /resetAdminPassword/);

  const projectPanel = await readFile(
    new URL("../app/project-panel.tsx", import.meta.url),
    "utf8",
  );
  assert.match(projectPanel, /TaskHoverLabel/);
  assert.match(projectPanel, /ScheduleHoverLabel/);
  assert.match(projectPanel, /responsible-engineer/);
  assert.match(projectPanel, /config\.boardName/);
  assert.match(projectPanel, /config\.boardNickname/);
  assert.match(projectPanel, /ConfigWindow/);
  assert.match(projectPanel, /layout = "fixed"/);
  assert.match(projectPanel, /project-panel--custom/);
  assert.match(projectPanel, /panel-status-block/);
  assert.match(projectPanel, /statusFromOverdueCount/);
  assert.match(projectPanel, /useProgramConfig/);
  assert.match(projectPanel, /useHostProgramConfig/);
  assert.match(projectPanel, /useDashboardConfig\(/);
  assert.match(projectPanel, /overdueThresholdsFromProgramConfig/);
  assert.match(projectPanel, /metricsWithLiveLinkState/);
  assert.match(projectPanel, /METRIC_SOURCE_EMPTY/);
  assert.match(projectPanel, /METRIC_SOURCE_ERROR/);
  assert.match(projectPanel, /programStatusMetricFillClass/);
  assert.match(projectPanel, /metric-fill--program-open/);
  assert.match(projectPanel, /metric-fill--program-overdue/);
  assert.match(projectPanel, /openTasksValue/);
  assert.match(page, /overdueBarPercent/);
  assert.match(page, /openBarPercent/);
  assert.match(projectPanel, /"On Track"/);
  assert.match(projectPanel, /"Delayed"/);
  assert.match(projectPanel, /"At Risk"/);
  assert.match(hover, /jiraIssueUrl\(item\.key\)/);
  assert.match(
    await readFile(new URL("../lib/dsb-tasks.ts", import.meta.url), "utf8"),
    /mach-industries\.atlassian\.net\/browse/,
  );
  assert.doesNotMatch(
    await readFile(new URL("../lib/dsb-tasks.ts", import.meta.url), "utf8"),
    /https:\/\/mach\.atlassian\.net\/browse/,
  );
  assert.match(page, /name: "High Voltage Fireset Board"/);
  assert.match(page, /name: "CPLD - Primary"/);
  assert.match(page, /name: "CPLD - Independent"/);
  assert.doesNotMatch(page, /label: "Open rework"/);
  assert.doesNotMatch(page, /label: "On order"/);

  const configSource = await readFile(
    new URL("../lib/dashboard-config.ts", import.meta.url),
    "utf8",
  );
  assert.match(configSource, /Bruno Abousleiman/);
  assert.match(configSource, /Google Drive Link/);
  assert.match(configSource, /googleDriveLink/);
  assert.match(configSource, /googleSheetEditUrl/);
  assert.doesNotMatch(configSource, /JIRA Epic Link/);
  assert.doesNotMatch(configSource, /jiraEpicLink/);
  assert.doesNotMatch(configSource, /ledGreenLessThan/);
  assert.match(configSource, /DEFAULT_ADMIN_USERNAME = "admin"/);
  assert.match(configSource, /DEFAULT_ADMIN_PASSWORD = "esad"/);

  const sourceLinks = await readFile(
    new URL("../lib/source-links.ts", import.meta.url),
    "utf8",
  );
  assert.match(sourceLinks, /METRIC_SOURCE_EMPTY = "Empty"/);
  assert.match(sourceLinks, /METRIC_SOURCE_ERROR = "Error"/);
  assert.match(sourceLinks, /resolveGoogleDriveSource/);
  assert.match(sourceLinks, /resolveSmartsheetSource/);
  assert.match(sourceLinks, /smartsheetHrefFromConfig/);
  assert.match(sourceLinks, /hrefMatchesSmartsheetConfig/);

  const programConfigSource = await readFile(
    new URL("../lib/program-config.ts", import.meta.url),
    "utf8",
  );
  assert.match(programConfigSource, /ledGreenAtMost/);
  assert.match(programConfigSource, /ledYellowAtLeast/);
  assert.match(programConfigSource, /ledRedAtLeast/);
  assert.match(programConfigSource, /Card LED Threshold Configuration/);
  assert.match(programConfigSource, /Green: "/);
  assert.match(programConfigSource, /Yellow: "/);
  assert.match(programConfigSource, /Red: "/);

  const [programConfigWindow, configWindow, adminLoginsPanel] =
    await Promise.all([
      readFile(
        new URL("../app/program-config-window.tsx", import.meta.url),
        "utf8",
      ),
      readFile(new URL("../app/config-window.tsx", import.meta.url), "utf8"),
      readFile(
        new URL("../app/admin-logins-panel.tsx", import.meta.url),
        "utf8",
      ),
    ]);
  assert.match(programConfigWindow, /Card LED Threshold/);
  assert.match(programConfigWindow, /formatProgramLedThresholdText/);
  assert.match(programConfigWindow, /config-window-editor--led/);
  assert.match(programConfigWindow, /status LED/);
  assert.match(programConfigWindow, /metric labels/);
  assert.match(programConfigWindow, /Open Tasks, Over/);
  assert.match(programConfigWindow, /Saved on the host/);
  assert.match(projectPanel, /metricDisplayLabel/);
  assert.match(programConfigSource, /openTasksLabel/);
  assert.match(programConfigSource, /overDueLabel/);
  assert.match(programConfigSource, /currentTaskLabel/);
  assert.match(programConfigSource, /nextTaskLabel/);
  assert.match(programConfigSource, /Open Tasks: "/);
  assert.match(programConfigSource, /Current Task: "/);
  assert.match(configWindow, /Saved on the host/);
  assert.match(adminLoginsPanel, /running list of unique Google sign-ins/);
  assert.match(adminLoginsPanel, /summary\?\.users/);
  assert.match(page, /function HealthCore\(/);
  assert.match(page, /programStatusFromProjects/);
  assert.match(page, /aggregateProgramTaskStats/);
  assert.match(page, /Completed Tasks/);
  assert.match(page, /Overdue Tasks/);
  assert.match(layout, /loadSiteAdminConfig/);
  assert.match(layout, /programConfig\.dashboardName/);
  assert.match(layout, /programConfig\.programLead/);
  assert.doesNotMatch(layout, /MACH ESAD Development Dashboard/);
  assert.doesNotMatch(layout, /Engineering Program Office/);
  assert.match(layout, /og\.png/);
  assert.match(page, /dashboardName=\{siteConfig\.programConfig\.dashboardName\}/);
  assert.match(packageJson, /"name": "site-creator-vinext-starter"/);
  assert.doesNotMatch(page, /SkeletonPreview|react-loading-skeleton/);
  assert.doesNotMatch(layout, /codex-preview|_sites-preview|themeColor|\bViewport\b/);
});
