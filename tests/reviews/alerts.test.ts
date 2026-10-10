import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { collectFailures, summariseFailures, type FailureRow } from "@/modules/reviews/lib/alerts";
import { makeClient, resetDb } from "../helpers";

const MIN = 60 * 1000;
let n = 0;

async function request(clientId: string, status: "QUEUED" | "SENT" | "FAILED", opts: { createdAt?: Date; updatedAt?: Date; reason?: string } = {}) {
  n += 1;
  const customer = await db.customer.create({ data: { clientId, name: `Cust ${n}`, email: `c${n}-${Date.now()}@example.com` } });
  const r = await db.reviewRequest.create({
    data: {
      clientId, customerId: customer.id, channel: "EMAIL", token: `tok-${n}-${Math.random().toString(36).slice(2)}-padding-padding`,
      status, failureReason: opts.reason ?? null, createdAt: opts.createdAt ?? new Date(),
    },
  });
  if (opts.updatedAt) await db.$executeRaw`UPDATE review_request SET "updatedAt" = ${opts.updatedAt} WHERE id = ${r.id}::uuid`;
  return r;
}

describe("collectFailures", () => {
  beforeEach(resetDb);

  it("reports recent failures and stuck queue items, not healthy or old ones", async () => {
    const { client } = await makeClient({ name: "Acme" });
    const now = new Date();
    await request(client.id, "FAILED", { reason: "WhatsApp: Business eligibility payment issue" });
    await request(client.id, "FAILED", { reason: "old failure", updatedAt: new Date(now.getTime() - 3 * 60 * MIN) });
    await request(client.id, "QUEUED", { createdAt: new Date(now.getTime() - 45 * MIN) });
    await request(client.id, "QUEUED"); // just queued, still normal
    await request(client.id, "QUEUED", { createdAt: new Date(now.getTime() - 48 * 60 * MIN) }); // too old to keep alerting on
    await request(client.id, "SENT");

    const rows = await collectFailures(now);
    expect(rows.filter((r) => r.kind === "failed")).toEqual([{ clientName: "Acme", kind: "failed", reason: "WhatsApp: Business eligibility payment issue" }]);
    expect(rows.filter((r) => r.kind === "stuck")).toHaveLength(1);
  });
});

describe("summariseFailures", () => {
  it("returns null when there is nothing to report", () => {
    expect(summariseFailures([], "https://example.com/admin")).toBeNull();
  });

  it("groups by client and reason and counts them", () => {
    const rows: FailureRow[] = [
      { clientName: "Acme", kind: "failed", reason: "WhatsApp: payment issue" },
      { clientName: "Acme", kind: "failed", reason: "WhatsApp: payment issue" },
      { clientName: "Beta", kind: "failed", reason: null },
      { clientName: "Acme", kind: "stuck", reason: null },
    ];
    const d = summariseFailures(rows, "https://example.com/admin")!;
    expect(d.subject).toBe("Nostalgic Hub: 3 failed, 1 stuck in the queue");
    expect(d.text).toContain("Acme: 2 × WhatsApp: payment issue");
    expect(d.text).toContain("Beta: 1 × No reason recorded");
    expect(d.text).toContain("Acme: 1 × Waiting in the queue and not sent");
    expect(d.total).toBe(4);
  });

  it("escapes HTML in client names and reasons", () => {
    const d = summariseFailures([{ clientName: "<b>Evil</b>", kind: "failed", reason: "<script>x</script>" }], "https://example.com/admin")!;
    expect(d.html).not.toContain("<script>");
    expect(d.html).toContain("&lt;b&gt;Evil&lt;/b&gt;");
  });
});
