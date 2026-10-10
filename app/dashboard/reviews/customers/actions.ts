"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { requireModule } from "@/lib/session";
import { processIntake } from "@/modules/reviews/lib/intake";
import { enqueueSends } from "@/modules/reviews/lib/queue";

const BASE = "/dashboard/reviews/customers";

/**
 * Send a review request to one saved customer. The same checks as the Send page
 * apply (opt-out, 30 days, monthly cap, paused account), and the consent box is
 * required again. redirect() ends the action, so it's only called outside try/catch.
 */
export async function sendToCustomerAction(formData: FormData) {
  const { clientId, user, tdb } = await requireModule("reviews");

  if (!(await rateLimit("send", user.id))) redirect(`${BASE}?error=rate`);
  if (formData.get("consent") !== "on") redirect(`${BASE}?error=consent`);

  const id = String(formData.get("customerId") ?? "");
  const customer = /^[0-9a-f-]{36}$/i.test(id)
    ? await tdb.customer.findFirst({ where: { id }, select: { name: true, phoneE164: true, email: true } })
    : null;
  if (!customer) redirect(`${BASE}?error=missing`);

  const result = await processIntake({
    clientId,
    userId: user.id,
    consent: true,
    ip: await clientIp(),
    batchLabel: "Customers page",
    rows: [{ name: customer.name, phone: customer.phoneE164, email: customer.email }],
  });

  let outcome = `sent=1`;
  if (result.queued.length === 0) {
    outcome = `skipped=${result.skipped[0]?.reason ?? "unknown"}`;
  } else {
    try {
      await enqueueSends(result.queued.map((q) => q.requestId));
    } catch (err) {
      console.error("enqueue failed", err);
      await tdb.reviewRequest.updateMany({
        where: { id: { in: result.queued.map((q) => q.requestId) }, status: "QUEUED" },
        data: { status: "FAILED", failureReason: "Could not be added to the send queue" },
      });
      outcome = "error=queue";
    }
  }

  revalidatePath("/dashboard", "layout");
  revalidatePath("/dashboard/reviews/requests");
  redirect(`${BASE}?${outcome}`);
}
