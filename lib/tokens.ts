import { createHash, randomBytes } from "node:crypto";

/** 32 random bytes, URL-safe base64 (43 chars). Used for public links. */
export function newToken(bytes = 32) {
  return randomBytes(bytes).toString("base64url");
}

/** SHA-256 hex digest. Invite tokens are stored hashed, never in plain text. */
export function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}
