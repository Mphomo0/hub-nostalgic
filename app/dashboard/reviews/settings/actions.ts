"use server";
import { revalidatePath } from "next/cache";
import type { FormState } from "@/components/form-state";
import { db } from "@/lib/db";
import { requireModule } from "@/lib/session";
import { fieldErrors, formObject } from "@/lib/validation";
import { deleteLocation, saveLocation } from "@/modules/reviews/lib/locations";
import { locationSchema, reviewSettingsSchema } from "@/modules/reviews/schemas";

export async function updateReviewSettingsAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { clientId } = await requireModule("reviews", { ownerOnly: true });
  const parsed = reviewSettingsSchema.safeParse(formObject(formData));
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };
  // clientId comes from the session; one settings row per client.
  await db.reviewSettings.upsert({
    where: { clientId },
    create: { clientId, ...parsed.data },
    update: parsed.data,
  });
  revalidatePath("/dashboard/reviews/settings");
  return { ok: true, message: "Reviews settings saved." };
}

/** Add or update a branch. The clientId comes from the session. */
export async function saveLocationAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { clientId } = await requireModule("reviews", { ownerOnly: true });
  const parsed = locationSchema.safeParse(formObject(formData));
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };
  const result = await saveLocation(clientId, { ...parsed.data, id: parsed.data.id || undefined });
  revalidatePath("/dashboard/reviews", "layout");
  return result;
}

export async function deleteLocationAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { clientId } = await requireModule("reviews", { ownerOnly: true });
  const id = String(formData.get("id") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { ok: false, message: "That branch no longer exists." };
  const result = await deleteLocation(clientId, id);
  revalidatePath("/dashboard/reviews", "layout");
  return result;
}
