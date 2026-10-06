"use server";
import { revalidatePath } from "next/cache";
import type { FormState } from "@/components/form-state";
import { LogoError, processLogo } from "@/lib/logo";
import { requireMember } from "@/lib/session";
import { businessProfileSchema } from "@/lib/schemas";
import { fieldErrors, fileFrom, formObject } from "@/lib/validation";

export async function updateSettingsAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { tdb } = await requireMember({ ownerOnly: true });
  const parsed = businessProfileSchema.safeParse(formObject(formData));
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  const logoFile = fileFrom(formData, "logo");
  if (logoFile) {
    try {
      const logo = await processLogo(logoFile);
      // tdb injects this client's id into both the lookup and the create.
      const existing = await tdb.clientLogo.findFirst({ select: { id: true } });
      if (existing) await tdb.clientLogo.update({ where: { id: existing.id }, data: logo });
      else await tdb.clientLogo.create({ data: logo as never });
    } catch (err) {
      if (err instanceof LogoError) return { errors: { logo: err.message } };
      throw err;
    }
  }

  const client = await tdb.client.findFirstOrThrow({ select: { id: true } });
  await tdb.client.update({
    where: { id: client.id },
    data: { name: parsed.data.name, brandColor: parsed.data.brandColor },
  });
  revalidatePath("/dashboard", "layout");
  return { ok: true, message: "Business profile saved." };
}

export async function removeLogoAction() {
  const { tdb } = await requireMember({ ownerOnly: true });
  await tdb.clientLogo.deleteMany({});
  revalidatePath("/dashboard/settings");
}
