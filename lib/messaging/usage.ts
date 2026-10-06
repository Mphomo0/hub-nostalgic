import { monthKey } from "@/lib/dates";
import { db } from "@/lib/db";
import type { Channel, Prisma } from "@/lib/generated/prisma/client";

type Client = Prisma.TransactionClient | typeof db;

/** Messages counted against the monthly cap: sent this month + still queued. */
export async function usedThisMonth(clientId: string, now = new Date(), client: Client = db) {
  const [counter, queued] = await Promise.all([
    client.usageCounter.findUnique({ where: { clientId_month: { clientId, month: monthKey(now) } } }),
    client.reviewRequest.count({ where: { clientId, status: "QUEUED" } }),
  ]);
  return (counter?.whatsappCount ?? 0) + (counter?.emailCount ?? 0) + queued;
}

/** Sent messages only (no queued), used before sending a reminder. */
export async function sentThisMonth(clientId: string, now = new Date()) {
  const counter = await db.usageCounter.findUnique({ where: { clientId_month: { clientId, month: monthKey(now) } } });
  return (counter?.whatsappCount ?? 0) + (counter?.emailCount ?? 0);
}

/** Add one message to this month's counter (creates the row if needed). */
export async function recordUsage(clientId: string, channel: Channel, now = new Date(), client: Client = db) {
  const field = channel === "WHATSAPP" ? "whatsappCount" : "emailCount";
  await client.usageCounter.upsert({
    where: { clientId_month: { clientId, month: monthKey(now) } },
    create: { clientId, month: monthKey(now), [field]: 1 },
    update: { [field]: { increment: 1 } },
  });
}
