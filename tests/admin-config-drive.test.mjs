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

test("uses a file-selection popup instead of paste-URL prompt", async () => {
  const [pickerSource, modalSource, listSource, apiSource] = await Promise.all([
    readFile(new URL("../app/open-admin-config-drive.ts", import.meta.url), "utf8"),
    readFile(
      new URL("../app/drive-file-picker-modal.tsx", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../lib/admin-config-drive-files.ts", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../app/api/admin-config-drive-files/route.ts", import.meta.url),
      "utf8",
    ),
  ]);
  assert.match(pickerSource, /export function parseDriveFileIdInput/);
  assert.match(pickerSource, /pickAdminConfigDriveFile/);
  assert.match(pickerSource, /export function openAdminConfigDriveFolder/);
  assert.match(pickerSource, /showDriveFilePickerPopup/);
  assert.match(pickerSource, /DriveFilePickerModal/);
  // In-app modal is the sole selection UI (no paste prompt / Google Picker gate).
  assert.doesNotMatch(pickerSource, /window\.prompt/);
  assert.doesNotMatch(pickerSource, /promptForDriveFile/);
  assert.doesNotMatch(pickerSource, /Paste the/);
  assert.doesNotMatch(pickerSource, /google\.picker/);
  assert.doesNotMatch(pickerSource, /PickerBuilder/);
  assert.match(modalSource, /drive-file-picker/);
  assert.match(modalSource, /\/api\/admin-config-drive-files/);
  assert.match(modalSource, /Select file/);
  assert.match(modalSource, /admin-config-drive-types/);
  assert.match(listSource, /listAdminConfigDriveFiles/);
  assert.match(listSource, /ADMIN_CONFIG_DRIVE_FOLDER_ID/);
  assert.match(listSource, /drive\/v3\/files/);
  assert.match(listSource, /application\/vnd\.google-apps\.document/);
  assert.match(apiSource, /listAdminConfigDriveFiles/);
  assert.match(apiSource, /isAuthorizedSiteAdmin/);
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
  assert.match(programWindow, /pickAdminConfigDriveFile\("dashboard"/);
  assert.match(programWindow, /loadProgramConfigFromDriveFile/);
  assert.match(programWindow, /file-selection[\s\n]+popup/);
  assert.match(programWindow, /noteConfigLoadedAndDeployIfReady/);
  assert.match(
    programWindow,
    /<button[\s\S]*className="config-window-load"[\s\S]*Load Config File…/,
  );
  assert.match(configWindow, /pickAdminConfigDriveFile\("card"/);
  assert.match(configWindow, /loadCardConfigFromDriveFile/);
  assert.match(configWindow, /noteConfigLoadedAndDeployIfReady/);
  assert.match(configWindow, /\{loading \? "Loading…" : "Load Config"\}/);
  assert.match(configWindow, /file-selection[\s\n]+popup/);
  assert.match(
    configWindow,
    /<button[\s\S]*className="config-window-load"[\s\S]*Load Config/,
  );
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
  assert.match(globalsCss, /\.drive-file-picker\b/);
  assert.match(globalsCss, /\.drive-file-picker-backdrop[\s\S]*z-index:\s*120/);
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
