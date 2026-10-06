"use server";
import { revalidatePath } from "next/cache";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { processIntake, SKIP_REASONS, type SkipReason } from "@/modules/reviews/lib/intake";
import { enqueueSends } from "@/modules/reviews/lib/queue";
import { sendRequestsSchema } from "@/modules/reviews/schemas";
import { requireModule } from "@/lib/session";

export type SendSummary = {
  ok: boolean;
  error?: string;
  queued: number;
  skipped: { rowIndex: number; name: string; reason: string }[];
  failed: number;
};

/**
 * Validate and queue review requests. The clientId comes from the session,
 * never from the browser. All rules are enforced again here on the server.
 */
export async function sendRequestsAction(input: unknown): Promise<SendSummary> {
  const { clientId, user, tdb } = await requireModule("reviews");
  const empty = { queued: 0, skipped: [], failed: 0 };

  if (!(await rateLimit("send", user.id))) return { ok: false, error: "You're sending too quickly. Please wait a minute.", ...empty };

  const parsed = sendRequestsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input", ...empty };
  const { rows, source, fileName } = parsed.data;

  const label = source === "csv" ? `CSV upload${fileName ? `: ${fileName}` : ""} (${rows.length} rows)` : "Manual send";
  const result = await processIntake({ clientId, userId: user.id, consent: true, ip: await clientIp(), batchLabel: label, rows });

  let failed = 0;
  try {
    await enqueueSends(result.queued.map((q) => q.requestId));
  } catch (err) {
    console.error("enqueue failed", err);
    failed = result.queued.length;
    await tdb.reviewRequest.updateMany({
      where: { id: { in: result.queued.map((q) => q.requestId) }, status: "QUEUED" },
      data: { status: "FAILED", failureReason: "Could not be added to the send queue" },
    });
  }

  revalidatePath("/dashboard", "layout");
  revalidatePath("/dashboard/reviews/requests");
  return {
    ok: true,
    queued: result.queued.length - failed,
    failed,
    skipped: result.skipped.map((s) => ({ ...s, reason: SKIP_REASONS[s.reason as SkipReason] })),
  };
}
