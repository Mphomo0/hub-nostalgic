import { after } from "next/server";
import { inngest, inngestEnabled } from "@/lib/inngest/client";
import { REVIEW_EVENTS as EVENTS } from "@/modules/reviews/events";
import { deliverInitial } from "@/modules/reviews/lib/deliver";

/**
 * Put review requests on the send queue.
 * Without Inngest configured (local dev), requests are sent in the background
 * of the current request instead, without retries.
 */
export async function enqueueSends(requestIds: string[]) {
  if (requestIds.length === 0) return;
  if (inngestEnabled()) {
    // Inngest accepts batches of events in a single call.
    for (let i = 0; i < requestIds.length; i += 100) {
      await inngest.send(requestIds.slice(i, i + 100).map((requestId) => ({ name: EVENTS.send, data: { requestId }, id: `send-${requestId}` })));
    }
    return;
  }
  after(async () => {
    for (const id of requestIds) {
      try {
        await deliverInitial(id);
      } catch (err) {
        console.error(`[queue:dev] failed to send ${id}`, err);
      }
    }
  });
}

export async function enqueueWhatsAppFallback(data: { requestId: string; kind: "initial" | "reminder"; reason: string }) {
  if (inngestEnabled()) {
    await inngest.send({ name: EVENTS.waFailed, data });
    return;
  }
  const { handleWhatsAppDeliveryFailure } = await import("@/modules/reviews/lib/deliver");
  after(() => handleWhatsAppDeliveryFailure(data.requestId, data.kind, data.reason).catch((e) => console.error(e)));
}
