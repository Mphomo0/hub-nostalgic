"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { FormState } from "@/components/form-state";
import { db } from "@/lib/db";
import { uuid } from "@/lib/schemas";
import { requireAdmin } from "@/lib/session";
import { fieldErrors, formObject } from "@/lib/validation";
import { deleteLocation, saveLocation } from "@/modules/reviews/lib/locations";
import { locationSchema, reviewSettingsSchema } from "@/modules/reviews/schemas";

const adminReviewSettingsSchema = reviewSettingsSchema.extend({ clientId: uuid, enable: z.enum(["1"]).optional() });
const adminLocationSchema = locationSchema.extend({ clientId: uuid, enable: z.enum(["1"]).optional() });

const enableReviews = (clientId: string) =>
  db.clientModule.upsert({ where: { clientId_module: { clientId, module: "reviews" } }, create: { clientId, module: "reviews" }, update: {} });

/**
 * Admin: save a client's Reviews settings. With enable=1 this also switches
 * the module on (Reviews can't be on without at least one branch).
 */
export async function saveReviewSettingsAdminAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const parsed = adminReviewSettingsSchema.safeParse(formObject(formData));
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };
  const { clientId, enable, ...settings } = parsed.data;

  if (enable && (await db.reviewLocation.count({ where: { clientId } })) === 0) return { ok: false, message: "Add a branch with its Google link first." };
  await db.reviewSettings.upsert({ where: { clientId }, create: { clientId, ...settings }, update: settings });
  if (enable) await enableReviews(clientId);
  revalidatePath(`/admin/clients/${clientId}`);
  return { ok: true, message: enable ? "Reviews switched on." : "Saved." };
}

/** Admin: add or update a branch. With enable=1 (first branch of a client with Reviews off) it also switches Reviews on. */
export async function saveLocationAdminAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const parsed = adminLocationSchema.safeParse(formObject(formData));
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };
  const { clientId, enable, id, ...rest } = parsed.data;

  const result = await saveLocation(clientId, { ...rest, id: id || undefined });
  if (result.ok && enable) {
    await db.reviewSettings.upsert({ where: { clientId }, create: { clientId }, update: {} });
    await enableReviews(clientId);
  }
  revalidatePath(`/admin/clients/${clientId}`);
  return result.ok && enable ? { ok: true, message: "Branch added and Reviews switched on." } : result;
}

export async function deleteLocationAdminAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const clientId = uuid.safeParse(formData.get("clientId"));
  const id = uuid.safeParse(formData.get("id"));
  if (!clientId.success || !id.success) return { ok: false, message: "That branch no longer exists." };
  const result = await deleteLocation(clientId.data, id.data);
  revalidatePath(`/admin/clients/${clientId.data}`);
  return result;
}
