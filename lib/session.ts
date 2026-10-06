import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getEnabledModules } from "@/lib/modules";
import { tenantDb } from "@/lib/tenant";
import type { ModuleKey } from "@/modules/catalog";

/** Current Better Auth session (or null). Cached per request. */
export const getSession = cache(async () => {
  return auth.api.getSession({ headers: await headers() });
});

/** Logged-in user or redirect to /login. */
export async function requireUser() {
  const session = await getSession();
  if (!session) redirect("/login");
  return session.user;
}

/** Platform admin (Nostalgic Studio) or 404-style redirect. */
export async function requireAdmin() {
  const user = await requireUser();
  const fresh = await db.user.findUnique({ where: { id: user.id }, select: { isPlatformAdmin: true } });
  if (!fresh?.isPlatformAdmin) redirect("/dashboard");
  return user;
}

/** The user's client membership, looked up on the server from the session. */
export const getMembership = cache(async (userId: string) => {
  return db.membership.findUnique({
    where: { userId },
    include: {
      client: {
        select: { id: true, name: true, status: true, brandColor: true, monthlyCap: true, logo: { select: { updatedAt: true } } },
      },
    },
  });
});

/**
 * Use at the top of every dashboard page and server action.
 * Returns the user, their membership/client, and a tenant-scoped db.
 * The clientId comes only from the session, never from the request.
 */
export async function requireMember(opts: { ownerOnly?: boolean } = {}) {
  const user = await requireUser();
  const membership = await getMembership(user.id);
  if (!membership) {
    const fresh = await db.user.findUnique({ where: { id: user.id }, select: { isPlatformAdmin: true } });
    redirect(fresh?.isPlatformAdmin ? "/admin" : "/login?error=no-client");
  }
  if (opts.ownerOnly && membership.role !== "OWNER") redirect("/dashboard");
  return {
    user,
    membership,
    client: membership.client,
    clientId: membership.clientId,
    isOwner: membership.role === "OWNER",
    tdb: tenantDb(membership.clientId),
  };
}

export type MemberContext = Awaited<ReturnType<typeof requireMember>>;

/**
 * Use at the top of every page and server action that belongs to a module.
 * Same as requireMember, plus the client must have that module switched on.
 */
export async function requireModule(key: ModuleKey, opts: { ownerOnly?: boolean } = {}) {
  const ctx = await requireMember(opts);
  const modules = await getEnabledModules(ctx.clientId);
  if (!modules.includes(key)) redirect("/dashboard?module-off=" + key);
  return { ...ctx, modules };
}
