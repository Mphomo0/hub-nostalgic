import { createHmac, timingSafeEqual } from "node:crypto";
import { DeliveryError } from "@/lib/messaging/errors";

/**
 * Meta WhatsApp Cloud API, called directly (no BSP). One shared number.
 * Docs: https://developers.facebook.com/docs/whatsapp/cloud-api
 *
 * Expected templates (create in WhatsApp Manager, both need approval):
 *   review_request / review_reminder
 *     Body: uses {{1}} = customer first name, {{2}} = business name,
 *           and ends with a line like "Reply STOP to opt out."
 *     Button: "Visit website" URL button with a dynamic suffix:
 *           https://<APP_URL>/r/{{1}}   ← we pass the request token as {{1}}
 */

const API_VERSION = process.env.WHATSAPP_API_VERSION ?? "v24.0";

export function whatsappConfigured() {
  return Boolean(process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.WHATSAPP_ACCESS_TOKEN);
}

// Meta error codes that are worth retrying (throttling / temporary issues).
const TRANSIENT_CODES = new Set([4, 80007, 130429, 131016, 131048, 131056, 133004]);

export async function sendWhatsAppTemplate(opts: {
  toE164: string;
  template: string;
  bodyParams: string[];
  /** Dynamic suffix for the template's URL button (the request token). */
  urlButtonParam?: string;
}): Promise<{ id: string }> {
  if (!whatsappConfigured()) throw new DeliveryError("WhatsApp is not configured", true);

  const components: unknown[] = [
    { type: "body", parameters: opts.bodyParams.map((text) => ({ type: "text", text })) },
  ];
  if (opts.urlButtonParam) {
    components.push({ type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: opts.urlButtonParam }] });
  }

  let res: Response;
  try {
    res = await fetch(`https://graph.facebook.com/${API_VERSION}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: opts.toE164.replace(/^\+/, ""),
        type: "template",
        template: { name: opts.template, language: { code: process.env.WHATSAPP_TEMPLATE_LANG ?? "en" }, components },
      }),
    });
  } catch (err) {
    throw new DeliveryError(`WhatsApp network error: ${(err as Error).message}`, false);
  }

  const json = (await res.json().catch(() => ({}))) as {
    messages?: { id: string }[];
    error?: { code?: number; message?: string };
  };
  if (!res.ok || !json.messages?.[0]?.id) {
    const code = json.error?.code;
    const transient = res.status >= 500 || res.status === 429 || (code !== undefined && TRANSIENT_CODES.has(code));
    throw new DeliveryError(`WhatsApp ${res.status}: ${json.error?.message ?? "unknown error"} (code ${code ?? "?"})`, !transient, json.error);
  }
  return { id: json.messages[0].id };
}

/** Verify Meta's X-Hub-Signature-256 header against the raw request body. */
export function verifyWebhookSignature(rawBody: string, signatureHeader: string | null, appSecret = process.env.WHATSAPP_APP_SECRET) {
  if (!appSecret || !signatureHeader?.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex");
  const given = signatureHeader.slice("sha256=".length);
  if (given.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(given, "hex"), Buffer.from(expected, "hex"));
}

/** True if an inbound message is an opt-out request ("STOP", any case, trimmed). */
export function isStopMessage(text: string | undefined | null) {
  return (text ?? "").trim().toUpperCase() === "STOP";
}
