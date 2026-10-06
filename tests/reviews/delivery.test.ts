import { beforeEach, describe, expect, it, vi } from "vitest";
import { DeliveryError } from "@/lib/messaging/errors";

const sendEmail = vi.fn();
const sendWhatsAppTemplate = vi.fn();
let waConfigured = true;
vi.mock("@/lib/messaging/email", () => ({ sendEmail: (...a: unknown[]) => sendEmail(...a) }));
vi.mock("@/lib/messaging/whatsapp", () => ({
  sendWhatsAppTemplate: (...a: unknown[]) => sendWhatsAppTemplate(...a),
  whatsappConfigured: () => waConfigured,
}));

const { db } = await import("@/lib/db");
const { deliverInitial, deliverReminder, findReminderCandidates, handleWhatsAppDeliveryFailure } = await import("@/modules/reviews/lib/deliver");
const { processIntake } = await import("@/modules/reviews/lib/intake");
const { monthKey } = await import("@/lib/dates");
const { makeClient, resetDb } = await import("../helpers");

async function queue(clientId: string, userId: string, row: { name: string; phone?: string; email?: string }) {
  const r = await processIntake({ clientId, userId, consent: true, ip: null, batchLabel: "t", rows: [row] });
  return r.queued[0].requestId;
}

beforeEach(async () => {
  await resetDb();
  sendEmail.mockReset().mockResolvedValue({ id: "email-1" });
  sendWhatsAppTemplate.mockReset().mockResolvedValue({ id: "wamid.1" });
  waConfigured = true;
});

