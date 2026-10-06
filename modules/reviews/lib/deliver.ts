import { appUrl } from "@/lib/config";
import { reviewsModule } from "@/modules/reviews/module";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/messaging/email";
import { logoUrlFor } from "@/lib/messaging/email-layout";
import { reviewRequestEmail } from "@/modules/reviews/emails";
import { DeliveryError } from "@/lib/messaging/errors";
import type { Channel } from "@/lib/generated/prisma/client";
import { recordUsage, sentThisMonth } from "@/lib/messaging/usage";
import { sendWhatsAppTemplate, whatsappConfigured } from "@/lib/messaging/whatsapp";

/**
 * Sends review requests and reminders. Called from background jobs
 * (lib/inngest/functions.ts). Throws a non-permanent DeliveryError when the
 * job should be retried; everything else is handled and recorded here.
 */

export type DeliveryKind = "initial" | "reminder";
export type DeliveryOutcome = { result: "sent" | "skipped" | "failed"; channel?: Channel; reason?: string };


const REVIEWS = reviewsModule.key;

async function loadRequest(requestId: string) {
  return db.reviewRequest.findUnique({
    where: { id: requestId },
    include: {
      customer: true,
      client: {
        select: {
          id: true, name: true, status: true, brandColor: true, monthlyCap: true,
          logo: { select: { updatedAt: true } },
          reviewSettings: { select: { remindersEnabled: true } },
          modules: { where: { module: REVIEWS }, select: { id: true } },
        },
      },
    },
  });
}
type LoadedRequest = NonNullable<Awaited<ReturnType<typeof loadRequest>>>;

