import "server-only";
import { clientIp } from "@/lib/rate-limit";

/**
 * Server-side check of a Cloudflare Turnstile token.
 *
 * Off (always passes) unless TURNSTILE_SECRET_KEY is set, so local dev and
 * tests work without Cloudflare. Login and forgot-password are checked by
 * Better Auth's captcha plugin instead (lib/auth.ts); this is for our own forms.
 */

export const TURNSTILE_SECRET_KEY = process.env.TURNSTILE_SECRET_KEY || "";
/**
 * Cloudflare's dummy secrets (1x…AA pass, 2x…AA fail, 3x…AA "token spent") return
 * no `action`, so the action check is skipped with them. Real keys always check it.
 */
const usingTestSecret = /^[123]x0+AA$/.test(TURNSTILE_SECRET_KEY);
export function expectedTurnstileAction(action: string) {
  return usingTestSecret ? undefined : action;
}

/** Turnstile adds a hidden input with this name to the form it sits in. */
export const TURNSTILE_FIELD = "cf-turnstile-response";

const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export async function verifyTurnstile(token: FormDataEntryValue | string | null | undefined, action?: string): Promise<boolean> {
  const expectedAction = action && expectedTurnstileAction(action);
  if (!TURNSTILE_SECRET_KEY) return true;
  if (typeof token !== "string" || !token || token.length > 2048) return false;

  try {
    const ip = await clientIp();
    const res = await fetch(SITEVERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret: TURNSTILE_SECRET_KEY, response: token, ...(ip !== "unknown" && { remoteip: ip }) }),
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`siteverify returned ${res.status}`);
    const data = (await res.json()) as { success: boolean; action?: string; "error-codes"?: string[] };
    if (!data.success) {
      console.warn("Turnstile verification failed", data["error-codes"]);
      return false;
    }
    if (expectedAction && data.action !== expectedAction) {
      console.warn("Turnstile action mismatch", { expectedAction, action: data.action });
      return false;
    }
    return true;
  } catch (err) {
    // Fail closed: if we can't verify, don't accept the submission.
    console.error("Turnstile verification error", err);
    return false;
  }
}
