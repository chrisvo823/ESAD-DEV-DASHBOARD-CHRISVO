/** Company email domain allowlist for Google Sign-In (no leading @). */
export function getAllowedEmailDomain(): string {
  return (
    process.env.NEXT_PUBLIC_ALLOWED_EMAIL_DOMAIN?.trim().toLowerCase() ||
    "machindustries.com"
  );
}

export function isAllowedCompanyEmail(
  email: string | null | undefined,
  domain = getAllowedEmailDomain(),
): boolean {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  const allowed = domain.replace(/^@/, "").toLowerCase();
  return normalized.endsWith(`@${allowed}`);
}

export type EmailAccessCheck = {
  email: string;
  domain: string;
  allowed: boolean;
  reason: string;
};

/** Explain whether an email is allowed onto the dashboard. */
export function checkEmailAccess(
  email: string | null | undefined,
  domain = getAllowedEmailDomain(),
): EmailAccessCheck {
  const allowedDomain = domain.replace(/^@/, "").toLowerCase();
  const trimmed = email?.trim() ?? "";

  if (!trimmed) {
    return {
      email: "",
      domain: allowedDomain,
      allowed: false,
      reason: "Enter an email address to check access.",
    };
  }

  if (!trimmed.includes("@")) {
    return {
      email: trimmed,
      domain: allowedDomain,
      allowed: false,
      reason: "Email must include an @ domain.",
    };
  }

  const allowed = isAllowedCompanyEmail(trimmed, allowedDomain);
  return {
    email: trimmed.toLowerCase(),
    domain: allowedDomain,
    allowed,
    reason: allowed
      ? `Allowed — matches @${allowedDomain}.`
      : `Denied — only @${allowedDomain} Google accounts can open the dashboard.`,
  };
}
