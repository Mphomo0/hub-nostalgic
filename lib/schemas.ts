import { z } from "zod";
import { LOGO_MAX_UPLOAD_BYTES } from "@/lib/config";
import { isModuleKey } from "@/modules/catalog";

/**
 * Platform form schemas, shared by the browser (react-hook-form + zodResolver)
 * and the server actions (which always re-validate). Module schemas live in
 * modules/<module>/schemas.ts and reuse the building blocks exported here. Keep this file free of server-only
 * imports so client components can use it.
 *
 * Values arrive either from react-hook-form (strings / booleans) or from
 * FormData (strings, "on" for ticked checkboxes), so the helpers below accept both.
 */

// ── Building blocks ─────────────────────────────────────────────

export const email = (message = "Enter a valid email") => z.string().trim().toLowerCase().max(254).pipe(z.email(message));

export const hexColor = z
  .string()
  .trim()
  .regex(/^#[0-9a-fA-F]{6}$/, "Use a colour like #1f6f5c");

export const googleReviewUrl = z
  .string()
  .trim()
  .min(1, "Paste your Google review link")
  .max(500)
  .pipe(z.url({ protocol: /^https$/, message: "Paste the full https:// link from Google" }));

/** Optional text: "" becomes null. */
export const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Keep it under ${max} characters`)
    .optional()
    .transform((v) => (v ? v : null));

export const optionalEmail = z
  .string()
  .trim()
  .toLowerCase()
  .optional()
  .transform((v) => (v ? v : null))
  .pipe(z.email("Enter a valid email").nullable());

/** Checkbox: true from react-hook-form, "on" from FormData, missing = false. */
export const checkbox = z.preprocess((v) => v === true || v === "on" || v === "true", z.boolean());

/** Number input that may be left blank (blank = null). */
export const optionalWholeNumber = z
  .string()
  .trim()
  .regex(/^\d*$/, "Use a whole number, or leave blank")
  .transform((v) => (v === "" ? null : Number(v)))
  .pipe(z.number().int().max(1_000_000, "That's too high").nullable());

export const uuid = z.uuid();

/** Optional logo file (browser only; the server checks the bytes again in lib/logo.ts). */
export const logoFileList = z
  .custom<FileList | undefined>()
  .optional()
  .refine((files) => !files?.[0] || ["image/png", "image/jpeg", "image/webp"].includes(files[0].type), "Logo must be a PNG, JPG or WebP image")
  .refine((files) => !files?.[0] || files[0].size <= LOGO_MAX_UPLOAD_BYTES, "Logo must be 500 KB or smaller");

// ── Auth ────────────────────────────────────────────────────────

export const loginSchema = z.object({
  email: email(),
  password: z.string().min(1, "Enter your password"),
});

export const acceptInviteSchema = z
  .object({
    token: z.string().min(20).max(100),
    password: z.string().min(10, "Use at least 10 characters").max(128, "That's too long"),
    confirm: z.string().min(1, "Type your password again"),
  })
  .refine((d) => d.password === d.confirm, { message: "Passwords don't match", path: ["confirm"] });

export const forgotPasswordSchema = z.object({ email: email() });

export const resetPasswordSchema = z
  .object({
    password: z.string().min(10, "Use at least 10 characters").max(128, "That's too long"),
    confirm: z.string().min(1, "Type your password again"),
  })
  .refine((d) => d.password === d.confirm, { message: "Passwords don't match", path: ["confirm"] });

// ── Admin ───────────────────────────────────────────────────────

/** Module checkboxes: an array from react-hook-form, a string or repeated keys from FormData. */
export const moduleKeys = z.preprocess(
  (v) => (v === undefined || v === false ? [] : Array.isArray(v) ? v : [v]),
  z.array(z.string().refine(isModuleKey, "Unknown module")),
);

const createClientBase = z.object({
  name: z.string().trim().min(2, "Enter the business name").max(120),
  modules: moduleKeys,
  /** Reviews module setup (required only when "reviews" is ticked). */
  googleReviewUrl: z.string().trim().optional(),
  ownerName: z.string().trim().min(1, "Enter the owner's name").max(120),
  ownerEmail: email(),
  brandColor: hexColor,
  status: z.enum(["ACTIVE", "PAUSED"]),
  contactEmail: optionalEmail,
  contactPhone: optionalText(40),
});

/** Module-specific required fields for the modules being switched on. */
function requireModuleSetup(d: { modules: string[]; googleReviewUrl?: string }, ctx: z.RefinementCtx) {
  if (d.modules.includes("reviews")) {
    const ok = googleReviewUrl.safeParse(d.googleReviewUrl ?? "");
    if (!ok.success) ctx.addIssue({ code: "custom", path: ["googleReviewUrl"], message: ok.error.issues[0].message });
  }
}

export const createClientSchema = createClientBase.superRefine(requireModuleSetup);
export const createClientFormSchema = createClientBase.extend({ logo: logoFileList }).superRefine(requireModuleSetup);

export const updateClientSchema = z.object({
  clientId: uuid,
  name: z.string().trim().min(2, "Enter the business name").max(120),
  brandColor: hexColor,
  monthlyCap: optionalWholeNumber,
  contactEmail: optionalEmail,
  contactPhone: optionalText(40),
});
export const updateClientFormSchema = updateClientSchema.extend({ logo: logoFileList });

/** Admin: switch a module on/off for a client. */
export const clientModuleSchema = z.object({ clientId: uuid, module: z.string().refine(isModuleKey, "Unknown module"), enabled: checkbox });

export const monthlyCapSchema = z.object({ clientId: uuid, monthlyCap: optionalWholeNumber });

export const inviteSchema = z.object({
  name: z.string().trim().min(1, "Enter a name").max(120),
  email: email(),
});

export const adminInviteSchema = inviteSchema.extend({ clientId: uuid, role: z.enum(["OWNER", "STAFF"]) });

export const deleteCustomerSchema = z.object({
  clientId: uuid,
  contact: z
    .string()
    .trim()
    .min(3, "Enter an email or phone number")
    .max(254)
    .refine((v) => v.includes("@") || /\d{6,}/.test(v.replace(/\D/g, "")), "That doesn't look like an email or phone number"),
});

// ── Dashboard ───────────────────────────────────────────────────

/** Business profile (shared by every module): name, brand colour, logo. */
export const businessProfileSchema = z.object({
  name: z.string().trim().min(2, "Enter your business name").max(120),
  brandColor: hexColor,
});
export const businessProfileFormSchema = businessProfileSchema.extend({ logo: logoFileList });

// ── Public ──────────────────────────────────────────────────────

export const enquirySchema = z.object({
  name: z.string().trim().min(1, "Please enter your name").max(120),
  business: z.string().trim().max(160).optional(),
  email: email("Please enter a valid email"),
  phone: z.string().trim().max(40).optional(),
  message: z.string().trim().min(5, "Tell us a little about your business").max(3000),
  /** Which tools they're interested in (module keys). */
  products: moduleKeys.optional(),
  // Spam protection: a hidden field bots fill in, and a minimum time on the page.
  website: z.string().max(0).optional(),
  startedAt: z.coerce.number(),
});
