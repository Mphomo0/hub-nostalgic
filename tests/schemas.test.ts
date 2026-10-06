import { describe, expect, it } from "vitest";
import { acceptInviteSchema, createClientSchema, updateClientSchema } from "@/lib/schemas";
import { manualSendSchema, reviewSettingsSchema as settingsSchema } from "@/modules/reviews/schemas";

/** The same schemas validate react-hook-form values (browser) and FormData (server). */
describe("shared form schemas", () => {
  const base = { googleReviewUrl: "https://g.page/r/x/review" };
  const clientBase = { name: "Joe's", brandColor: "#112233" };

  it("reads checkboxes from react-hook-form (boolean) and FormData ('on' / missing)", () => {
    expect(settingsSchema.parse({ ...base, remindersEnabled: true }).remindersEnabled).toBe(true);
    expect(settingsSchema.parse({ ...base, remindersEnabled: "on" }).remindersEnabled).toBe(true);
    expect(settingsSchema.parse({ ...base }).remindersEnabled).toBe(false);
    expect(settingsSchema.parse({ ...base, remindersEnabled: false }).remindersEnabled).toBe(false);
  });

  it("parses the optional monthly cap and contact fields", () => {
    const id = "6f1c9a52-7f0e-4c7a-9a7e-2b9a1c3d4e5f";
    const ok = updateClientSchema.parse({ ...clientBase, clientId: id, monthlyCap: "", contactEmail: "", contactPhone: "" });
    expect(ok).toMatchObject({ monthlyCap: null, contactEmail: null, contactPhone: null });
    expect(updateClientSchema.parse({ ...clientBase, clientId: id, monthlyCap: "250", contactEmail: " A@B.co " })).toMatchObject({ monthlyCap: 250, contactEmail: "a@b.co" });
    const bad = updateClientSchema.safeParse({ ...clientBase, clientId: id, monthlyCap: "12.5", contactEmail: "nope" });
    expect(bad.success).toBe(false);
    expect(bad.error!.issues.map((i) => i.path[0]).sort()).toEqual(["contactEmail", "monthlyCap"]);
  });

  it("rejects non-https Google links", () => {
    expect(settingsSchema.safeParse({ ...base, googleReviewUrl: "http://g.page/x" }).success).toBe(false);
  });

  it("new clients: modules from checkboxes, Google link required only with Reviews", () => {
    const client = { name: "Joe's", ownerName: "Joe", ownerEmail: "joe@example.com", brandColor: "#112233", status: "ACTIVE" };
    // FormData sends one checkbox as a string, several as an array, none as missing.
    expect(createClientSchema.parse({ ...client, modules: "reviews", googleReviewUrl: base.googleReviewUrl }).modules).toEqual(["reviews"]);
    expect(createClientSchema.parse({ ...client }).modules).toEqual([]);
    const noLink = createClientSchema.safeParse({ ...client, modules: ["reviews"], googleReviewUrl: "" });
    expect(noLink.error?.issues[0].path).toEqual(["googleReviewUrl"]);
    expect(createClientSchema.safeParse({ ...client, modules: ["made-up"] }).success).toBe(false);
  });

  it("puts sending-rule errors on the right field", () => {
    const field = (row: object) => manualSendSchema.safeParse({ name: "A", phone: "", email: "", consent: true, ...row }).error?.issues[0].path[0];
    expect(field({ phone: "123" })).toBe("phone");
    expect(field({ email: "bad" })).toBe("email");
    expect(field({ name: " ", email: "a@b.co" })).toBe("name");
    expect(field({})).toBe("phone"); // no contact details
    expect(field({ email: "a@b.co", consent: false })).toBe("consent");
    expect(manualSendSchema.safeParse({ name: "A", phone: "082 123 4567", email: "", consent: true }).success).toBe(true);
  });

  it("checks the invite passwords match", () => {
    const r = acceptInviteSchema.safeParse({ token: "x".repeat(43), password: "long-enough-1", confirm: "different-11" });
    expect(r.error?.issues[0].path).toEqual(["confirm"]);
  });
});
