import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { connectSmartsheet } from "../lib/smartsheet.ts";

async function loadEnvToken() {
  if (process.env.SMARTSHEET_ACCESS_TOKEN?.trim()) {
    return process.env.SMARTSHEET_ACCESS_TOKEN.trim();
  }

  try {
    const envText = await readFile(new URL("../.env", import.meta.url), "utf8");
    const match = envText.match(/^\s*SMARTSHEET_ACCESS_TOKEN\s*=\s*(.+)\s*$/m);
    return match?.[1]?.trim() || null;
  } catch {
    return null;
  }
}

test("connects to Smartsheet with configured access token", async () => {
  const token = await loadEnvToken();
  if (!token) {
    console.log("skip: SMARTSHEET_ACCESS_TOKEN not configured");
    return;
  }

  const connection = await connectSmartsheet(token);
  assert.equal(connection.user.email, "longnguyen@machindustries.com");
  assert.ok(connection.sheetCount > 0);
  assert.equal(connection.sheets.length, connection.sheetCount);
});
