// Reviews module background jobs (Inngest). Registered in lib/inngest/functions.ts.
import { NonRetriableError } from "inngest";
import { TIMEZONE } from "@/lib/config";
import { REMINDER_DELAY_DAYS } from "@/modules/reviews/config";
import { DeliveryError } from "@/lib/messaging/errors";
import { inngest } from "@/lib/inngest/client";
import { REVIEW_EVENTS as EVENTS } from "@/modules/reviews/events";
import { appUrl } from "@/lib/config";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/messaging/email";
import { collectFailures, summariseFailures } from "@/modules/reviews/lib/alerts";
import { deliverInitial, deliverReminder, findReminderCandidates, handleWhatsAppDeliveryFailure, type DeliveryKind } from "@/modules/reviews/lib/deliver";

/** Permanent delivery errors shouldn't be retried; transient ones should. */
function rethrow(err: unknown): never {
  if (err instanceof DeliveryError && err.permanent) throw new NonRetriableError(err.message);
  throw err;
}

/** Sends one queued review request. Retries transient failures with backoff. */
export const sendReviewRequest = inngest.createFunction(
  {
    id: "send-review-request",
    triggers: [{ event: EVENTS.send }],
    retries: 4,
    // Keep well inside WhatsApp / Resend rate limits.
    throttle: { limit: 20, period: "1s" },
    onFailure: async ({ event }) => {
      const requestId = (event.data.event.data as { requestId?: string }).requestId;
      if (requestId) {
        await db.reviewRequest.updateMany({ where: { id: requestId, status: "QUEUED" }, data: { status: "FAILED", failureReason: "Could not be sent after several attempts" } });
      }
    },
  },
  async ({ event, step }) => {
    const { requestId } = event.data as { requestId: string };
    return step.run("deliver", () => deliverInitial(requestId).catch(rethrow));
  },
);

/** Daily at 09:00 SA time: one reminder to everyone who hasn't rated after 3 days. */
export const dailyReminders = inngest.createFunction(
  { id: "daily-reminders", triggers: [{ cron: `TZ=${TIMEZONE} 0 9 * * *` }], retries: 2 },
  async ({ step }) => {
    const candidates = await step.run("find-candidates", () => findReminderCandidates(new Date(), REMINDER_DELAY_DAYS));
    let sent = 0;
    let skipped = 0;
    let failed = 0;
    for (const { id } of candidates) {
      // Each reminder is its own step, so a failure only retries that one.
      const outcome = await step.run(`reminder-${id}`, () => deliverReminder(id, REMINDER_DELAY_DAYS).catch(rethrow));
      if (outcome.result === "sent") sent++;
      else if (outcome.result === "failed") failed++;
      else skipped++;
    }
    return { candidates: candidates.length, sent, skipped, failed };
  },
);

/** WhatsApp said an accepted message failed: fall back to email once. */
export const whatsappFailedFallback = inngest.createFunction(
  { id: "whatsapp-failed-fallback", triggers: [{ event: EVENTS.waFailed }], retries: 3 },
  async ({ event, step }) => {
    const { requestId, kind, reason } = event.data as { requestId: string; kind: DeliveryKind; reason: string };
    return step.run("fallback", () => handleWhatsAppDeliveryFailure(requestId, kind, reason).catch(rethrow));
  },
);

/**
 * Hourly: email the platform admin if any sends failed in the last hour or are
 * stuck in the queue. Sends nothing when all is well.
 */
export const failedSendsAlert = inngest.createFunction(
  { id: "failed-sends-alert", triggers: [{ cron: `TZ=${TIMEZONE} 0 * * * *` }], retries: 2 },
  async ({ step }) => {
    const to = process.env.ADMIN_EMAIL?.trim();
    if (!to) return { alerted: false, reason: "ADMIN_EMAIL is not set" };

    const digest = await step.run("collect", async () => summariseFailures(await collectFailures(new Date()), appUrl("/admin")));
    if (!digest) return { alerted: false, reason: "nothing to report" };

    const hour = new Date().toISOString().slice(0, 13);
    await step.run("email", () => sendEmail({ to, subject: digest.subject, html: digest.html, text: digest.text, idempotencyKey: `failed-sends-${hour}` }));
    return { alerted: true, total: digest.total };
  },
);

export const reviewJobs = [sendReviewRequest, dailyReminders, whatsappFailedFallback, failedSendsAlert];
