"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { FormState } from "@/components/form-state";
import { db } from "@/lib/db";
import { createAndSendInvite, emailHasActiveLogin } from "@/lib/invites";
import { LogoError, processLogo } from "@/lib/logo";
import { normalisePhone } from "@/lib/phone";
import { requireAdmin } from "@/lib/session";
import { adminInviteSchema, clientModuleSchema, createClientSchema, deleteCustomerSchema, monthlyCapSchema, updateClientSchema } from "@/lib/schemas";
import { fieldErrors, fileFrom, formObject } from "@/lib/validation";

// Every action here starts with requireAdmin(): only platform admins get past it.


export async function createClientAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const parsed = createClientSchema.safeParse(formObject(formData));
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };
  const d = parsed.data;

  if (await emailHasActiveLogin(d.ownerEmail)) return { errors: { ownerEmail: "This email already has a login. Use a different email for the owner." } };

  let logo: Awaited<ReturnType<typeof processLogo>> | null = null;
  const logoFile = fileFrom(formData, "logo");
  if (logoFile) {
    try {
      logo = await processLogo(logoFile);
    } catch (err) {
      if (err instanceof LogoError) return { errors: { logo: err.message } };
      throw err;
    }
  }

  const client = await db.client.create({
    data: {
      name: d.name,
      brandColor: d.brandColor,
      status: d.status,
      contactEmail: d.contactEmail ?? d.ownerEmail,
      contactPhone: d.contactPhone ? (normalisePhone(d.contactPhone) ?? d.contactPhone) : null,
      logo: logo ? { create: logo } : undefined,
      modules: { create: d.modules.map((module) => ({ module })) },
      // Reviews module setup (the schema requires the Google link when Reviews is ticked).
      reviewSettings: d.modules.includes("reviews") && d.googleReviewUrl ? { create: { googleReviewUrl: d.googleReviewUrl } } : undefined,
    },
  });

  await createAndSendInvite({ clientId: client.id, email: d.ownerEmail, name: d.ownerName, role: "OWNER", invitedByUserId: admin.id });
  revalidatePath("/admin");
  redirect(`/admin/clients/${client.id}?created=1`);
}


export async function updateClientAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const parsed = updateClientSchema.safeParse(formObject(formData));
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };
  const d = parsed.data;

  const logoFile = fileFrom(formData, "logo");
  if (logoFile) {
    try {
      const logo = await processLogo(logoFile);
      await db.clientLogo.upsert({ where: { clientId: d.clientId }, create: { clientId: d.clientId, ...logo }, update: logo });
    } catch (err) {
      if (err instanceof LogoError) return { errors: { logo: err.message } };
      throw err;
    }
  }

  await db.client.update({
    where: { id: d.clientId },
    data: {
      name: d.name,
      brandColor: d.brandColor,
      monthlyCap: d.monthlyCap,
      contactEmail: d.contactEmail,
      contactPhone: d.contactPhone ? (normalisePhone(d.contactPhone) ?? d.contactPhone) : null,
    },
  });
  revalidatePath(`/admin/clients/${d.clientId}`);
  return { ok: true, message: "Saved." };
}

export async function setClientStatusAction(formData: FormData) {
  await requireAdmin();
  const { clientId, status } = z.object({ clientId: z.uuid(), status: z.enum(["ACTIVE", "PAUSED"]) }).parse(formObject(formData));
  await db.client.update({ where: { id: clientId }, data: { status } });
  revalidatePath(`/admin/clients/${clientId}`);
  revalidatePath("/admin");
}

/** Switch a module off for a client. Its data is kept, so switching it back on restores everything. */
export async function disableModuleAction(formData: FormData) {
  await requireAdmin();
  const { clientId, module } = clientModuleSchema.pick({ clientId: true, module: true }).parse(formObject(formData));
  await db.clientModule.deleteMany({ where: { clientId, module } });
  revalidatePath(`/admin/clients/${clientId}`);
}

export async function setMonthlyCapAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const parsed = monthlyCapSchema.safeParse(formObject(formData));
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };
  await db.client.update({ where: { id: parsed.data.clientId }, data: { monthlyCap: parsed.data.monthlyCap } });
  revalidatePath("/admin/usage");
  return { ok: true, message: "Saved" };
}


export async function adminInviteAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const parsed = adminInviteSchema.safeParse(formObject(formData));
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };
  if (await emailHasActiveLogin(parsed.data.email)) return { errors: { email: "This email already has a login." } };
  await createAndSendInvite({ ...parsed.data, invitedByUserId: admin.id });
  revalidatePath(`/admin/clients/${parsed.data.clientId}`);
  return { ok: true, message: `Invite sent to ${parsed.data.email}.` };
}


/**
 * POPIA: permanently delete a customer's data on request.
 * Deletes the customer plus their requests, feedback and message events (cascade).
 * Exception: if they opted out, we keep only their phone/email on a do-not-contact
 * record (POPIA allows keeping what's needed to honour an objection).
 * ConsentLog rows are kept: they record the client's consent confirmation, not the customer.
 */
export async function deleteCustomerDataAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const parsed = deleteCustomerSchema.safeParse(formObject(formData));
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };
  const { clientId, contact } = parsed.data;
  const email = contact.includes("@") ? contact.toLowerCase() : null;
  const phone = email ? null : normalisePhone(contact);
  if (!phone && !email) return { errors: { contact: "That doesn't look like an email or phone number." } };

  const where = { clientId, OR: [...(phone ? [{ phoneE164: phone }] : []), ...(email ? [{ email }] : [])] };
  const matches = await db.customer.findMany({ where, select: { id: true, optedOutAt: true } });
  if (matches.length === 0) return { message: "No customer with that email or phone for this client." };

  // Opted-out customers keep a bare suppression record (contact detail only, no name,
  // no history) so they can never be messaged again if re-uploaded.
  const suppressed = matches.filter((m) => m.optedOutAt).map((m) => m.id);
  const removable = matches.filter((m) => !m.optedOutAt).map((m) => m.id);
  await db.$transaction([
    db.reviewRequest.deleteMany({ where: { customerId: { in: suppressed } } }),
    db.customer.updateMany({ where: { id: { in: suppressed } }, data: { name: "(deleted on request)" } }),
    db.customer.deleteMany({ where: { id: { in: removable } } }),
  ]);
  revalidatePath(`/admin/clients/${clientId}`);
  return {
    ok: true,
    message:
      `Deleted data for ${matches.length} customer record(s), including review requests and feedback.` +
      (suppressed.length ? " Opted-out contacts are kept as a do-not-contact entry only." : ""),
  };
}
