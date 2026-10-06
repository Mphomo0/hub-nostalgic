import { z } from "zod";
import { REPEAT_CONTACT_DAYS } from "@/modules/reviews/config";
import type { Channel } from "@/lib/generated/prisma/enums";
import { normalisePhone } from "@/lib/phone";

/**
 * Pure row validation shared by the server (authoritative) and the CSV preview
 * in the browser. No database access here.
 */

export const SKIP_REASONS = {
  CLIENT_PAUSED: "Account is paused, so sending is disabled",
  MODULE_OFF: "Reviews isn't switched on for this account",
  NO_CONSENT: "Consent box was not ticked",
  MISSING_NAME: "Name is missing",
  INVALID_PHONE: "Phone number isn't valid",
  INVALID_EMAIL: "Email address isn't valid",
  NO_CONTACT: "No phone number or email",
  DUPLICATE_IN_BATCH: "Same customer appears earlier in this upload",
  OPTED_OUT: "Customer has opted out",
  RECENTLY_CONTACTED: `Already contacted in the last ${REPEAT_CONTACT_DAYS} days`,
  MONTHLY_CAP: "Monthly sending limit reached",
} as const;

export type SkipReason = keyof typeof SKIP_REASONS;

export type IntakeRow = { name?: string | null; phone?: string | null; email?: string | null };

const emailSchema = z.email();

type NormalisedRow =
  | { ok: true; name: string; phoneE164: string | null; email: string | null }
  | { ok: false; reason: SkipReason };

/** Checks 3 and 4: pure validation, no database access. Exported for the CSV preview. */
export function normaliseRow(row: IntakeRow): NormalisedRow {
  const name = (row.name ?? "").trim().slice(0, 120);
  const rawPhone = (row.phone ?? "").trim();
  const rawEmail = (row.email ?? "").trim().toLowerCase();

  if (!name) return { ok: false, reason: "MISSING_NAME" };

  let phoneE164: string | null = null;
  if (rawPhone) {
    phoneE164 = normalisePhone(rawPhone);
    if (!phoneE164) return { ok: false, reason: "INVALID_PHONE" };
  }
  let email: string | null = null;
  if (rawEmail) {
    if (!emailSchema.safeParse(rawEmail).success || rawEmail.length > 254) return { ok: false, reason: "INVALID_EMAIL" };
    email = rawEmail;
  }
  if (!phoneE164 && !email) return { ok: false, reason: "NO_CONTACT" };
  return { ok: true, name, phoneE164, email };
}

/** Channel rule: WhatsApp if we have a phone number, otherwise email. */
export function chooseChannel(c: { phoneE164: string | null }): Channel {
  return c.phoneE164 ? "WHATSAPP" : "EMAIL";
}

