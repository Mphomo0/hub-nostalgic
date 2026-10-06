import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { getPublicRequest, markOpened, recordGoogleClick, submitFeedback, submitRating } from "@/modules/reviews/lib/rating";
import { optOutByPhone, optOutByToken } from "@/modules/reviews/lib/optout";
import { isStopMessage, verifyWebhookSignature } from "@/lib/messaging/whatsapp";
import { createHmac } from "node:crypto";
import { makeClient, resetDb, TEST_GOOGLE_URL } from "../helpers";

async function sentRequest(clientId: string, opts: { phone?: string; email?: string; token?: string; sentAt?: Date } = {}) {
  const customer = await db.customer.create({ data: { clientId, name: "Cust Omer", phoneE164: opts.phone ?? null, email: opts.email ?? null } });
  return db.reviewRequest.create({
    data: { clientId, customerId: customer.id, channel: opts.phone ? "WHATSAPP" : "EMAIL", token: opts.token ?? `tok-${Math.random().toString(36).slice(2)}-padding-padding`, status: "SENT", sentAt: opts.sentAt ?? new Date() },
  });
}

beforeEach(resetDb);

describe("rating page flow", () => {
  it("open → rate → Google click", async () => {
    const { client } = await makeClient();
    const req = await sentRequest(client.id, { email: "a@example.com" });
    const pub = await getPublicRequest(req.token);
    expect(pub?.client.name).toBe(client.name);
    // never leaks contact details
    expect(JSON.stringify(pub)).not.toContain("a@example.com");

    await markOpened(req.id);
    expect((await db.reviewRequest.findUniqueOrThrow({ where: { id: req.id } })).status).toBe("OPENED");

    const r = await submitRating(req.token, 5);
    expect(r).toMatchObject({ ok: true, alreadyRated: false, rating: 5 });

    const url = await recordGoogleClick(req.token);
    expect(url).toBe(TEST_GOOGLE_URL);
    const after = await db.reviewRequest.findUniqueOrThrow({ where: { id: req.id } });
    expect(after.status).toBe("CLICKED_GOOGLE");
    expect(after.googleClickedAt).not.toBeNull();
  });

  it("a token can only be rated once", async () => {
    const { client } = await makeClient();
    const req = await sentRequest(client.id, { email: "a@example.com" });
    await submitRating(req.token, 2);
    const again = await submitRating(req.token, 5);
    expect(again).toMatchObject({ ok: true, alreadyRated: true, rating: 2 });
  });

  it("rejects bad ratings and unknown tokens", async () => {
    expect((await submitRating("nope-nope-nope-nope-nope", 3)).ok).toBe(false);
    const { client } = await makeClient();
    const req = await sentRequest(client.id, { email: "a@example.com" });
    expect((await submitRating(req.token, 0)).ok).toBe(false);
    expect((await submitRating(req.token, 6)).ok).toBe(false);
    expect(await getPublicRequest("short")).toBeNull();
  });

  it("feedback only for low ratings (1–3), once", async () => {
    const { client } = await makeClient();
    const low = await sentRequest(client.id, { email: "a@example.com" });
    const high = await sentRequest(client.id, { email: "b@example.com" });
    await submitRating(low.token, 3);
    await submitRating(high.token, 4);
    expect(await submitFeedback(high.token, "hi")).toMatchObject({ ok: false, error: "not-allowed" });
    expect(await submitFeedback(low.token, "Cold food")).toEqual({ ok: true });
    expect(await submitFeedback(low.token, "again")).toMatchObject({ ok: false, error: "already-sent" });
    expect(await db.feedback.count()).toBe(1);
  });
});

