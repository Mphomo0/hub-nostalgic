import { createHash, randomBytes } from "node:crypto";

/** 32 random bytes, URL-safe base64 (43 chars). Used for public links. */
export function newToken(bytes = 32) {
  return randomBytes(bytes).toString("base64url");
}

/** SHA-256 hex digest. Invite tokens are stored hashed, never in plain text. */
export function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

/**
 * Public links sometimes arrive with the template placeholder still in front of
 * the token (e.g. "{{1}}abc…") when a WhatsApp template's URL button was saved as
 * a plain base URL. Remove it so those links still work.
 */
export function stripPlaceholder(raw: string) {
  let value = raw;
  try {
    value = decodeURIComponent(raw);
  } catch {
    // Not valid percent-encoding: use as is.
  }
  return value.replace(/^(\{\{\s*\d+\s*\}\})+/, "");
}
