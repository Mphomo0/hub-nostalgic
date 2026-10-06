import { beforeEach, describe, expect, it, vi } from "vitest";

const sendEmail = vi.fn();
vi.mock("@/lib/messaging/email", () => ({ sendEmail: (...a: unknown[]) => sendEmail(...a) }));

const { db } = await import("@/lib/db");
const { getEnabledModules } = await import("@/lib/modules");
const { tenantDb } = await import("@/lib/tenant");
const { MODULES, getModule, isModuleKey } = await import("@/modules/catalog");
const { processIntake } = await import("@/modules/reviews/lib/intake");
const { deliverInitial, deliverReminder, findReminderCandidates } = await import("@/modules/reviews/lib/deliver");
const { recordGoogleClick } = await import("@/modules/reviews/lib/rating");
const { makeClient, resetDb } = await import("./helpers");

/** The platform only lets a client use the modules switched on for them. */
describe("modules", () => {
  beforeEach(async () => {
    await resetDb();
    sendEmail.mockReset().mockResolvedValue({ id: "e1" });
  });

  it("catalog keys are unique and every module has a home link", () => {
    const keys = MODULES.map((m) => m.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const m of MODULES) expect(m.nav[0]?.href).toMatch(new RegExp(`^/dashboard/${m.key}`));
    expect(getModule("reviews")?.name).toBe("Reviews");
    expect(isModuleKey("nope")).toBe(false);
  });

  it("lists only the modules switched on for a client", async () => {
    const on = await makeClient();
    const off = await makeClient({ modules: [] });
    expect(await getEnabledModules(on.client.id)).toEqual(["reviews"]);
    expect(await getEnabledModules(off.client.id)).toEqual([]);
  });

  it("Reviews: can't send when the module is off", async () => {
    const { client, user } = await makeClient({ modules: [] });
    const r = await processIntake({ clientId: client.id, userId: user.id, consent: true, ip: null, batchLabel: "t", rows: [{ name: "A", email: "a@example.com" }] });
    expect(r.skipped.map((s) => s.reason)).toEqual(["MODULE_OFF"]);
  });

  it("Reviews: queued sends and reminders stop when the module is switched off", async () => {
    const { client, user } = await makeClient();
    const r = await processIntake({ clientId: client.id, userId: user.id, consent: true, ip: null, batchLabel: "t", rows: [{ name: "A", email: "a@example.com" }, { name: "B", email: "b@example.com" }] });
    const [first, second] = r.queued.map((q) => q.requestId);
    await deliverInitial(first, new Date(Date.now() - 5 * 86400_000));
    sendEmail.mockClear();

    await db.clientModule.deleteMany({ where: { clientId: client.id } });
    expect((await deliverInitial(second)).reason).toBe("module off");
    expect(await findReminderCandidates(new Date(), 3)).toEqual([]);
    expect((await deliverReminder(first, 3)).result).toBe("skipped");
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("Reviews settings come from the module's own table", async () => {
    const { client } = await makeClient();
    const req = await db.reviewRequest.create({
      data: { clientId: client.id, customerId: (await db.customer.create({ data: { clientId: client.id, name: "A", email: "a@example.com" } })).id, channel: "EMAIL", token: "tok-module-settings-0123456789", status: "RATED", rating: 5 },
    });
    await db.reviewSettings.update({ where: { clientId: client.id }, data: { googleReviewUrl: "https://g.page/r/changed/review" } });
    expect(await recordGoogleClick(req.token)).toBe("https://g.page/r/changed/review");
  });

  it("module tables are tenant-scoped", async () => {
    const a = await makeClient();
    const b = await makeClient();
    const t = tenantDb(a.client.id);
    expect((await t.reviewSettings.findMany()).map((s) => s.clientId)).toEqual([a.client.id]);
    expect((await t.clientModule.findMany()).every((m) => m.clientId === a.client.id)).toBe(true);
    expect((await t.reviewSettings.updateMany({ where: { clientId: b.client.id }, data: { googleReviewUrl: "https://evil.example/x" } })).count).toBe(0);
  });
});
