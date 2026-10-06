"use server";
import { revalidatePath } from "next/cache";
import type { FormState } from "@/components/form-state";
import { db } from "@/lib/db";
import { requireModule } from "@/lib/session";
import { fieldErrors, formObject } from "@/lib/validation";
import { reviewSettingsSchema } from "@/modules/reviews/schemas";

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