/** Send one message on one channel. Returns the provider's message id. */
async function sendOn(channel: Channel, req: LoadedRequest, kind: DeliveryKind) {
  const ratingUrl = appUrl(`/r/${req.token}`);
  if (channel === "WHATSAPP") {
    if (!req.customer.phoneE164) throw new DeliveryError("Customer has no phone number", true);
    const firstName = req.customer.name.split(" ")[0] || req.customer.name;
    const template = kind === "reminder" ? process.env.WHATSAPP_TEMPLATE_REMINDER ?? "review_reminder" : process.env.WHATSAPP_TEMPLATE_REQUEST ?? "review_request";
    const { id } = await sendWhatsAppTemplate({ toE164: req.customer.phoneE164, template, bodyParams: [firstName, req.client.name], urlButtonParam: req.token });
    return { provider: "whatsapp", id };
  }
  if (!req.customer.email) throw new DeliveryError("Customer has no email address", true);
  const unsubscribeUrl = appUrl(`/unsubscribe/${req.token}`);
  const mail = reviewRequestEmail({
    brand: { name: req.client.name, brandColor: req.client.brandColor, logoUrl: logoUrlFor(req.client.id, req.client.logo?.updatedAt) },
    customerName: req.customer.name,
    ratingUrl,
    unsubscribeUrl,
    isReminder: kind === "reminder",
  });
  const { id } = await sendEmail({
    to: req.customer.email,
    ...mail,
    idempotencyKey: `${req.id}:${kind}`,
    // One-click unsubscribe support in Gmail / Outlook.
    headers: { "List-Unsubscribe": `<${appUrl(`/api/unsubscribe/${req.token}`)}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
  });
  return { provider: "resend", id };
}

async function logEvent(reviewRequestId: string, provider: string, eventType: string, providerMessageId: string | null, payload: object) {
  await db.messageEvent.create({ data: { reviewRequestId, provider, eventType, providerMessageId, payload } });
}

/**
 * Try the preferred channel; if WhatsApp fails permanently (or isn't set up yet)
 * and the customer has an email, fall back to email once.
 */
async function sendWithFallback(req: LoadedRequest, kind: DeliveryKind): Promise<{ channel: Channel; provider: string; id: string }> {
  let channel = req.channel;
  if (channel === "WHATSAPP" && !whatsappConfigured()) {
    if (!req.customer.email) throw new DeliveryError("WhatsApp isn't available yet and the customer has no email", true);
    channel = "EMAIL";
  }
  try {
    return { channel, ...(await sendOn(channel, req, kind)) };
  } catch (err) {
    const permanent = err instanceof DeliveryError && err.permanent;
    if (channel === "WHATSAPP" && permanent && req.customer.email) {
      await logEvent(req.id, "whatsapp", "send_failed_fallback_email", null, { kind, error: (err as Error).message });
      return { channel: "EMAIL", ...(await sendOn("EMAIL", req, kind)) };
    }
    throw err;
  }
}

async function markFailed(requestId: string, reason: string) {
  await db.reviewRequest.updateMany({ where: { id: requestId, status: "QUEUED" }, data: { status: "FAILED", failureReason: reason.slice(0, 500) } });
}

/** Send the first review request for a QUEUED request. */
export async function deliverInitial(requestId: string, now = new Date()): Promise<DeliveryOutcome> {
  const req = await loadRequest(requestId);
  if (!req || req.status !== "QUEUED") return { result: "skipped", reason: "not queued" };

  if (req.client.status !== "ACTIVE") {
    await markFailed(req.id, "Account was paused before this could be sent");
    return { result: "failed", reason: "client paused" };
  }
  if (req.client.modules.length === 0) {
    await markFailed(req.id, "Reviews was switched off before this could be sent");
    return { result: "failed", reason: "module off" };
  }
  if (req.customer.optedOutAt) {
    await markFailed(req.id, "Customer opted out");
    return { result: "failed", reason: "opted out" };
  }

  try {
    const sent = await sendWithFallback(req, "initial");
    await db.$transaction(async (tx) => {
      await tx.reviewRequest.update({ where: { id: req.id }, data: { status: "SENT", sentAt: now, channel: sent.channel, failureReason: null } });
      await recordUsage(req.clientId, sent.channel, now, tx);
      await tx.messageEvent.create({ data: { reviewRequestId: req.id, provider: sent.provider, eventType: "sent", providerMessageId: sent.id, payload: { kind: "initial", channel: sent.channel } } });
    });
    return { result: "sent", channel: sent.channel };
  } catch (err) {
    if (err instanceof DeliveryError && err.permanent) {
      await markFailed(req.id, err.message);
      await logEvent(req.id, req.channel === "WHATSAPP" ? "whatsapp" : "resend", "send_failed", null, { kind: "initial", error: err.message });
      return { result: "failed", reason: err.message };
    }
    throw err; // transient → let the job retry
  }
}

/** Requests that should get their one reminder now (build plan 6.4). */
export async function findReminderCandidates(now = new Date(), delayDays: number) {
  const cutoff = new Date(now.getTime() - delayDays * 24 * 60 * 60 * 1000);
  return db.reviewRequest.findMany({
    where: {
      status: { in: ["SENT", "OPENED"] },
      rating: null,
      sentAt: { lte: cutoff },
      reminderSentAt: null,
      client: { status: "ACTIVE", reviewSettings: { remindersEnabled: true }, modules: { some: { module: REVIEWS } } },
      customer: { optedOutAt: null },
    },
    select: { id: true },
    take: 2000,
  });
}

/** Send the single reminder for a request, if it's still eligible. */
export async function deliverReminder(requestId: string, delayDays: number, now = new Date()): Promise<DeliveryOutcome> {
  const req = await loadRequest(requestId);
  if (!req) return { result: "skipped", reason: "not found" };
  const cutoff = new Date(now.getTime() - delayDays * 24 * 60 * 60 * 1000);
  const eligible =
    (req.status === "SENT" || req.status === "OPENED") &&
    req.rating === null &&
    req.sentAt !== null &&
    req.sentAt <= cutoff &&
    req.reminderSentAt === null &&
    req.client.status === "ACTIVE" &&
    req.client.modules.length > 0 &&
    req.client.reviewSettings?.remindersEnabled === true &&
    !req.customer.optedOutAt;
  if (!eligible) return { result: "skipped", reason: "no longer eligible" };

  // Reminders count toward usage, so respect the monthly cap.
  if (req.client.monthlyCap !== null && (await sentThisMonth(req.clientId, now)) >= req.client.monthlyCap) {
    return { result: "skipped", reason: "monthly cap reached" };
  }

  // Claim the reminder so it can never be sent twice, even if jobs overlap.
  const claim = await db.reviewRequest.updateMany({ where: { id: req.id, reminderSentAt: null }, data: { reminderSentAt: now } });
  if (claim.count !== 1) return { result: "skipped", reason: "already claimed" };

  try {
    const sent = await sendWithFallback(req, "reminder");
    await recordUsage(req.clientId, sent.channel, now);
    await logEvent(req.id, sent.provider, "sent", sent.id, { kind: "reminder", channel: sent.channel });
    return { result: "sent", channel: sent.channel };
  } catch (err) {
    if (err instanceof DeliveryError && err.permanent) {
      // Keep reminderSentAt set: we only ever try one reminder.
      await logEvent(req.id, req.channel === "WHATSAPP" ? "whatsapp" : "resend", "reminder_failed", null, { error: err.message });
      return { result: "failed", reason: err.message };
    }
    // Transient: release the claim so the retry can send it.
    await db.reviewRequest.update({ where: { id: req.id }, data: { reminderSentAt: null } });
    throw err;
  }
}

/**
 * Called when WhatsApp reports (via webhook) that an accepted message later
 * failed. Falls back to email once if possible, otherwise marks the request failed.
 */
export async function handleWhatsAppDeliveryFailure(requestId: string, kind: DeliveryKind, reason: string, now = new Date()) {
  const req = await loadRequest(requestId);
  if (!req || req.channel !== "WHATSAPP") return { result: "skipped" as const };

  const canFallback = req.customer.email && !req.customer.optedOutAt && req.client.status === "ACTIVE" && req.client.modules.length > 0;
  if (!canFallback) {
    if (kind === "initial") {
      await db.reviewRequest.update({ where: { id: req.id }, data: { status: req.status === "SENT" ? "FAILED" : req.status, failureReason: `WhatsApp: ${reason}`.slice(0, 500) } });
    }
    return { result: "failed" as const };
  }
  const sent = await sendOn("EMAIL", req, kind);
  await db.$transaction(async (tx) => {
    await tx.reviewRequest.update({ where: { id: req.id }, data: { channel: "EMAIL" } });
    await recordUsage(req.clientId, "EMAIL", now, tx);
    await tx.messageEvent.create({ data: { reviewRequestId: req.id, provider: sent.provider, eventType: "sent", providerMessageId: sent.id, payload: { kind, channel: "EMAIL", fallbackFrom: "WHATSAPP" } } });
  });
  return { result: "sent" as const };
}
