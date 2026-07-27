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
