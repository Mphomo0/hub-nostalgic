"use server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { FormState } from "@/components/form-state";
import { auth } from "@/lib/auth";
import { acceptInvite, InviteError } from "@/lib/invites";
import { rateLimitByIp } from "@/lib/rate-limit";
import { acceptInviteSchema } from "@/lib/schemas";
import { fieldErrors, formObject } from "@/lib/validation";

export async function acceptInviteAction(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!(await rateLimitByIp("invite"))) return { message: "Too many attempts. Please try again in a few minutes." };

  const parsed = acceptInviteSchema.safeParse(formObject(formData));
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  try {
    const { email } = await acceptInvite(parsed.data.token, parsed.data.password);
    // Log them straight in (nextCookies plugin sets the session cookie).
    await auth.api.signInEmail({ body: { email, password: parsed.data.password }, headers: await headers() });
  } catch (err) {
    if (err instanceof InviteError) return { message: err.message };
    throw err;
  }
  redirect("/dashboard");
}
