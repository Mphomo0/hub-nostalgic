import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { monthKey } from "@/lib/dates";
import { chooseChannel, normaliseRow, processIntake, type IntakeRow } from "@/modules/reviews/lib/intake";
import { makeClient, resetDb } from "../helpers";

async function run(clientId: string, userId: string, rows: IntakeRow[], extra: { consent?: boolean; now?: Date } = {}) {
  return processIntake({ clientId, userId, consent: extra.consent ?? true, ip: "127.0.0.1", batchLabel: "test", rows, now: extra.now });
}

describe("normaliseRow", () => {
  it("normalises South African numbers to E.164", () => {
    expect(normaliseRow({ name: "A", phone: "082 123 4567" })).toMatchObject({ ok: true, phoneE164: "+27821234567" });
    expect(normaliseRow({ name: "A", phone: "+27 82 123 4567" })).toMatchObject({ ok: true, phoneE164: "+27821234567" });
    expect(normaliseRow({ name: "A", phone: "0027821234567" })).toMatchObject({ ok: true, phoneE164: "+27821234567" });
  });
  it("lowercases email", () => {
    expect(normaliseRow({ name: "A", email: " Foo@Example.COM " })).toMatchObject({ ok: true, email: "foo@example.com" });
  });
  it("picks WhatsApp when there's a phone, otherwise email", () => {
    expect(chooseChannel({ phoneE164: "+27821234567" })).toBe("WHATSAPP");
    expect(chooseChannel({ phoneE164: null })).toBe("EMAIL");
  });
});

