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
  // File picker opens first; Drive login is recovery-only (not a hard gate).
  assert.doesNotMatch(pickerSource, /ensureGoogleDriveAccessToken/);
  assert.doesNotMatch(pickerSource, /window\.prompt/);
  assert.doesNotMatch(pickerSource, /promptForDriveFile/);
  assert.doesNotMatch(pickerSource, /Paste the/);
  assert.doesNotMatch(pickerSource, /google\.picker/);
  assert.doesNotMatch(pickerSource, /PickerBuilder/);
  assert.match(modalSource, /drive-file-picker/);
  assert.match(modalSource, /\/api\/admin-config-drive-files/);
  assert.match(modalSource, /Select file/);
  assert.match(modalSource, /admin-config-drive-types/);
  assert.match(modalSource, /Sign in with Google Drive/);
  assert.match(modalSource, /ensureFirebaseWebConfig/);
  assert.match(modalSource, /GOOGLE_SERVICE_ACCOUNT_JSON/);
  const driveLoginModal = await readFile(
    new URL("../app/google-drive-login-modal.tsx", import.meta.url),
    "utf8",
  );
  assert.match(driveLoginModal, /Sign in with Google Drive/);
  assert.match(driveLoginModal, /signInWithGoogleDriveAccess/);
  const ensureDrive = await readFile(
    new URL("../app/ensure-google-drive-access.ts", import.meta.url),
    "utf8",
  );
  assert.match(ensureDrive, /showGoogleDriveLoginPopup/);
  assert.match(ensureDrive, /signInWithGoogleDriveAccess/);
  assert.match(ensureDrive, /ensureFirebaseAuth/);
  const firebaseClient = await readFile(
    new URL("../lib/firebase-client.ts", import.meta.url),
    "utf8",
  );
  assert.match(firebaseClient, /ensureFirebaseWebConfig/);
  assert.match(firebaseClient, /\/api\/firebase-web-config/);
  assert.match(firebaseClient, /__ESAD_FIREBASE_CONFIG__/);
  const firebaseApi = await readFile(
    new URL("../app/api/firebase-web-config/route.ts", import.meta.url),
    "utf8",
  );
  assert.match(firebaseApi, /readFirebaseWebConfigFromEnv/);
  const firebaseWebConfig = await readFile(
    new URL("../lib/firebase-web-config.ts", import.meta.url),
    "utf8",
  );
  assert.match(firebaseWebConfig, /FIREBASE_WEB_CONFIG/);
  assert.match(firebaseWebConfig, /NEXT_PUBLIC_FIREBASE_API_KEY/);
  const viteConfig = await readFile(
    new URL("../vite.config.ts", import.meta.url),
    "utf8",
  );
  assert.match(viteConfig, /NEXT_PUBLIC_FIREBASE_API_KEY/);
  assert.match(viteConfig, /FIREBASE_WEB_CONFIG/);
  const layoutSource = await readFile(
    new URL("../app/layout.tsx", import.meta.url),
    "utf8",
  );
  assert.match(layoutSource, /__ESAD_FIREBASE_CONFIG__/);
  assert.match(layoutSource, /readFirebaseWebConfigFromEnv/);
  assert.match(listSource, /listAdminConfigDriveFiles/);
  assert.match(listSource, /exportAdminConfigDriveFilePlainText/);
  assert.match(listSource, /ADMIN_CONFIG_DRIVE_FOLDER_ID/);
  assert.match(listSource, /drive\/v3\/files/);
  assert.match(listSource, /application\/vnd\.google-apps\.document/);
  assert.match(apiSource, /listAdminConfigDriveFiles/);
  assert.match(apiSource, /isAuthorizedSiteAdmin/);
  const exportApiSource = await readFile(
    new URL("../app/api/admin-config-drive-files/[fileId]/route.ts", import.meta.url),
    "utf8",
  );
  assert.match(exportApiSource, /exportAdminConfigDriveFilePlainText/);
  assert.match(exportApiSource, /isAuthorizedSiteAdmin/);
  const credentialsSource = await readFile(
    new URL("../lib/google-drive-credentials.ts", import.meta.url),
    "utf8",
  );
  assert.match(credentialsSource, /GOOGLE_SERVICE_ACCOUNT_JSON/);
  assert.match(credentialsSource, /googleDriveCredentialsMissingMessage/);
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
  assert.match(programWindow, /User cancelled the file picker/);
  assert.doesNotMatch(
    programWindow,
    /A Dashboard Configuration file is required/,
  );
  assert.match(
    programWindow,
    /<button[\s\S]*className="config-window-load"[\s\S]*Load Config/,
  );
  assert.doesNotMatch(programWindow, /Load Config File…/);
  assert.match(programWindow, /\{saving \? "Saving…" : "Save"\}/);
  assert.match(programWindow, /config-window-save/);
  assert.doesNotMatch(programWindow, /readOnly/);
  assert.doesNotMatch(programWindow, /config-window-editor--readonly/);
  assert.match(configWindow, /pickAdminConfigDriveFile\("card"/);
  assert.match(configWindow, /loadAllCardConfigsFromDriveFile/);
  assert.match(configWindow, /bindAllCardConfigsGoogleDoc/);
  assert.match(configWindow, /\{loading \? "Loading…" : "Load Config"\}/);
  assert.match(configWindow, /file-selection[\s\n]+popup/);
  assert.match(configWindow, /User cancelled the file picker/);
  assert.doesNotMatch(
    configWindow,
    /A Card Configuration file is required/,
  );
  assert.match(
    configWindow,
    /<button[\s\S]*className="config-window-load"[\s\S]*Load Config/,
  );
  assert.match(
    configWindow,
    /<button\s+type="button"\s+className="config-window-trigger"\s+onClick=\{\(\) => setOpen\(true\)\}\s*>\s*Card Configuration\s*<\/button>/,
  );
  assert.doesNotMatch(
    configWindow,
    /<a[\s\S]*className="config-window-trigger"/,
  );
  assert.match(configWindow, /saved for all users/i);
  assert.match(configWindow, /Card #:/);
  assert.match(configWindow, /saveAllCardConfigsToGoogleDoc/);
  assert.match(configWindow, /\{saving \? "Saving…" : "Save"\}/);
  assert.match(configWindow, /config-window-save/);
  assert.doesNotMatch(configWindow, /noteConfigLoadedAndDeployIfReady/);
  assert.doesNotMatch(configWindow, /readOnly/);
  assert.doesNotMatch(configWindow, /config-window-editor--readonly/);
  const heroHeader = await readFile(
    new URL("../app/hero-header.tsx", import.meta.url),
    "utf8",
  );
  assert.match(heroHeader, /ProgramConfigWindow/);
  assert.match(heroHeader, /ConfigWindow/);
  assert.match(
    heroHeader,
    /ProgramConfigWindow[\s\S]*ConfigWindow/,
  );
  const drivePicker = await readFile(
    new URL("../app/drive-file-picker-modal.tsx", import.meta.url),
    "utf8",
  );
  // Single Cancel in the footer — not duplicated in the header.
  assert.equal(
    [...drivePicker.matchAll(/>\s*Cancel\s*</g)].length,
    1,
  );
  assert.match(
    drivePicker,
    /drive-file-picker-footer[\s\S]*?>\s*Cancel\s*</,
  );
  const headerEnd = drivePicker.indexOf('className="drive-file-picker-header"');
  const footerStart = drivePicker.indexOf('className="drive-file-picker-footer"');
  assert.ok(headerEnd >= 0 && footerStart > headerEnd);
  assert.doesNotMatch(
    drivePicker.slice(headerEnd, footerStart),
    />\s*Cancel\s*</,
  );
  assert.match(globalsCss, /\.drive-file-picker\b/);
  assert.match(globalsCss, /\.drive-login-modal\b/);
  assert.match(globalsCss, /\.drive-file-picker-backdrop[\s\S]*z-index:\s*120/);
  assert.match(globalsCss, /\.drive-login-backdrop[\s\S]*z-index:\s*130/);
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
  assert.match(loadFromDrive, /\/api\/admin-config-drive-files\//);
  assert.match(loadFromDrive, /x-esad-admin-password/);
  assert.match(loadFromDrive, /getGoogleAccessToken/);
});
