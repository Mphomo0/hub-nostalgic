import type { Prisma } from "@/lib/generated/prisma/client";
import { REPEAT_CONTACT_DAYS } from "@/modules/reviews/config";

/**
 * Customers page: filters, per-customer status and CSV helpers.
 *
 * What we can know: whether a customer rated, and whether they tapped through
 * to the Google review page. We can't see whether they finished posting there,
 * so "Went to Google" is the closest signal of a review.
 */

export const CUSTOMER_FILTERS = ["all", "reviewed", "not-reviewed", "opted-out", "not-sent"] as const;
export type CustomerFilter = (typeof CUSTOMER_FILTERS)[number];

export const FILTER_LABELS: Record<CustomerFilter, string> = {
  all: "All",
  reviewed: "Went to Google",
  "not-reviewed": "Not reviewed yet",
  "opted-out": "Opted out",
  "not-sent": "Not sent",
};

export function parseFilter(value: unknown): CustomerFilter {
  return CUSTOMER_FILTERS.find((f) => f === value) ?? "all";
}

/** Prisma filter for a tab plus an optional name / phone / email search. */
export function customerWhere(filter: CustomerFilter, q?: string): Prisma.CustomerWhereInput {
  const sent = { sentAt: { not: null } } satisfies Prisma.ReviewRequestWhereInput;
  const google = { googleClickedAt: { not: null } } satisfies Prisma.ReviewRequestWhereInput;
  const and: Prisma.CustomerWhereInput[] = [];

  if (filter === "reviewed") and.push({ reviewRequests: { some: google } });
  if (filter === "not-reviewed") and.push({ optedOutAt: null, reviewRequests: { some: sent, none: google } });
  if (filter === "opted-out") and.push({ optedOutAt: { not: null } });
  if (filter === "not-sent") and.push({ optedOutAt: null, reviewRequests: { none: sent } });

  const term = q?.trim().slice(0, 80);
  if (term) {
    const digits = term.replace(/[^\d]/g, "");
    and.push({
      OR: [
        { name: { contains: term, mode: "insensitive" } },
        { email: { contains: term, mode: "insensitive" } },
        ...(digits.length >= 3 ? [{ phoneE164: { contains: digits } }] : []),
      ],
    });
  }
  return and.length ? { AND: and } : {};
}

export type RequestFacts = {
  createdAt: Date;
  sentAt: Date | null;
  ratedAt: Date | null;
  rating: number | null;
  googleClickedAt: Date | null;
  status: string;
};

export type CustomerState = "reviewed" | "rated" | "waiting" | "not-sent";

export type CustomerSummary = {
  state: CustomerState;
  optedOut: boolean;
  requests: number;
  rating: number | null;
  lastSentAt: Date | null;
  ratedAt: Date | null;
  googleAt: Date | null;
  /** The earliest date a new request is allowed (30-day rule), or null if it can be sent now. */
  nextEligibleAt: Date | null;
};

const DAY = 24 * 60 * 60 * 1000;

/** Roll a customer's requests up into one status line. */
export function summariseCustomer(customer: { optedOutAt: Date | null }, requests: RequestFacts[], now = new Date()): CustomerSummary {
  const latest = (dates: (Date | null)[]) => dates.filter((d): d is Date => !!d).sort((a, b) => b.getTime() - a.getTime())[0] ?? null;
  const googleAt = latest(requests.map((r) => r.googleClickedAt));
  const ratedAt = latest(requests.map((r) => r.ratedAt));
  const lastSentAt = latest(requests.map((r) => r.sentAt));
  const rated = requests.filter((r) => r.rating !== null && r.ratedAt).sort((a, b) => b.ratedAt!.getTime() - a.ratedAt!.getTime());

  const state: CustomerState = googleAt ? "reviewed" : rated.length ? "rated" : lastSentAt ? "waiting" : "not-sent";

  // Same rule as the send check: any request that isn't FAILED in the last 30 days.
  const lastContact = latest(requests.filter((r) => r.status !== "FAILED").map((r) => r.createdAt));
  const eligibleAt = lastContact ? new Date(lastContact.getTime() + REPEAT_CONTACT_DAYS * DAY) : null;

  return {
    state,
    optedOut: customer.optedOutAt !== null,
    requests: requests.length,
    rating: rated[0]?.rating ?? null,
    lastSentAt,
    ratedAt,
    googleAt,
    nextEligibleAt: eligibleAt && eligibleAt > now ? eligibleAt : null,
  };
}

export const STATE_LABELS: Record<CustomerState, string> = {
  reviewed: "Went to Google",
  rated: "Rated, not on Google",
  waiting: "Waiting for a reply",
  "not-sent": "Not sent",
};

/** "+27768310082" → "+27 76 831 0082" (keeps other numbers as they are). */
export function displayPhone(e164: string | null | undefined) {
  if (!e164) return "";
  const m = /^\+27(\d{2})(\d{3})(\d{4})$/.exec(e164);
  return m ? `+27 ${m[1]} ${m[2]} ${m[3]}` : e164;
}

/** One CSV cell: quoted, and neutralised if a spreadsheet would read it as a formula. */
export function csvCell(value: string | number | null | undefined) {
  let s = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(s) && !/^\+?[\d\s]+$/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

export function csvRow(cells: (string | number | null | undefined)[]) {
  return cells.map(csvCell).join(",");
}
