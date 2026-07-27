import assert from "node:assert/strict";
import test from "node:test";
import {
  checkEmailAccess,
  getAllowedEmailDomain,
  isAllowedCompanyEmail,
} from "../lib/allowed-email.ts";

test("defaults allowed email domain to machindustries.com", () => {
  assert.equal(getAllowedEmailDomain(), "machindustries.com");
});

test("allows matching company emails and rejects others", () => {
  assert.equal(
    isAllowedCompanyEmail("longnguyen@machindustries.com"),
    true,
  );
  assert.equal(
    isAllowedCompanyEmail("Long.Nguyen@MachIndustries.com"),
    true,
  );
  assert.equal(isAllowedCompanyEmail("user@gmail.com"), false);
  assert.equal(isAllowedCompanyEmail(""), false);
  assert.equal(isAllowedCompanyEmail(null), false);
});

test("checkEmailAccess explains allow and deny results", () => {
  const allowed = checkEmailAccess("ops@machindustries.com");
  assert.equal(allowed.allowed, true);
  assert.equal(allowed.email, "ops@machindustries.com");
  assert.match(allowed.reason, /Allowed/);

  const denied = checkEmailAccess("ops@example.com");
  assert.equal(denied.allowed, false);
  assert.match(denied.reason, /Denied/);

  const blank = checkEmailAccess("   ");
  assert.equal(blank.allowed, false);
  assert.match(blank.reason, /Enter an email/);
});
