import { Resend } from "resend";
import { DeliveryError } from "@/lib/messaging/errors";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

// Errors where retrying the same email will never succeed.
const PERMANENT = new Set(["validation_error", "invalid_from_address", "invalid_parameter", "missing_required_field", "invalid_attachment", "security_error"]);

export type EmailInput = {
  to: string;
  subject: string;
  html: string;
  text: string;
  headers?: Record<string, string>;
  replyTo?: string;
  /** Prevents duplicate sends if a job is retried. */
  idempotencyKey?: string;
};

/**
 * Send an email through Resend.
 * Without RESEND_API_KEY (local dev) the email is printed to the console instead.
 */
export async function sendEmail(input: EmailInput): Promise<{ id: string }> {
  const from = process.env.EMAIL_FROM;
  if (!resend) {
    console.info(`\n[email:dev] To: ${input.to}\nSubject: ${input.subject}\n${input.text}\n`);
    return { id: `dev-${Date.now()}` };
  }
  if (!from) throw new DeliveryError("EMAIL_FROM is not configured", true);

  const { data, error } = await resend.emails.send(
    {
      from,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
      headers: input.headers,
      replyTo: input.replyTo,
    },
    input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : undefined,
  );
  if (error || !data) {
    throw new DeliveryError(`Resend: ${error?.message ?? "unknown error"}`, error ? PERMANENT.has(error.name) : false, error);
  }
  return { id: data.id };
}
