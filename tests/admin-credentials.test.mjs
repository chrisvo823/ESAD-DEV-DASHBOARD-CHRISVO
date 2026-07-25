import assert from "node:assert/strict";
import test from "node:test";
import {
  changeAdminPassword,
  readAdminCredentials,
  resetAdminPassword,
  writeAdminCredentials,
} from "../app/admin-credentials-store.ts";

const FALLBACK = "esad";

function withLocalStorage(run) {
  const store = new Map();
  const localStorage = {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
  };
  const previousWindow = globalThis.window;
  globalThis.window = {
    localStorage,
    dispatchEvent() {
      return true;
    },
  };
  try {
    run(store);
  } finally {
    if (previousWindow === undefined) {
      delete globalThis.window;
    } else {
      globalThis.window = previousWindow;
    }
  }
}

test("change password requires current password and persists new value", () => {
  withLocalStorage(() => {
    writeAdminCredentials(
      { password: FALLBACK, recoveryEmail: "" },
      FALLBACK,
    );
    const failed = changeAdminPassword({
      fallbackPassword: FALLBACK,
      currentPassword: "wrong",
      nextPassword: "nextpass",
    });
    assert.equal(failed.ok, false);

    const ok = changeAdminPassword({
      fallbackPassword: FALLBACK,
      currentPassword: FALLBACK,
      nextPassword: "nextpass",
    });
    assert.equal(ok.ok, true);
    assert.equal(readAdminCredentials(FALLBACK).password, "nextpass");
  });
});

test("reset password requires email and saves recovery email", () => {
  withLocalStorage(() => {
    const first = resetAdminPassword({
      fallbackPassword: FALLBACK,
      email: "ops@mach.example",
      nextPassword: "reset1",
    });
    assert.equal(first.ok, true);
    assert.equal(readAdminCredentials(FALLBACK).password, "reset1");
    assert.equal(
      readAdminCredentials(FALLBACK).recoveryEmail,
      "ops@mach.example",
    );

    const mismatch = resetAdminPassword({
      fallbackPassword: FALLBACK,
      email: "other@mach.example",
      nextPassword: "reset2",
    });
    assert.equal(mismatch.ok, false);

    const match = resetAdminPassword({
      fallbackPassword: FALLBACK,
      email: "ops@mach.example",
      nextPassword: "reset2",
    });
    assert.equal(match.ok, true);
    assert.equal(readAdminCredentials(FALLBACK).password, "reset2");
  });
});
