import { db } from "@/lib/db";

/**
 * Failed-send monitoring. An hourly job (modules/reviews/jobs.ts) collects
 * recent failures and requests stuck in the queue, and emails the platform admin.
 */

export type FailureKind = "failed" | "stuck";
export type FailureRow = { clientName: string; kind: FailureKind; reason: string | null };

/** A queued request older than this has not been picked up by Inngest. */
export const STUCK_AFTER_MINUTES = 30;
/** Only report stuck requests from the last day, so old ones don't alert forever. */
const STUCK_MAX_AGE_HOURS = 24;
const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

export async function collectFailures(now = new Date(), windowMinutes = 65): Promise<FailureRow[]> {
  const failedSince = new Date(now.getTime() - windowMinutes * MINUTE);
  const stuckBefore = new Date(now.getTime() - STUCK_AFTER_MINUTES * MINUTE);
  const stuckAfter = new Date(now.getTime() - STUCK_MAX_AGE_HOURS * HOUR);

  const [failed, stuck] = await Promise.all([
    db.reviewRequest.findMany({
      where: { status: "FAILED", updatedAt: { gte: failedSince } },
      select: { failureReason: true, client: { select: { name: true } } },
      take: 500,
    }),
    db.reviewRequest.findMany({
      where: { status: "QUEUED", createdAt: { lte: stuckBefore, gte: stuckAfter } },
      select: { client: { select: { name: true } } },
      take: 500,
    }),
  ]);

  return [
    ...failed.map((r) => ({ clientName: r.client.name, kind: "failed" as const, reason: r.failureReason })),
    ...stuck.map((r) => ({ clientName: r.client.name, kind: "stuck" as const, reason: null })),
  ];
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Turn the rows into one email, or null when there is nothing to report. */
export function summariseFailures(rows: FailureRow[], dashboardUrl: string) {
  if (rows.length === 0) return null;

  const groups = new Map<string, { clientName: string; kind: FailureKind; reason: string; count: number }>();
  for (const r of rows) {
    const reason = r.kind === "stuck" ? "Waiting in the queue and not sent" : (r.reason ?? "No reason recorded").slice(0, 160);
    const key = `${r.clientName}\u0000${r.kind}\u0000${reason}`;
    const g = groups.get(key);
    if (g) g.count += 1;
    else groups.set(key, { clientName: r.clientName, kind: r.kind, reason, count: 1 });
  }
  const list = [...groups.values()].sort((a, b) => b.count - a.count);
  const failed = rows.filter((r) => r.kind === "failed").length;
  const stuck = rows.length - failed;

  const parts = [failed && `${failed} failed`, stuck && `${stuck} stuck in the queue`].filter(Boolean).join(", ");
  const subject = `Nostalgic Hub: ${parts}`;
  const lines = list.map((g) => `- ${g.clientName}: ${g.count} × ${g.reason}`);
  const text = [
    `Review requests needing attention (${parts}):`,
    "",
    ...lines,
    "",
    "Failed sends can usually be retried once the cause is fixed. Requests stuck in the queue usually mean Inngest is not receiving events or the app is not synced.",
    `Check: ${dashboardUrl}`,
  ].join("\n");
  const html = `<p>Review requests needing attention (<strong>${esc(parts)}</strong>):</p><ul>${list
    .map((g) => `<li><strong>${esc(g.clientName)}</strong>: ${g.count} &times; ${esc(g.reason)}</li>`)
    .join("")}</ul><p>Failed sends can usually be retried once the cause is fixed. Requests stuck in the queue usually mean Inngest is not receiving events or the app is not synced.</p><p><a href="${esc(dashboardUrl)}">Open the admin dashboard</a></p>`;

  return { subject, text, html, total: rows.length };
}
