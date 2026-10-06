import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { tenantDb, TenancyError } from "@/lib/tenant";
import { makeClient, resetDb } from "./helpers";

/** Proves client A can never read or modify client B's data (build plan section 5). */
describe("tenant isolation", () => {
  let a: Awaited<ReturnType<typeof makeClient>>;
  let b: Awaited<ReturnType<typeof makeClient>>;
  let bCustomerId: string;
  let bRequestId: string;
  let bFeedbackId: string;

  beforeEach(async () => {
    await resetDb();
    a = await makeClient({ name: "A" });
    b = await makeClient({ name: "B" });
    await db.customer.create({ data: { clientId: a.client.id, name: "Alice", email: "alice@example.com" } });
    const bc = await db.customer.create({ data: { clientId: b.client.id, name: "Bob", email: "bob@example.com" } });
    bCustomerId = bc.id;
    const br = await db.reviewRequest.create({ data: { clientId: b.client.id, customerId: bc.id, channel: "EMAIL", token: "b-token-0123456789abcdefghij", status: "RATED", rating: 2 } });
    bRequestId = br.id;
    bFeedbackId = (await db.feedback.create({ data: { reviewRequestId: br.id, message: "B secret feedback" } })).id;
  });

  it("lists only the caller's customers", async () => {
    const rows = await tenantDb(a.client.id).customer.findMany();
    expect(rows.map((r) => r.name)).toEqual(["Alice"]);
  });

  it("cannot fetch another client's record by id", async () => {
    const t = tenantDb(a.client.id);
    expect(await t.customer.findUnique({ where: { id: bCustomerId } })).toBeNull();
    expect(await t.customer.findFirst({ where: { id: bCustomerId } })).toBeNull();
    expect(await t.reviewRequest.findUnique({ where: { id: bRequestId } })).toBeNull();
    expect(await t.feedback.findUnique({ where: { id: bFeedbackId } })).toBeNull();
    expect(await t.client.findUnique({ where: { id: b.client.id } })).toBeNull();
    expect(await t.user.findUnique({ where: { id: b.user.id } })).toBeNull();
  });

  it("ignores where clauses that try to name another client", async () => {
    const t = tenantDb(a.client.id);
    expect(await t.customer.findMany({ where: { clientId: b.client.id } })).toEqual([]);
    expect(await t.reviewRequest.count({ where: { clientId: b.client.id } })).toBe(0);
    expect(await t.feedback.findMany({ where: { reviewRequest: { clientId: b.client.id } } })).toEqual([]);
  });

  it("cannot update or delete another client's data", async () => {
    const t = tenantDb(a.client.id);
    expect((await t.customer.updateMany({ where: { id: bCustomerId }, data: { name: "Hacked" } })).count).toBe(0);
    await expect(t.customer.update({ where: { id: bCustomerId }, data: { name: "Hacked" } })).rejects.toThrow();
    expect((await t.feedback.updateMany({ where: { id: bFeedbackId }, data: { handledAt: new Date() } })).count).toBe(0);
    expect((await t.customer.deleteMany({ where: { id: bCustomerId } })).count).toBe(0);
    await expect(t.client.update({ where: { id: b.client.id }, data: { name: "Hacked" } })).rejects.toThrow();
    await expect(t.membership.delete({ where: { userId: b.user.id } })).rejects.toThrow();

    const bob = await db.customer.findUniqueOrThrow({ where: { id: bCustomerId } });
    expect(bob.name).toBe("Bob");
    expect((await db.feedback.findUniqueOrThrow({ where: { id: bFeedbackId } })).handledAt).toBeNull();
    expect((await db.client.findUniqueOrThrow({ where: { id: b.client.id } })).name).toBe("B");
  });

  it("forces the caller's clientId on create", async () => {
    const t = tenantDb(a.client.id);
    const c = await t.customer.create({ data: { clientId: b.client.id, name: "Sneaky", email: "sneaky@example.com" } as never });
    expect(c.clientId).toBe(a.client.id);
  });

  it("refuses unscoped models and unsupported operations", async () => {
    const t = tenantDb(a.client.id);
    await expect(t.enquiry.findMany()).rejects.toBeInstanceOf(TenancyError);
    await expect(t.session.findMany()).rejects.toBeInstanceOf(TenancyError);
    await expect(t.feedback.create({ data: { reviewRequestId: bRequestId, message: "x" } })).rejects.toBeInstanceOf(TenancyError);
  });
});
