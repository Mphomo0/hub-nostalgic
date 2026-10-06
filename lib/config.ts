// Platform-wide constants. Module-specific settings live in modules/<module>/config.ts.

/** Working name of the platform; the final name and domain are still TBD. */
export const PLATFORM_NAME = "Nostalgic Hub";
export const COMPANY_NAME = "Nostalgic Studio";

/** Invite links expire after this many days. */
export const INVITE_TTL_DAYS = 7;
/** Logo limits (section 9). */
export const LOGO_MAX_UPLOAD_BYTES = 500 * 1024;
export const LOGO_MAX_WIDTH = 400;
/**
 * POPIA retention: customer records with no review request in this many months
 * are deleted by a monthly job (opted-out contacts are kept as do-not-contact only).
 */
export const RETENTION_MONTHS = 24;
/** Business timezone used for "this month" usage counting. */
export const TIMEZONE = "Africa/Johannesburg";

/**
 * Consent statement shown next to the tick box on every send / CSV upload.
 * Bump CONSENT_VERSION whenever the wording changes; it is stored on each ConsentLog.
 */
export const CONSENT_VERSION = "2026-10-v1";
export const CONSENT_STATEMENT =
  "I confirm these customers did business with us recently and agreed to be contacted about their experience. " +
  "I understand each message includes an opt-out, and opted-out customers will not be contacted again.";

export function appUrl(path = "") {
  const base = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return `${base}${path}`;
}