describe("opt-out", () => {
  it("email unsubscribe link opts out that customer for that client only", async () => {
    const a = await makeClient();
    const b = await makeClient();
    const ra = await sentRequest(a.client.id, { email: "x@example.com" });
    await sentRequest(b.client.id, { email: "x@example.com" });
    expect(await optOutByToken(ra.token)).toEqual({ clientName: a.client.name });
    const rows = await db.customer.findMany({ where: { email: "x@example.com" }, orderBy: { createdAt: "asc" } });
    expect(rows.find((r) => r.clientId === a.client.id)?.optedOutAt).not.toBeNull();
    expect(rows.find((r) => r.clientId === b.client.id)?.optedOutAt).toBeNull();
    expect(await optOutByToken("unknown-token-unknown-token")).toBeNull();
  });

  it("WhatsApp STOP opts out of the client whose message was replied to", async () => {
    const a = await makeClient();
    const b = await makeClient();
    const phone = "+27821234567";
    const ra = await sentRequest(a.client.id, { phone, sentAt: new Date(Date.now() - 10_000) });
    await sentRequest(b.client.id, { phone, sentAt: new Date() });
    await db.messageEvent.create({ data: { reviewRequestId: ra.id, provider: "whatsapp", eventType: "sent", providerMessageId: "wamid.A" } });

    const r = await optOutByPhone(phone, { replyToMessageId: "wamid.A" });
    expect(r.scope).toBe("replied-client");
    const opted = await db.customer.findMany({ where: { phoneE164: phone, optedOutAt: { not: null } } });
    expect(opted.map((c) => c.clientId)).toEqual([a.client.id]);
  });

  it("WhatsApp STOP without context opts out of the most recent client", async () => {
    const a = await makeClient();
    const b = await makeClient();
    const phone = "+27821234567";
    await sentRequest(a.client.id, { phone, sentAt: new Date(Date.now() - 10_000) });
    await sentRequest(b.client.id, { phone, sentAt: new Date() });
    expect((await optOutByPhone(phone)).scope).toBe("latest-client");
    const opted = await db.customer.findMany({ where: { phoneE164: phone, optedOutAt: { not: null } } });
    expect(opted.map((c) => c.clientId)).toEqual([b.client.id]);
  });

  it("recognises STOP in any case with whitespace", () => {
    expect(isStopMessage(" stop ")).toBe(true);
    expect(isStopMessage("Stop")).toBe(true);
    expect(isStopMessage("stop please")).toBe(false);
    expect(isStopMessage(undefined)).toBe(false);
  });
});

describe("webhook signature", () => {
  it("accepts valid and rejects invalid signatures", () => {
    const body = '{"hello":"world"}';
    const sig = "sha256=" + createHmac("sha256", "s3cret").update(body).digest("hex");
    expect(verifyWebhookSignature(body, sig, "s3cret")).toBe(true);
    expect(verifyWebhookSignature(body + " ", sig, "s3cret")).toBe(false);
    expect(verifyWebhookSignature(body, null, "s3cret")).toBe(false);
    expect(verifyWebhookSignature(body, sig, undefined)).toBe(false);
  });
});

describe("retention", () => {
  it("deletes stale customers and minimises old opt-outs", async () => {
    const { purgeExpiredData } = await import("@/lib/retention");
    const { client } = await makeClient();
    const old = new Date("2020-01-01");
    const stale = await db.customer.create({ data: { clientId: client.id, name: "Stale", email: "s@example.com", createdAt: old } });
    await db.reviewRequest.create({ data: { clientId: client.id, customerId: stale.id, channel: "EMAIL", token: "stale-token-0123456789abcdef", createdAt: old } });
    await db.customer.create({ data: { clientId: client.id, name: "Opted", email: "o@example.com", createdAt: old, optedOutAt: old } });
    await db.customer.create({ data: { clientId: client.id, name: "Fresh", email: "f@example.com" } });

    const r = await purgeExpiredData();
    expect(r).toMatchObject({ customersDeleted: 1, optOutsMinimised: 1 });
    const left = await db.customer.findMany({ orderBy: { email: "asc" } });
    expect(left.map((c) => [c.email, c.name])).toEqual([["f@example.com", "Fresh"], ["o@example.com", "(expired)"]]);
    expect(await db.reviewRequest.count()).toBe(0);
  });
});
