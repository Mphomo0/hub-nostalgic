import { z } from "zod";
import { checkbox, googleReviewUrl } from "@/lib/schemas";
import { CSV_MAX_ROWS } from "@/modules/reviews/config";
import { normaliseRow, SKIP_REASONS } from "@/modules/reviews/lib/normalise";

/** Reviews module form schemas (browser + server actions). */

/** Reviews settings: reminders. Used by the client and by admin. */
export const reviewSettingsSchema = z.object({
  remindersEnabled: checkbox,
});

/** One branch / Google Business Profile. `id` is present when editing. */
export const locationSchema = z.object({
  id: z.string().uuid().optional().or(z.literal("")),
  name: z.string().trim().min(1, "Enter the branch name").max(120, "Keep it under 120 characters"),
  googleReviewUrl,
});

/** Consent tick box in the forms (a boolean that must be true). */
const consentCheckbox = z.boolean().refine((v) => v, "Please tick the consent box");
/** Consent as received by the server action. */
const consent = z.literal(true, "Please tick the consent box");

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

export const csvSendFormSchema = z.object({
  file: z
    .custom<FileList | undefined>()
    .refine((files) => Boolean(files?.[0]), "Choose a CSV file")
    .refine((files) => !files?.[0] || files[0].size <= 2 * 1024 * 1024, "That file is too big. Max 2 MB."),
  consent: consentCheckbox,
});

/** What the send server action accepts (manual and CSV). */
export const sendRequestsSchema = z.object({
  rows: z
    .array(z.object({ name: z.string().max(200).optional().nullable(), phone: z.string().max(50).optional().nullable(), email: z.string().max(320).optional().nullable() }))
    .min(1, "Add at least one customer")
    .max(CSV_MAX_ROWS, `Max ${CSV_MAX_ROWS} rows per upload`),
  consent,
  /** Which branch's Google profile to send customers to. Optional only when the client has one. */
  locationId: z.string().uuid().optional(),
  source: z.enum(["manual", "csv"]),
  fileName: z.string().max(200).optional(),
});


// ── Public rating page ──

const publicToken = z.string().min(20).max(100);

export const ratingSchema = z.object({ token: publicToken, rating: z.coerce.number().int().min(1, "Choose 1 to 5 stars").max(5) });

export const feedbackSchema = z.object({
  token: publicToken,
  message: z.string().trim().min(1, "Please write a message").max(2000, "Please keep it under 2000 characters"),
});

