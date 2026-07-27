import assert from "node:assert/strict";
import test from "node:test";
import {
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
