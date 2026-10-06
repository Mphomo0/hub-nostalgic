import { auth } from "@/lib/auth";
import { appUrl, INVITE_TTL_DAYS } from "@/lib/config";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/messaging/email";
import { inviteEmail } from "@/lib/messaging/templates";
import type { MemberRole } from "@/lib/generated/prisma/client";
import { newToken, sha256 } from "@/lib/tokens";

/**
 * Create an invite and email the link. Only a hash of the token is stored,
 * so a database leak can't be used to accept invites.
 * Any previous unaccepted invites for the same email + client are revoked.
 */
export async function createAndSendInvite(opts: {
  clientId: string;
  email: string;
  name: string;
  role: MemberRole;
  invitedByUserId: string | null;
}) {
  const email = opts.email.trim().toLowerCase();
  const client = await db.client.findUniqueOrThrow({ where: { id: opts.clientId }, select: { name: true } });

  const token = newToken();
  await db.$transaction([
    db.invite.deleteMany({ where: { clientId: opts.clientId, email, acceptedAt: null } }),
    db.invite.create({
      data: {
        clientId: opts.clientId,
        email,
        name: opts.name.trim(),
        role: opts.role,
        tokenHash: sha256(token),
        expiresAt: new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000),
        invitedByUserId: opts.invitedByUserId,
      },
    }),
  ]);

  const inviteUrl = appUrl(`/invite/${token}`);
  const mail = inviteEmail({ inviteeName: opts.name, clientName: client.name, role: opts.role, inviteUrl, expiresDays: INVITE_TTL_DAYS });
  await sendEmail({ to: email, ...mail });
  return { inviteUrl };
}

/** Look up a usable invite by its raw token (from the URL). */
export async function findValidInvite(token: string) {
  if (!token || token.length < 20) return null;
  const invite = await db.invite.findUnique({
    where: { tokenHash: sha256(token) },
    include: { client: { select: { name: true } } },
  });
  if (!invite || invite.acceptedAt || invite.expiresAt < new Date()) return null;
  return invite;
}

export class InviteError extends Error {}

/**
 * Accept an invite: create the login with the chosen password and the
 * membership in one go. The caller then signs the user in.
 */
export async function acceptInvite(token: string, password: string) {
  const invite = await findValidInvite(token);
  if (!invite) throw new InviteError("This invite link is invalid or has expired. Ask for a new one.");

  // A login that was removed from its team (no membership) can be re-invited.
  const existing = await db.user.findUnique({ where: { email: invite.email }, include: { memberships: true } });
  if (existing && (existing.isPlatformAdmin || existing.memberships.length > 0)) {
    throw new InviteError("An account with this email already exists. Please log in instead, or contact support.");
  }

  const ctx = await auth.$context;
  if (password.length < ctx.password.config.minPasswordLength) {
    throw new InviteError(`Password must be at least ${ctx.password.config.minPasswordLength} characters.`);
  }
  const hash = await ctx.password.hash(password);

  await db.$transaction(async (tx) => {
    // Claim the invite first so the same link can't be used twice concurrently.
    const claimed = await tx.invite.updateMany({ where: { id: invite.id, acceptedAt: null }, data: { acceptedAt: new Date() } });
    if (claimed.count !== 1) throw new InviteError("This invite has already been used.");
    let userId: string;
    if (existing) {
      userId = existing.id;
      await tx.user.update({ where: { id: userId }, data: { name: invite.name } });
      await tx.account.deleteMany({ where: { userId, providerId: "credential" } });
    } else {
      userId = (await tx.user.create({ data: { email: invite.email, name: invite.name, emailVerified: true } })).id;
    }
    // Better Auth stores email/password credentials in the account table.
    await tx.account.create({ data: { userId, accountId: userId, providerId: "credential", password: hash } });
    await tx.membership.create({ data: { userId, clientId: invite.clientId, role: invite.role } });
  });

  return { email: invite.email };
}

/** True if this email belongs to an admin or a login that's still on a team. */
export async function emailHasActiveLogin(email: string) {
  const user = await db.user.findUnique({ where: { email: email.trim().toLowerCase() }, include: { memberships: { select: { id: true } } } });
  return Boolean(user && (user.isPlatformAdmin || user.memberships.length > 0));
}
