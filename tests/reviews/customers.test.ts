import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { tenantDb } from "@/lib/tenant";
import { csvCell, customerWhere, displayPhone, summariseCustomer } from "@/modules/reviews/lib/customers";
import { makeClient, resetDb } from "../helpers";

const DAY = 24 * 60 * 60 * 1000;
let seq = 0;

async function customer(clientId: string, name: string, opts: { optedOut?: boolean } = {}) {
  seq += 1;
  return db.customer.create({
    data: { clientId, name, phoneE164: `+2782000${String(seq).padStart(4, "0")}`, email: `${name.toLowerCase().replace(/\W/g, "")}@example.com`, optedOutAt: opts.optedOut ? new Date() : null },
  });
}

async function request(
  clientId: string,
  customerId: string,
  r: { sent?: boolean; rating?: number; google?: boolean; status?: "QUEUED" | "SENT" | "FAILED" | "RATED" | "CLICKED_GOOGLE"; createdAt?: Date } = {},
) {
  seq += 1;
  const now = new Date();
  return db.reviewRequest.create({
    data: {
      clientId,
      customerId,
      channel: "WHATSAPP",
      token: `token-${seq}-${Math.random().toString(36).slice(2)}-padding-padding`,
      status: r.status ?? (r.google ? "CLICKED_GOOGLE" : r.rating ? "RATED" : r.sent ? "SENT" : "QUEUED"),
      sentAt: r.sent || r.rating || r.google ? now : null,
      rating: r.rating ?? null,
      ratedAt: r.rating ? now : null,
      googleClickedAt: r.google ? now : null,
      createdAt: r.createdAt ?? now,
    },
  });
}

describe("customers page filters", () => {
  beforeEach(resetDb);

  it("splits customers into reviewed, not reviewed, opted out and not sent", async () => {
    const { client } = await makeClient();
    const reviewed = await customer(client.id, "Reviewed Rita");
    await request(client.id, reviewed.id, { rating: 5, google: true });
    const rated = await customer(client.id, "Rated Ron");
    await request(client.id, rated.id, { rating: 4 });
    const waiting = await customer(client.id, "Waiting Wanda");
    await request(client.id, waiting.id, { sent: true });
    const failed = await customer(client.id, "Failed Fred");
    await request(client.id, failed.id, { status: "FAILED" });
    await customer(client.id, "Never Nina");
    const out = await customer(client.id, "Opted Oscar", { optedOut: true });
    await request(client.id, out.id, { sent: true });

    const tdb = tenantDb(client.id);
    const names = async (f: Parameters<typeof customerWhere>[0]) =>
      (await tdb.customer.findMany({ where: customerWhere(f), select: { name: true } })).map((c) => c.name).sort();

    expect(await names("all")).toHaveLength(6);
    expect(await names("reviewed")).toEqual(["Reviewed Rita"]);
    expect(await names("not-reviewed")).toEqual(["Rated Ron", "Waiting Wanda"]);
    expect(await names("opted-out")).toEqual(["Opted Oscar"]);
    expect(await names("not-sent")).toEqual(["Failed Fred", "Never Nina"]);
  });

  it("keeps a customer who reviewed and later opted out in the reviewed list", async () => {
    const { client } = await makeClient();
    const c = await customer(client.id, "Both Bongani", { optedOut: true });
    await request(client.id, c.id, { rating: 5, google: true });
    const tdb = tenantDb(client.id);
    expect(await tdb.customer.count({ where: customerWhere("reviewed") })).toBe(1);
    expect(await tdb.customer.count({ where: customerWhere("opted-out") })).toBe(1);
    expect(await tdb.customer.count({ where: customerWhere("not-reviewed") })).toBe(0);
  });

  it("searches by name, email and phone digits", async () => {
    const { client } = await makeClient();
    const a = await customer(client.id, "Thandi Dlamini");
    await customer(client.id, "Sipho Khumalo");
    const tdb = tenantDb(client.id);
    expect(await tdb.customer.count({ where: customerWhere("all", "thandi") })).toBe(1);
    expect(await tdb.customer.count({ where: customerWhere("all", "KHUMALO") })).toBe(1);
    expect(await tdb.customer.count({ where: customerWhere("all", a.phoneE164!.slice(-6)) })).toBe(1);
    expect(await tdb.customer.count({ where: customerWhere("all", "nobody") })).toBe(0);
  });

  it("only returns the logged-in client's customers", async () => {
    const a = await makeClient();
    const b = await makeClient();
    await customer(a.client.id, "Mine");
    await customer(b.client.id, "Theirs");
    const rows = await tenantDb(a.client.id).customer.findMany({ where: customerWhere("all"), select: { name: true } });
    expect(rows.map((r) => r.name)).toEqual(["Mine"]);
  });
});

describe("summariseCustomer", () => {
  const base = { createdAt: new Date(), sentAt: null, ratedAt: null, rating: null, googleClickedAt: null, status: "QUEUED" };
  const now = new Date("2026-10-10T12:00:00Z");

  it("reports the strongest state", () => {
    expect(summariseCustomer({ optedOutAt: null }, [], now).state).toBe("not-sent");
    expect(summariseCustomer({ optedOutAt: null }, [{ ...base, sentAt: now, status: "SENT" }], now).state).toBe("waiting");
    expect(summariseCustomer({ optedOutAt: null }, [{ ...base, sentAt: now, ratedAt: now, rating: 4, status: "RATED" }], now)).toMatchObject({ state: "rated", rating: 4 });
    expect(summariseCustomer({ optedOutAt: null }, [{ ...base, sentAt: now, googleClickedAt: now, status: "CLICKED_GOOGLE" }], now).state).toBe("reviewed");
  });

  it("flags opt-outs separately from the state", () => {
    const s = summariseCustomer({ optedOutAt: now }, [{ ...base, sentAt: now, googleClickedAt: now, status: "CLICKED_GOOGLE" }], now);
    expect(s.state).toBe("reviewed");
    expect(s.optedOut).toBe(true);
  });

  it("applies the 30-day rule and ignores failed requests", () => {
    const recent = { ...base, createdAt: new Date(now.getTime() - 5 * DAY), sentAt: now, status: "SENT" };
    const s = summariseCustomer({ optedOutAt: null }, [recent], now);
    expect(s.nextEligibleAt?.getTime()).toBe(recent.createdAt.getTime() + 30 * DAY);
    expect(summariseCustomer({ optedOutAt: null }, [{ ...recent, status: "FAILED" }], now).nextEligibleAt).toBeNull();
    expect(summariseCustomer({ optedOutAt: null }, [{ ...recent, createdAt: new Date(now.getTime() - 40 * DAY) }], now).nextEligibleAt).toBeNull();
  });
});

describe("csv + phone helpers", () => {
  it("quotes values and escapes quotes", () => {
    expect(csvCell('Say "hi", Bob')).toBe('"Say ""hi"", Bob"');
    expect(csvCell(null)).toBe('""');
    expect(csvCell(5)).toBe('"5"');
  });

  it("neutralises spreadsheet formulas but keeps phone numbers", () => {
    expect(csvCell("=HYPERLINK(\"x\")")).toBe(`"'=HYPERLINK(""x"")"`);
    expect(csvCell("@cmd")).toBe(`"'@cmd"`);
    expect(csvCell("+27 76 831 0082")).toBe('"+27 76 831 0082"');
  });

  it("formats South African numbers", () => {
    expect(displayPhone("+27768310082")).toBe("+27 76 831 0082");
    expect(displayPhone("+14155550100")).toBe("+14155550100");
    expect(displayPhone(null)).toBe("");
  });
});
