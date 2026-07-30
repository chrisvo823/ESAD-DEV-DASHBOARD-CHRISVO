import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("exposes the shared Admin config Google Drive folder", async () => {
  const source = await readFile(
    new URL("../lib/admin-config-drive.ts", import.meta.url),
    "utf8",
  );
  assert.match(source, /1g-pGEPe4f2sFmX0sngp-4Pm75ONGMnks/);
  assert.match(
    source,
    /https:\/\/drive\.google\.com\/drive\/u\/0\/folders\/\$\{ADMIN_CONFIG_DRIVE_FOLDER_ID\}/,
  );
});

test("parses Google Doc and Drive file ids from pasted URLs", async () => {
  const source = await readFile(
    new URL("../app/open-admin-config-drive.ts", import.meta.url),
    "utf8",
  );
  assert.match(source, /export function parseDriveFileIdInput/);
  assert.match(source, /GOOGLE_DOC_ID_RE/);
  assert.match(source, /DRIVE_FILE_ID_RE/);
  assert.match(source, /pickAdminConfigDriveFile/);
  assert.match(source, /export function openAdminConfigDriveFolder/);
  assert.match(source, /ADMIN_CONFIG_DRIVE_FOLDER_URL/);
  assert.match(source, /ADMIN_CONFIG_DRIVE_FOLDER_ID/);
  assert.match(source, /promptForDriveFile/);
  assert.match(source, /folderAlreadyOpen/);
  assert.match(source, /createElement\("a"\)/);
  assert.match(source, /A file must be selected from the Google Drive folder/);
  assert.match(source, /A file selection is required/);
});

test("Load Config and Card Configuration wire to the Drive folder picker", async () => {
  const [programWindow, configWindow, loadFromDrive, packageJson, globalsCss] =
    await Promise.all([
      readFile(
        new URL("../app/program-config-window.tsx", import.meta.url),
        "utf8",
      ),
      readFile(new URL("../app/config-window.tsx", import.meta.url), "utf8"),
      readFile(
        new URL("../app/load-config-from-drive.ts", import.meta.url),
        "utf8",
      ),
      readFile(new URL("../package.json", import.meta.url), "utf8"),
      readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    ]);
  assert.match(programWindow, /openAdminConfigDriveFolder\(\)/);
  assert.match(programWindow, /pickAdminConfigDriveFile\("dashboard"/);
  assert.match(programWindow, /folderAlreadyOpen: true/);
  assert.match(programWindow, /loadProgramConfigFromDriveFile/);
  assert.match(programWindow, /requires selecting a Dashboard Configuration file/);
  assert.match(programWindow, /noteConfigLoadedAndDeployIfReady/);
  assert.match(
    programWindow,
    /<button[\s\S]*className="config-window-load"[\s\S]*Load Config File…/,
  );
  assert.match(configWindow, /openAdminConfigDriveFolder\(\)/);
  assert.match(configWindow, /pickAdminConfigDriveFile\("card"/);
  assert.match(configWindow, /loadCardConfigFromDriveFile/);
  assert.match(configWindow, /noteConfigLoadedAndDeployIfReady/);
  assert.match(configWindow, /\{loading \? "Loading…" : "Load Config"\}/);
  assert.match(configWindow, /requires selecting a Card Configuration file/);
  assert.match(
    configWindow,
    /<button[\s\S]*className="config-window-load"[\s\S]*Load Config/,
  );
  // Card Configuration trigger opens the dialog only — Drive opens on Load Config.
  assert.match(
    configWindow,
    /<button\s+type="button"\s+className="config-window-trigger"\s+onClick=\{\(\) => setOpen\(true\)\}\s*>\s*Configuration\s*<\/button>/,
  );
  assert.doesNotMatch(
    configWindow,
    /<a[\s\S]*className="config-window-trigger"/,
  );
  assert.doesNotMatch(configWindow, /\bSave\b/);
  assert.doesNotMatch(configWindow, /editable card fields/);
  assert.doesNotMatch(configWindow, /\{saving \? "Saving…" : "Save"\}/);
  assert.doesNotMatch(configWindow, /config-window-save(?!d)/);
  assert.doesNotMatch(globalsCss, /\.config-window-save(?!d)/);
  // Sites / Cloudflare Workers stay on vinext; Firebase adapter sets
  // NEXT_PRIVATE_STANDALONE and scripts/build.mjs switches to next build.
  assert.match(packageJson, /"build": "node \.\/scripts\/build\.mjs"/);
  assert.match(packageJson, /"dev": "vinext dev"/);
  assert.match(packageJson, /"build:vinext": "vinext build"/);
  assert.match(packageJson, /"build:next": "next build"/);
  const buildScript = await readFile(
    new URL("../scripts/build.mjs", import.meta.url),
    "utf8",
  );
  assert.match(buildScript, /NEXT_PRIVATE_STANDALONE/);
  assert.match(buildScript, /vinext/);
  assert.match(buildScript, /next/);
  assert.match(loadFromDrive, /drive\/v3\/files\//);
  assert.match(loadFromDrive, /export\?mimeType=text\/plain/);
});
