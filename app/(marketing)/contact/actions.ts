"use server";
import type { FormState } from "@/components/form-state";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/messaging/email";
import { enquiryEmail } from "@/lib/messaging/templates";
import { rateLimitByIp } from "@/lib/rate-limit";
import { enquirySchema } from "@/lib/schemas";
import { getModule } from "@/modules/catalog";
import { fieldErrors, formObject } from "@/lib/validation";

export async function enquiryAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = enquirySchema.safeParse(formObject(formData));
  if (!parsed.success) {
    const errs = fieldErrors(parsed.error);
    if (errs.website) return { ok: true, message: "Thanks! We'll be in touch soon." }; // honeypot: pretend success
    return { errors: errs };
  }
  const d = parsed.data;
  if (Date.now() - d.startedAt < 3000) return { ok: true, message: "Thanks! We'll be in touch soon." }; // too fast to be human
  if (!(await rateLimitByIp("publicForm", "enquiry"))) return { message: "Too many messages. Please try again later or email us directly." };

  const interested = (d.products ?? []).map((k) => getModule(k)?.name ?? k);
  const message = interested.length ? `Interested in: ${interested.join(", ")}\n\n${d.message}` : d.message;
  const enquiry = { name: d.name, business: d.business || null, email: d.email, phone: d.phone || null, message };
  await db.enquiry.create({ data: enquiry });
  const to = process.env.ENQUIRY_TO_EMAIL || process.env.ADMIN_EMAIL;
  if (to) {
    try {
      await sendEmail({ to, replyTo: d.email, ...enquiryEmail(enquiry) });
    } catch (err) {
      // The enquiry is saved in the database either way.
      console.error("enquiry email failed", err);
    }
  }
  return { ok: true, message: "Thanks! We've got your message and will be in touch within one working day." };
}
