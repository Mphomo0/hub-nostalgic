/**
 * Rough estimate of Inngest usage this month, from the messages we've sent.
 * It is a guide for an early warning, not Inngest's own count: the real numbers
 * are in the Inngest dashboard (Usage). Retries and failures add to the real figure.
 */

/** A send is one run plus about one step, and a WhatsApp fallback adds more. */
export const EXECUTIONS_PER_MESSAGE = 3;
/** Daily reminder cron (about 2 executions a day) plus the monthly retention run. */
export const BASELINE_EXECUTIONS = 65;

const DEFAULT_MONTHLY_EXECUTIONS = 50_000;

/** Set INNGEST_MONTHLY_EXECUTIONS to your plan's executions limit (see the Inngest dashboard). */
export function inngestMonthlyLimit() {
  const n = Number(process.env.INNGEST_MONTHLY_EXECUTIONS);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_MONTHLY_EXECUTIONS;
}

export type UsageLevel = "ok" | "warning" | "critical";

export function inngestUsageEstimate(messages: number, limit = inngestMonthlyLimit()) {
  const used = messages * EXECUTIONS_PER_MESSAGE + BASELINE_EXECUTIONS;
  const ratio = used / limit;
  const level: UsageLevel = ratio >= 0.9 ? "critical" : ratio >= 0.7 ? "warning" : "ok";
  return { used, limit, percent: Math.min(100, Math.round(ratio * 100)), level };
}
