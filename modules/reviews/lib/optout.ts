import { db } from "@/lib/db";

/**
 * Opt-outs (build plan 6.5). Permanent for that client: nothing in the app ever
 * clears optedOutAt, and intake checks it before every send.
 */

/** Email unsubscribe link: opt out the customer behind a request token. */
export async function optOutByToken(token: string, now = new Date()) {
  if (!token || token.length < 20) return null;
  const req = await db.reviewRequest.findUnique({ where: { token }, select: { customerId: true, client: { select: { name: true } } } });
  if (!req) return null;
  // Only set the timestamp the first time.
  await db.customer.updateMany({ where: { id: req.customerId, optedOutAt: null }, data: { optedOutAt: now } });
  return { clientName: req.client.name };
}

/**
 * WhatsApp STOP: all clients share one number, so we work out the relevant client:
 *   1. If the STOP was a reply to a specific message, use that message's client.
 *   2. Otherwise, the client whose message they most recently received. If we can't tell
 * (no recent message), we opt them out of every client that has contacted
 * that number, which is the safe choice for the shared number.
 */
export async function optOutByPhone(phoneE164: string, opts: { replyToMessageId?: string | null; now?: Date } = {}) {
  const now = opts.now ?? new Date();
  if (opts.replyToMessageId) {
    const event = await db.messageEvent.findFirst({
      where: { providerMessageId: opts.replyToMessageId, reviewRequest: { customer: { phoneE164 } } },
      select: { reviewRequest: { select: { customerId: true } } },
    });
    if (event?.reviewRequest) {
      const r = await db.customer.updateMany({ where: { id: event.reviewRequest.customerId, optedOutAt: null }, data: { optedOutAt: now } });
      return { scope: "replied-client" as const, updated: r.count };
    }
  }
  const latest = await db.reviewRequest.findFirst({
    where: { channel: "WHATSAPP", customer: { phoneE164 }, sentAt: { not: null } },
    orderBy: { sentAt: "desc" },
    select: { customerId: true },
  });
  if (latest) {
    const r = await db.customer.updateMany({ where: { id: latest.customerId, optedOutAt: null }, data: { optedOutAt: now } });
    return { scope: "latest-client" as const, updated: r.count };
  }
  const r = await db.customer.updateMany({ where: { phoneE164, optedOutAt: null }, data: { optedOutAt: now } });
  return { scope: "all-clients" as const, updated: r.count };
}
