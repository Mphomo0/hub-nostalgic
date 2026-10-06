"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { FormState } from "@/components/form-state";
import { db } from "@/lib/db";
import { uuid } from "@/lib/schemas";
import { requireAdmin } from "@/lib/session";
import { fieldErrors, formObject } from "@/lib/validation";
import { reviewSettingsSchema } from "@/modules/reviews/schemas";

const adminReviewSettingsSchema = reviewSettingsSchema.extend({ clientId: uuid, enable: z.enum(["1"]).optional() });

/**
 * Admin: save a client's Reviews settings. With enable=1 this also switches
 * the module on (Reviews can't be on without a Google link).
 */
export async function saveReviewSettingsAdminAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const parsed = adminReviewSettingsSchema.safeParse(formObject(formData));
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };
  const { clientId, enable, ...settings } = parsed.data;

  await db.$transaction([
    db.reviewSettings.upsert({ where: { clientId }, create: { clientId, ...settings }, update: settings }),
    ...(enable ? [db.clientModule.upsert({ where: { clientId_module: { clientId, module: "reviews" } }, create: { clientId, module: "reviews" }, update: {} })] : []),
  ]);
  revalidatePath(`/admin/clients/${clientId}`);
  return { ok: true, message: enable ? "Reviews switched on." : "Saved." };
}
