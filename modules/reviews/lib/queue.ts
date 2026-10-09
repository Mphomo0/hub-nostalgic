import { after } from "next/server";
import { inngest, inngestEnabled } from "@/lib/inngest/client";
import { REVIEW_EVENTS as EVENTS } from "@/modules/reviews/events";
import { deliverInitial } from "@/modules/reviews/lib/deliver";

/** Send in the background of the current request. No retries, so this is the fallback. */
function sendDirectly(requestIds: string[]) {
  after(async () => {
    for (const id of requestIds) {
      try {
        await deliverInitial(id);
      } catch (err) {
        console.error(`[queue:direct] failed to send ${id}`, err);
      }
    }
  });
}

/**
 * Put review requests on the send queue.
 * Without Inngest configured (local dev), or if Inngest refuses the events
 * (down, over its plan limit), requests are sent in the background of the
 * current request instead, without retries.
 */
export async function enqueueSends(requestIds: string[]) {
  if (requestIds.length === 0) return;
  if (!inngestEnabled()) return sendDirectly(requestIds);

  // Inngest accepts batches of events in a single call.
  const unsent: string[] = [];
  for (let i = 0; i < requestIds.length; i += 100) {
    const batch = requestIds.slice(i, i + 100);
    try {
      await inngest.send(batch.map((requestId) => ({ name: EVENTS.send, data: { requestId }, id: `send-${requestId}` })));
    } catch (err) {
      console.error("[queue] Inngest refused the events; sending directly instead", err);
      unsent.push(...batch);
    }
  }
  if (unsent.length > 0) sendDirectly(unsent);
}

export async function enqueueWhatsAppFallback(data: { requestId: string; kind: "initial" | "reminder"; reason: string }) {
  if (inngestEnabled()) {
    try {
      await inngest.send({ name: EVENTS.waFailed, data });
      return;
    } catch (err) {
      console.error("[queue] Inngest refused the WhatsApp fallback event; handling directly instead", err);
    }
  }
  const { handleWhatsAppDeliveryFailure } = await import("@/modules/reviews/lib/deliver");
  after(() => handleWhatsAppDeliveryFailure(data.requestId, data.kind, data.reason).catch((e) => console.error(e)));
}
