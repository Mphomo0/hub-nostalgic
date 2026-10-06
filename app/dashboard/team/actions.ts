"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { FormState } from "@/components/form-state";
import { db } from "@/lib/db";
import { createAndSendInvite, emailHasActiveLogin } from "@/lib/invites";
import { rateLimit } from "@/lib/rate-limit";
import { requireMember } from "@/lib/session";
import { inviteSchema } from "@/lib/schemas";
import { fieldErrors, formObject } from "@/lib/validation";

/** Owner invites a staff member (role is always STAFF from here). */
export async function inviteStaffAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { clientId, user } = await requireMember({ ownerOnly: true });
  if (!(await rateLimit("invite", user.id))) return { message: "Too many invites. Please try again later." };
  const parsed = inviteSchema.safeParse(formObject(formData));
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };
  if (await emailHasActiveLogin(parsed.data.email)) return { errors: { email: "This email already has a login." } };

  await createAndSendInvite({ clientId, email: parsed.data.email, name: parsed.data.name, role: "STAFF", invitedByUserId: user.id });
  revalidatePath("/dashboard/team");
  return { ok: true, message: `Invite sent to ${parsed.data.email}.` };
}

/** Owner removes a staff member: their membership and sessions are deleted. */
export async function removeStaffAction(formData: FormData) {
  const { tdb } = await requireMember({ ownerOnly: true });
  const { membershipId } = z.object({ membershipId: z.uuid() }).parse(Object.fromEntries(formData));
  // tdb guarantees the membership belongs to this client; owners can't be removed here.
  const membership = await tdb.membership.findFirst({ where: { id: membershipId, role: "STAFF" } });
  if (!membership) return;
  await db.$transaction([
    db.membership.delete({ where: { id: membership.id } }),
    db.session.deleteMany({ where: { userId: membership.userId } }),
  ]);
  revalidatePath("/dashboard/team");
}

export async function revokeInviteAction(formData: FormData) {
  const { tdb } = await requireMember({ ownerOnly: true });
  const { inviteId } = z.object({ inviteId: z.uuid() }).parse(Object.fromEntries(formData));
  await tdb.invite.deleteMany({ where: { id: inviteId, acceptedAt: null } });
  revalidatePath("/dashboard/team");
}
