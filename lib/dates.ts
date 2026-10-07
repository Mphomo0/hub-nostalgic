import { TIMEZONE } from "@/lib/config";

/** "YYYY-MM" for the given date in the business timezone. */
export function monthKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: TIMEZONE, year: "numeric", month: "2-digit" }).formatToParts(date);
  const y = parts.find((p) => p.type === "year")!.value;
  const m = parts.find((p) => p.type === "month")!.value;
  return `${y}-${m}`;
}

export function daysAgo(days: number, from = new Date()) {
  return new Date(from.getTime() - days * 24 * 60 * 60 * 1000);
}

export function formatDateTime(date: Date | null | undefined) {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-ZA", { timeZone: TIMEZONE, dateStyle: "medium", timeStyle: "short" }).format(date);
}

export function formatDate(date: Date | null | undefined) {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-ZA", { timeZone: TIMEZONE, dateStyle: "medium" }).format(date);
}

/** "October 2026" for a "YYYY-MM" key. */
export function formatMonth(key: string) {
  return new Intl.DateTimeFormat("en-ZA", { timeZone: "UTC", month: "long", year: "numeric" }).format(new Date(`${key}-15T12:00:00Z`));
}

export function formatNumber(n: number) {
  return new Intl.NumberFormat("en-ZA").format(n);
}
