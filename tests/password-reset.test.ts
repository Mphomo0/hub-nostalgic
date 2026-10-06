import { beforeEach, describe, expect, it, vi } from "vitest";

const sendEmail = vi.fn();
vi.mock("@/lib/messaging/email", () => ({ sendEmail: (...a: unknown[]) => sendEmail(...a) }));

const { auth } = await import("@/lib/auth");
const { db } = await import("@/lib/db");
const { resetDb } = await import("./helpers");

async function createLogin(email: string, password: string) {
  const ctx = await auth.$context;
  const user = await db.user.create({ data: { email, name: "Pat", emailVerified: true } });
  await db.account.create({ data: { userId: user.id, accountId: user.id, providerId: "credential", password: await ctx.password.hash(password) } });
  return user;
}

/** Waits for the reset email and pulls the token out of its link. */
async function resetTokenFromEmail() {
  await vi.waitFor(() => expect(sendEmail).toHaveBeenCalled());
  const mail = sendEmail.mock.calls.at(-1)![0] as { to: string; text: string };
  const url = new URL(/https?:\/\/\S+\/reset-password\?token=\S+/.exec(mail.text)![0]);
  return { to: mail.to, token: url.searchParams.get("token")!, path: url.pathname };
}

describe("forgot password", () => {
  beforeEach(async () => {
    await resetDb();
    sendEmail.mockReset().mockResolvedValue({ id: "e1" });
  });

  it("emails a link to our reset page, and the new password works", async () => {
    await createLogin("pat@example.com", "old-password-123");
    await auth.api.requestPasswordReset({ body: { email: "pat@example.com" } });
    const { to, token, path } = await resetTokenFromEmail();
    expect(to).toBe("pat@example.com");
    expect(path).toBe("/reset-password");

    await auth.api.resetPassword({ body: { token, newPassword: "new-password-456" } });

    await expect(auth.api.signInEmail({ body: { email: "pat@example.com", password: "old-password-123" } })).rejects.toThrow();
    const ok = await auth.api.signInEmail({ body: { email: "pat@example.com", password: "new-password-456" } });
    expect(ok.user.email).toBe("pat@example.com");
  });

  it("links work only once", async () => {
    await createLogin("pat@example.com", "old-password-123");
    await auth.api.requestPasswordReset({ body: { email: "pat@example.com" } });
    const { token } = await resetTokenFromEmail();
    await auth.api.resetPassword({ body: { token, newPassword: "new-password-456" } });
    await expect(auth.api.resetPassword({ body: { token, newPassword: "another-password-789" } })).rejects.toThrow();
  });

  it("enforces the minimum password length", async () => {
    await createLogin("pat@example.com", "old-password-123");
    await auth.api.requestPasswordReset({ body: { email: "pat@example.com" } });
    const { token } = await resetTokenFromEmail();
    await expect(auth.api.resetPassword({ body: { token, newPassword: "short" } })).rejects.toThrow();
  });

  it("logs out existing sessions after a reset", async () => {
    const user = await createLogin("pat@example.com", "old-password-123");
    await auth.api.signInEmail({ body: { email: "pat@example.com", password: "old-password-123" } });
    expect(await db.session.count({ where: { userId: user.id } })).toBe(1);
    await auth.api.requestPasswordReset({ body: { email: "pat@example.com" } });
    const { token } = await resetTokenFromEmail();
    await auth.api.resetPassword({ body: { token, newPassword: "new-password-456" } });
    expect(await db.session.count({ where: { userId: user.id } })).toBe(0);
  });

  it("gives the same answer for unknown emails and sends nothing", async () => {
    const res = await auth.api.requestPasswordReset({ body: { email: "nobody@example.com" } });
    expect(res.status).toBe(true);
    await new Promise((r) => setTimeout(r, 50));
    expect(sendEmail).not.toHaveBeenCalled();
  });
});
