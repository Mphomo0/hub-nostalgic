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
const { resolveLocation, saveLocation, deleteLocation } = await import("@/modules/reviews/lib/locations");
const { firstLocationId, makeClient, resetDb } = await import("./helpers");

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
    const r = await processIntake({ clientId: client.id, locationId: await firstLocationId(client.id), userId: user.id, consent: true, ip: null, batchLabel: "t", rows: [{ name: "A", email: "a@example.com" }] });
    expect(r.skipped.map((s) => s.reason)).toEqual(["MODULE_OFF"]);
  });

  it("Reviews: queued sends and reminders stop when the module is switched off", async () => {
    const { client, user } = await makeClient();
    const r = await processIntake({ clientId: client.id, locationId: await firstLocationId(client.id), userId: user.id, consent: true, ip: null, batchLabel: "t", rows: [{ name: "A", email: "a@example.com" }, { name: "B", email: "b@example.com" }] });
    const [first, second] = r.queued.map((q) => q.requestId);
    await deliverInitial(first, new Date(Date.now() - 5 * 86400_000));
    sendEmail.mockClear();

    await db.clientModule.deleteMany({ where: { clientId: client.id } });
    expect((await deliverInitial(second)).reason).toBe("module off");
    expect(await findReminderCandidates(new Date(), 3)).toEqual([]);
    expect((await deliverReminder(first, 3)).result).toBe("skipped");
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("the Google link comes from the request's branch", async () => {
    const { client } = await makeClient();
    const second = await db.reviewLocation.create({ data: { clientId: client.id, name: "Second", googleReviewUrl: "https://g.page/r/second/review" } });
    const customer = await db.customer.create({ data: { clientId: client.id, name: "A", email: "a@example.com" } });
    const mk = (token: string, locationId: string) =>
      db.reviewRequest.create({ data: { clientId: client.id, locationId, customerId: customer.id, channel: "EMAIL", token, status: "RATED", rating: 5 } });
    const first = await mk("tok-branch-first-0123456789", await firstLocationId(client.id));
    const other = await mk("tok-branch-second-0123456789", second.id);
    expect(await recordGoogleClick(first.token)).toBe("https://g.page/r/example/review");
    expect(await recordGoogleClick(other.token)).toBe("https://g.page/r/second/review");
  });

  it("branches: one needs no choice, several need an explicit (and own) one, and used ones can't be deleted", async () => {
    const a = await makeClient();
    const b = await makeClient();
    const aFirst = await firstLocationId(a.client.id);
    expect(await resolveLocation(a.client.id, undefined)).toBe(aFirst);
    await saveLocation(a.client.id, { name: "Second", googleReviewUrl: "https://g.page/r/second/review" });
    expect(await resolveLocation(a.client.id, undefined)).toBeNull();
    expect(await resolveLocation(a.client.id, aFirst)).toBe(aFirst);
    // Another client's branch id is never accepted.
    expect(await resolveLocation(b.client.id, aFirst)).toBeNull();
    expect(await saveLocation(b.client.id, { id: aFirst, name: "Hijack", googleReviewUrl: "https://evil.example/x" })).toMatchObject({ ok: false });

    await processIntake({ clientId: a.client.id, locationId: aFirst, userId: a.user.id, consent: true, ip: null, batchLabel: "t", rows: [{ name: "A", email: "a@example.com" }] });
    expect(await deleteLocation(a.client.id, aFirst)).toMatchObject({ ok: false });
    const second = (await db.reviewLocation.findMany({ where: { clientId: a.client.id, id: { not: aFirst } } }))[0];
    expect(await deleteLocation(a.client.id, second.id)).toMatchObject({ ok: true });
    expect(await deleteLocation(a.client.id, aFirst)).toMatchObject({ ok: false }); // last one
  });

  it("module tables are tenant-scoped", async () => {
    const a = await makeClient();
    const b = await makeClient();
    const t = tenantDb(a.client.id);
    expect((await t.reviewSettings.findMany()).map((s) => s.clientId)).toEqual([a.client.id]);
    expect((await t.clientModule.findMany()).every((m) => m.clientId === a.client.id)).toBe(true);
    expect((await t.reviewLocation.findMany()).every((l) => l.clientId === a.client.id)).toBe(true);
    expect((await t.reviewLocation.updateMany({ where: { clientId: b.client.id }, data: { googleReviewUrl: "https://evil.example/x" } })).count).toBe(0);
  });
});
