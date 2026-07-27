import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const tempRoot = await mkdtemp(path.join(os.tmpdir(), "esad-admin-creds-"));
const previousCwd = process.cwd();
process.chdir(tempRoot);

const {
  changeHostAdminPassword,
  resetHostAdminPassword,
  verifyAdminLogin,
} = await import("../lib/site-config-store.ts");

test.after(async () => {
  process.chdir(previousCwd);
  await rm(tempRoot, { recursive: true, force: true });
});

test("change password requires current password and persists new value on host", async () => {
  const failed = await changeHostAdminPassword({
    currentPassword: "wrong",
    nextPassword: "nextpass",
  });
  assert.equal(failed.ok, false);

  const ok = await changeHostAdminPassword({
    currentPassword: "esad",
    nextPassword: "nextpass",
  });
  assert.equal(ok.ok, true);
  assert.equal(await verifyAdminLogin("admin", "nextpass"), true);
  assert.equal(await verifyAdminLogin("admin", "esad"), false);
});

test("reset password requires email and saves recovery email on host", async () => {
  const first = await resetHostAdminPassword({
    email: "ops@mach.example",
    nextPassword: "reset1",
  });
  assert.equal(first.ok, true);
  assert.equal(await verifyAdminLogin("admin", "reset1"), true);

  const mismatch = await resetHostAdminPassword({
    email: "other@mach.example",
    nextPassword: "reset2",
  });
  assert.equal(mismatch.ok, false);

  const match = await resetHostAdminPassword({
    email: "ops@mach.example",
    nextPassword: "reset2",
  });
  assert.equal(match.ok, true);
  assert.equal(await verifyAdminLogin("admin", "reset2"), true);
});