describe("processIntake: every skip reason", () => {
  let ctx: Awaited<ReturnType<typeof makeClient>>;
  beforeEach(async () => {
    await resetDb();
    ctx = await makeClient();
  });

  it("queues a valid row, logs consent, creates the customer", async () => {
    const r = await run(ctx.client.id, ctx.user.id, [{ name: "Thandi", phone: "0821234567", email: "t@example.com" }]);
    expect(r.skipped).toEqual([]);
    expect(r.queued).toHaveLength(1);
    expect(r.queued[0].channel).toBe("WHATSAPP");
    const req = await db.reviewRequest.findUniqueOrThrow({ where: { id: r.queued[0].requestId }, include: { customer: true } });
    expect(req.status).toBe("QUEUED");
    expect(req.sentByUserId).toBe(ctx.user.id);
    expect(req.consentLogId).toBe(r.consentLogId);
    expect(req.token.length).toBeGreaterThanOrEqual(43);
    expect(req.customer.phoneE164).toBe("+27821234567");
    const log = await db.consentLog.findUniqueOrThrow({ where: { id: r.consentLogId! } });
    expect(log).toMatchObject({ userId: ctx.user.id, ip: "127.0.0.1", batchLabel: "test" });
  });

  it("1. CLIENT_PAUSED", async () => {
    const paused = await makeClient({ status: "PAUSED" });
    const r = await run(paused.client.id, paused.user.id, [{ name: "A", email: "a@example.com" }]);
    expect(r.skipped.map((s) => s.reason)).toEqual(["CLIENT_PAUSED"]);
    expect(await db.consentLog.count()).toBe(0);
  });

  it("2. NO_CONSENT", async () => {
    const r = await run(ctx.client.id, ctx.user.id, [{ name: "A", email: "a@example.com" }], { consent: false });
    expect(r.skipped.map((s) => s.reason)).toEqual(["NO_CONSENT"]);
    expect(await db.reviewRequest.count()).toBe(0);
  });

  it("3. INVALID_PHONE, INVALID_EMAIL, MISSING_NAME", async () => {
    const r = await run(ctx.client.id, ctx.user.id, [
      { name: "A", phone: "12345" },
      { name: "B", email: "not-an-email" },
      { name: " ", email: "c@example.com" },
    ]);
    expect(r.skipped.map((s) => s.reason)).toEqual(["INVALID_PHONE", "INVALID_EMAIL", "MISSING_NAME"]);
  });

  it("4. NO_CONTACT", async () => {
    const r = await run(ctx.client.id, ctx.user.id, [{ name: "A", phone: "", email: "" }]);
    expect(r.skipped.map((s) => s.reason)).toEqual(["NO_CONTACT"]);
  });

  it("DUPLICATE_IN_BATCH", async () => {
    const r = await run(ctx.client.id, ctx.user.id, [
      { name: "A", phone: "0821234567" },
      { name: "A again", phone: "+27821234567" },
    ]);
    expect(r.queued).toHaveLength(1);
    expect(r.skipped.map((s) => s.reason)).toEqual(["DUPLICATE_IN_BATCH"]);
  });

  it("5. OPTED_OUT, and re-uploading never re-enables contact", async () => {
    await db.customer.create({ data: { clientId: ctx.client.id, name: "Old", email: "a@example.com", optedOutAt: new Date() } });
    const r = await run(ctx.client.id, ctx.user.id, [{ name: "A", email: "a@example.com", phone: "0821234567" }]);
    expect(r.skipped.map((s) => s.reason)).toEqual(["OPTED_OUT"]);
    const c = await db.customer.findFirstOrThrow({ where: { email: "a@example.com" } });
    expect(c.optedOutAt).not.toBeNull();
  });

  it("opt-out only applies to that client", async () => {
    const other = await makeClient();
    await db.customer.create({ data: { clientId: other.client.id, name: "A", email: "a@example.com", optedOutAt: new Date() } });
    const r = await run(ctx.client.id, ctx.user.id, [{ name: "A", email: "a@example.com" }]);
    expect(r.queued).toHaveLength(1);
  });

  it("6. RECENTLY_CONTACTED within 30 days, allowed after", async () => {
    const now = new Date("2026-06-01T10:00:00Z");
    const first = await run(ctx.client.id, ctx.user.id, [{ name: "A", email: "a@example.com" }], { now });
    // Pretend it was sent.
    await db.reviewRequest.update({ where: { id: first.queued[0].requestId }, data: { status: "SENT", createdAt: now } });

    const day29 = new Date(now.getTime() + 29 * 86400_000);
    const second = await run(ctx.client.id, ctx.user.id, [{ name: "A", email: "a@example.com" }], { now: day29 });
    expect(second.skipped.map((s) => s.reason)).toEqual(["RECENTLY_CONTACTED"]);

    const day31 = new Date(now.getTime() + 31 * 86400_000);
    const third = await run(ctx.client.id, ctx.user.id, [{ name: "A", email: "a@example.com" }], { now: day31 });
    expect(third.queued).toHaveLength(1);
  });

  it("6. matches the same customer by phone even if the email differs", async () => {
    await run(ctx.client.id, ctx.user.id, [{ name: "A", phone: "0821234567" }]);
    const r = await run(ctx.client.id, ctx.user.id, [{ name: "A", phone: "082 123 4567", email: "new@example.com" }]);
    expect(r.skipped.map((s) => s.reason)).toEqual(["RECENTLY_CONTACTED"]);
  });

  it("7. MONTHLY_CAP counts sent + queued messages", async () => {
    const capped = await makeClient({ monthlyCap: 3 });
    await db.usageCounter.create({ data: { clientId: capped.client.id, month: monthKey(), whatsappCount: 1, emailCount: 0 } });
    const r = await run(capped.client.id, capped.user.id, [
      { name: "A", email: "a@example.com" },
      { name: "B", email: "b@example.com" },
      { name: "C", email: "c@example.com" },
    ]);
    expect(r.queued).toHaveLength(2);
    expect(r.skipped.map((s) => s.reason)).toEqual(["MONTHLY_CAP"]);
  });

  it("fills in missing contact details on an existing customer", async () => {
    await db.customer.create({ data: { clientId: ctx.client.id, name: "A", email: "a@example.com" } });
    const r = await run(ctx.client.id, ctx.user.id, [{ name: "Anna", email: "a@example.com", phone: "0821234567" }]);
    expect(r.queued[0].channel).toBe("WHATSAPP");
    const c = await db.customer.findFirstOrThrow({ where: { email: "a@example.com" } });
    expect(c).toMatchObject({ name: "Anna", phoneE164: "+27821234567" });
    expect(await db.customer.count()).toBe(1);
  });
});
