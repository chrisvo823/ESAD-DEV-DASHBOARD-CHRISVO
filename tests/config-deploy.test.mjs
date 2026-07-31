import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("deploys combined host config after both Drive loads", async () => {
  const source = await readFile(
    new URL("../app/config-deploy.ts", import.meta.url),
    "utf8",
  );
  assert.match(source, /noteConfigLoadedAndDeployIfReady/);
  assert.match(source, /bothConfigsLoadedThisSession/);
  assert.match(source, /persistSiteConfigPatch/);
  assert.match(source, /refreshSiteConfigFromHost/);
  assert.match(source, /programConfig/);
  assert.match(source, /dashboardConfigs/);
  assert.match(source, /deployed to all users/i);
  assert.match(source, /3 minutes/);
});

test("Load Config windows trigger deploy-when-both-ready for Dashboard only", async () => {
  const [programWindow, configWindow] = await Promise.all([
    readFile(
      new URL("../app/program-config-window.tsx", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../app/config-window.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(programWindow, /noteConfigLoadedAndDeployIfReady/);
  assert.match(programWindow, /dashboard:\s*next/);
  assert.match(programWindow, /deployMessage/);
  assert.doesNotMatch(configWindow, /noteConfigLoadedAndDeployIfReady/);
  assert.match(configWindow, /saveAllCardConfigsToGoogleDoc/);
  assert.match(configWindow, /bindAllCardConfigsGoogleDoc/);
  assert.match(configWindow, /loadAllCardConfigsFromDriveFile/);
  assert.match(configWindow, /\{saving \? "Saving…" : "Save"\}/);
  assert.match(configWindow, /config-window-save/);
  assert.match(configWindow, /saved for all users/i);
  assert.match(configWindow, /Card Configuration/);
});
