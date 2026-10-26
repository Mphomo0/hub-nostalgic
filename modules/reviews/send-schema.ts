import { z } from "zod";
import { normaliseRow, SKIP_REASONS } from "@/modules/reviews/lib/normalise";
import { consentCheckbox } from "@/modules/reviews/schemas";

/**
 * Kept apart from schemas.ts on purpose: normaliseRow pulls in the phone-number
 * metadata (large), which only the staff send form needs. Importing it from
 * schemas.ts would ship it to every page that uses any reviews schema, including
 * the public rating page.
 */

/** One customer, checked with the same rules the server uses (modules/reviews/lib/normalise.ts). */
export const manualSendSchema = z
  .object({
    name: z.string().max(120),
    phone: z.string().max(50),
    email: z.string().max(254),
    consent: consentCheckbox,
  })
  .superRefine((row, ctx) => {
    const n = normaliseRow(row);
    if (n.ok) return;
    const path = { MISSING_NAME: "name", INVALID_PHONE: "phone", INVALID_EMAIL: "email", NO_CONTACT: "phone" }[n.reason as string] ?? "name";
    ctx.addIssue({ code: "custom", path: [path], message: SKIP_REASONS[n.reason] });
  });
