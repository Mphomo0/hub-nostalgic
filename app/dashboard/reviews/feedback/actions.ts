"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireModule } from "@/lib/session";

export async function toggleHandledAction(formData: FormData) {
  const { tdb, user } = await requireModule("reviews");
  const { id, handled } = z.object({ id: z.uuid(), handled: z.enum(["1", "0"]) }).parse(Object.fromEntries(formData));
  // tdb scopes this to the user's client: other clients' feedback can't be touched.
  await tdb.feedback.updateMany({
    where: { id },
    data: handled === "1" ? { handledAt: new Date(), handledByUserId: user.id } : { handledAt: null, handledByUserId: null },
  });
  revalidatePath("/dashboard/reviews/feedback");
  revalidatePath("/dashboard", "layout");
}
