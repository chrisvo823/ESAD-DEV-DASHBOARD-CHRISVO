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
  assert.match(source, /\/document\/d\//);
  assert.match(source, /\/file\/d\//);
  assert.match(source, /pickAdminConfigDriveFile/);
  assert.match(source, /openDriveFolderTab/);
  assert.match(source, /ADMIN_CONFIG_DRIVE_FOLDER_ID/);
});

test("Load Config and Card Configuration wire to the Drive folder picker", async () => {
  const [programWindow, configWindow, loadFromDrive] = await Promise.all([
    readFile(
      new URL("../app/program-config-window.tsx", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../app/config-window.tsx", import.meta.url), "utf8"),
    readFile(
      new URL("../app/load-config-from-drive.ts", import.meta.url),
      "utf8",
    ),
  ]);
  assert.match(programWindow, /pickAdminConfigDriveFile\("dashboard"\)/);
  assert.match(programWindow, /loadProgramConfigFromDriveFile/);
  assert.match(configWindow, /pickAdminConfigDriveFile\("card"\)/);
  assert.match(configWindow, /loadCardConfigFromDriveFile/);
  assert.match(configWindow, /void handleLoadConfigFile\(config\)/);
  assert.match(loadFromDrive, /drive\/v3\/files\//);
  assert.match(loadFromDrive, /export\?mimeType=text\/plain/);
});
