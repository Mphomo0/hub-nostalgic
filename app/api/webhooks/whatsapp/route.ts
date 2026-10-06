import { db } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";
import { optOutByPhone } from "@/modules/reviews/lib/optout";
import { enqueueWhatsAppFallback } from "@/modules/reviews/lib/queue";
import { isStopMessage, verifyWebhookSignature } from "@/lib/messaging/whatsapp";

/**
 * Meta WhatsApp Cloud API webhook.
 * GET  = one-time verification when you add the webhook in the Meta dashboard.
 * POST = delivery status updates and inbound messages (STOP handling).
 * Subscribe the app to the "messages" field.
 */

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  if (mode === "subscribe" && token && token === process.env.WHATSAPP_VERIFY_TOKEN && challenge) {
    return new Response(challenge, { status: 200 });
  }
  return new Response("Forbidden", { status: 403 });
}

type StatusUpdate = { id: string; status: string; recipient_id?: string; errors?: { code?: number; title?: string; message?: string }[] };
type InboundMessage = { from: string; id: string; type: string; text?: { body?: string }; button?: { text?: string }; context?: { id?: string } };
type WebhookBody = { entry?: { changes?: { value?: { statuses?: StatusUpdate[]; messages?: InboundMessage[] } }[] }[] };

export async function POST(request: Request) {
  const raw = await request.text();
  if (!verifyWebhookSignature(raw, request.headers.get("x-hub-signature-256"))) {
    return new Response("Invalid signature", { status: 401 });
  }

  let body: WebhookBody;
  try {
    body = JSON.parse(raw);
  } catch {
    return new Response("Bad JSON", { status: 400 });
  }

  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value ?? {};
      for (const status of value.statuses ?? []) await handleStatus(status);
      for (const message of value.messages ?? []) await handleInbound(message);
    }
  }
  // Always 200 quickly so Meta doesn't retry what we've already processed.
  return new Response("OK", { status: 200 });
}

async function handleStatus(s: StatusUpdate) {
  // Find which review request (and which message: request or reminder) this is about.
  const sent = await db.messageEvent.findFirst({
    where: { provider: "whatsapp", providerMessageId: s.id, eventType: "sent" },
    select: { reviewRequestId: true, payload: true },
  });
  await db.messageEvent.create({
    data: { reviewRequestId: sent?.reviewRequestId ?? null, provider: "whatsapp", providerMessageId: s.id, eventType: `status_${s.status}`, payload: s as unknown as Prisma.InputJsonValue },
  });

  if (s.status === "failed" && sent?.reviewRequestId) {
    const kind = (sent.payload as { kind?: string } | null)?.kind === "reminder" ? "reminder" : "initial";
    const reason = s.errors?.[0]?.title ?? s.errors?.[0]?.message ?? "delivery failed";
    await enqueueWhatsAppFallback({ requestId: sent.reviewRequestId, kind, reason });
  }
}

async function handleInbound(m: InboundMessage) {
  const text = m.text?.body ?? m.button?.text;
  await db.messageEvent.create({
    data: { provider: "whatsapp", providerMessageId: m.id, eventType: "inbound", payload: { from: m.from, type: m.type, text: text?.slice(0, 500) ?? null, contextId: m.context?.id ?? null } },
  });
  if (isStopMessage(text)) {
    await optOutByPhone(`+${m.from.replace(/^\+/, "")}`, { replyToMessageId: m.context?.id });
  }
}