describe("deliverInitial", () => {
  it("sends email with logo-less branding and an unsubscribe link, and counts usage", async () => {
    const { client, user } = await makeClient();
    const id = await queue(client.id, user.id, { name: "Ann", email: "ann@example.com" });
    const out = await deliverInitial(id);
    expect(out).toEqual({ result: "sent", channel: "EMAIL" });
    const mail = sendEmail.mock.calls[0][0];
    expect(mail.to).toBe("ann@example.com");
    expect(mail.text).toContain("/unsubscribe/");
    expect(mail.headers["List-Unsubscribe"]).toContain("/api/unsubscribe/");
    const req = await db.reviewRequest.findUniqueOrThrow({ where: { id } });
    expect(req.status).toBe("SENT");
    expect(req.sentAt).not.toBeNull();
    const usage = await db.usageCounter.findUniqueOrThrow({ where: { clientId_month: { clientId: client.id, month: monthKey() } } });
    expect(usage.emailCount).toBe(1);
  });

  it("sends WhatsApp when there's a phone", async () => {
    const { client, user } = await makeClient({ name: "Joe's Cafe" });
    const id = await queue(client.id, user.id, { name: "Sipho Dube", phone: "0821234567" });
    expect(await deliverInitial(id)).toEqual({ result: "sent", channel: "WHATSAPP" });
    expect(sendWhatsAppTemplate.mock.calls[0][0]).toMatchObject({ toE164: "+27821234567", bodyParams: ["Sipho", "Joe's Cafe"] });
    expect(await db.messageEvent.count({ where: { providerMessageId: "wamid.1" } })).toBe(1);
  });

  it("falls back to email once when WhatsApp fails permanently", async () => {
    const { client, user } = await makeClient();
    const id = await queue(client.id, user.id, { name: "A", phone: "0821234567", email: "a@example.com" });
    sendWhatsAppTemplate.mockRejectedValue(new DeliveryError("bad number", true));
    expect(await deliverInitial(id)).toEqual({ result: "sent", channel: "EMAIL" });
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect((await db.reviewRequest.findUniqueOrThrow({ where: { id } })).channel).toBe("EMAIL");
  });

  it("marks FAILED when WhatsApp fails permanently and there's no email", async () => {
    const { client, user } = await makeClient();
    const id = await queue(client.id, user.id, { name: "A", phone: "0821234567" });
    sendWhatsAppTemplate.mockRejectedValue(new DeliveryError("bad number", true));
    expect((await deliverInitial(id)).result).toBe("failed");
    expect((await db.reviewRequest.findUniqueOrThrow({ where: { id } })).status).toBe("FAILED");
  });

  it("rethrows transient errors so the job retries", async () => {
    const { client, user } = await makeClient();
    const id = await queue(client.id, user.id, { name: "A", email: "a@example.com" });
    sendEmail.mockRejectedValue(new DeliveryError("rate limited", false));
    await expect(deliverInitial(id)).rejects.toThrow("rate limited");
    expect((await db.reviewRequest.findUniqueOrThrow({ where: { id } })).status).toBe("QUEUED");
  });

  it("uses email while WhatsApp isn't configured yet", async () => {
    waConfigured = false;
    const { client, user } = await makeClient();
    const id = await queue(client.id, user.id, { name: "A", phone: "0821234567", email: "a@example.com" });
    expect(await deliverInitial(id)).toEqual({ result: "sent", channel: "EMAIL" });
    expect(sendWhatsAppTemplate).not.toHaveBeenCalled();
  });

  it("skips queued jobs when the client has been paused", async () => {
    const { client, user } = await makeClient();
    const id = await queue(client.id, user.id, { name: "A", email: "a@example.com" });
    await db.client.update({ where: { id: client.id }, data: { status: "PAUSED" } });
    expect((await deliverInitial(id)).result).toBe("failed");
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("skips customers who opted out after being queued", async () => {
    const { client, user } = await makeClient();
    const id = await queue(client.id, user.id, { name: "A", email: "a@example.com" });
    await db.customer.updateMany({ data: { optedOutAt: new Date() } });
    expect((await deliverInitial(id)).result).toBe("failed");
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("is idempotent: a second run does nothing", async () => {
    const { client, user } = await makeClient();
    const id = await queue(client.id, user.id, { name: "A", email: "a@example.com" });
    await deliverInitial(id);
    expect((await deliverInitial(id)).result).toBe("skipped");
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });
});

describe("reminder job", () => {
  const DELAY = 3;
  async function sentRequest(opts: { daysAgo: number; clientOverrides?: Parameters<typeof makeClient>[0] }) {
    const { client, user } = await makeClient(opts.clientOverrides);
    const id = await queue(client.id, user.id, { name: "A", email: `a${Math.random()}@example.com` });
    await deliverInitial(id, new Date(Date.now() - opts.daysAgo * 86400_000));
    sendEmail.mockClear();
    return { id, client };
  }

  it("reminds once after 3 days when the customer hasn't rated", async () => {
    const { id } = await sentRequest({ daysAgo: 4 });
    expect((await findReminderCandidates(new Date(), DELAY)).map((r) => r.id)).toEqual([id]);
    expect((await deliverReminder(id, DELAY)).result).toBe("sent");
    expect(sendEmail.mock.calls[0][0].subject).toMatch(/reminder/i);
    const req = await db.reviewRequest.findUniqueOrThrow({ where: { id } });
    expect(req.reminderSentAt).not.toBeNull();
    // Second run: no second reminder.
    expect(await findReminderCandidates(new Date(), DELAY)).toEqual([]);
    expect((await deliverReminder(id, DELAY)).result).toBe("skipped");
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });

  it("does not remind before 3 days", async () => {
    const { id } = await sentRequest({ daysAgo: 2 });
    expect(await findReminderCandidates(new Date(), DELAY)).toEqual([]);
    expect((await deliverReminder(id, DELAY)).result).toBe("skipped");
  });

  it("does not remind customers who rated, opted out, or whose client paused / disabled reminders", async () => {
    const rated = await sentRequest({ daysAgo: 5 });
    await db.reviewRequest.update({ where: { id: rated.id }, data: { rating: 5, status: "RATED" } });
    const opted = await sentRequest({ daysAgo: 5 });
    await db.customer.updateMany({ where: { reviewRequests: { some: { id: opted.id } } }, data: { optedOutAt: new Date() } });
    const paused = await sentRequest({ daysAgo: 5 });
    await db.client.update({ where: { id: paused.client.id }, data: { status: "PAUSED" } });
    const off = await sentRequest({ daysAgo: 5, clientOverrides: { remindersEnabled: false } });

    expect(await findReminderCandidates(new Date(), DELAY)).toEqual([]);
    for (const r of [rated, opted, paused, off]) expect((await deliverReminder(r.id, DELAY)).result).toBe("skipped");
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("counts reminders toward usage and respects the monthly cap", async () => {
    const { id, client } = await sentRequest({ daysAgo: 4 });
    await deliverReminder(id, DELAY);
    const usage = await db.usageCounter.findUniqueOrThrow({ where: { clientId_month: { clientId: client.id, month: monthKey() } } });
    expect(usage.emailCount).toBeGreaterThanOrEqual(1);

    const capped = await sentRequest({ daysAgo: 4, clientOverrides: { monthlyCap: 1 } });
    await db.usageCounter.upsert({
      where: { clientId_month: { clientId: capped.client.id, month: monthKey() } },
      create: { clientId: capped.client.id, month: monthKey(), emailCount: 1 },
      update: { emailCount: 1 },
    });
    expect((await deliverReminder(capped.id, DELAY)).reason).toBe("monthly cap reached");
  });

  it("releases the claim on transient failure so the retry can send", async () => {
    const { id } = await sentRequest({ daysAgo: 4 });
    sendEmail.mockRejectedValueOnce(new DeliveryError("timeout", false));
    await expect(deliverReminder(id, DELAY)).rejects.toThrow();
    expect((await db.reviewRequest.findUniqueOrThrow({ where: { id } })).reminderSentAt).toBeNull();
    expect((await deliverReminder(id, DELAY)).result).toBe("sent");
  });
});

describe("WhatsApp async failure fallback", () => {
  it("falls back to email when a delivered-later failure arrives", async () => {
    const { client, user } = await makeClient();
    const id = await queue(client.id, user.id, { name: "A", phone: "0821234567", email: "a@example.com" });
    await deliverInitial(id);
    expect((await handleWhatsAppDeliveryFailure(id, "initial", "undeliverable")).result).toBe("sent");
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect((await db.reviewRequest.findUniqueOrThrow({ where: { id } })).channel).toBe("EMAIL");
  });

  it("marks failed when there is no email", async () => {
    const { client, user } = await makeClient();
    const id = await queue(client.id, user.id, { name: "A", phone: "0821234567" });
    await deliverInitial(id);
    expect((await handleWhatsAppDeliveryFailure(id, "initial", "undeliverable")).result).toBe("failed");
    expect((await db.reviewRequest.findUniqueOrThrow({ where: { id } })).status).toBe("FAILED");
  });
});
