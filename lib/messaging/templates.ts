import { appUrl, COMPANY_NAME, PLATFORM_NAME } from "@/lib/config";
import { emailButton, emailLayout, esc, type Brand } from "@/lib/messaging/email-layout";

// Platform emails: invites, password resets, website enquiries.

export function inviteEmail(opts: { inviteeName: string; clientName: string; role: "OWNER" | "STAFF"; inviteUrl: string; expiresDays: number }) {
  const brand: Brand = { name: PLATFORM_NAME, brandColor: "#1b7a1b", logoUrl: appUrl("/logo.png") };
  const what = opts.role === "OWNER" ? `your ${PLATFORM_NAME} dashboard for ${opts.clientName} is ready` : `you've been invited to join ${opts.clientName} on ${PLATFORM_NAME}`;
  const subject = opts.role === "OWNER" ? `Your ${PLATFORM_NAME} account for ${opts.clientName}` : `Join ${opts.clientName} on ${PLATFORM_NAME}`;
  const html = emailLayout(
    brand,
    `<p>Hi ${esc(opts.inviteeName)},</p><p>Good news: ${esc(what)}. Set your password to get started.</p>${emailButton(opts.inviteUrl, "Set your password", brand.brandColor)}<p style="font-size:14px;color:#6b6b66">This link expires in ${opts.expiresDays} days. If you weren't expecting it, you can ignore this email.</p>`,
    `${esc(PLATFORM_NAME)} by ${esc(COMPANY_NAME)}`,
  );
  const text = `Hi ${opts.inviteeName},\n\nGood news: ${what}. Set your password here (expires in ${opts.expiresDays} days):\n${opts.inviteUrl}\n\n${PLATFORM_NAME} by ${COMPANY_NAME}`;
  return { subject, html, text };
}

export function passwordResetEmail(opts: { name: string; resetUrl: string; expiresMinutes: number }) {
  const brand: Brand = { name: PLATFORM_NAME, brandColor: "#1b7a1b", logoUrl: appUrl("/logo.png") };
  const subject = `Reset your ${PLATFORM_NAME} password`;
  const html = emailLayout(
    brand,
    `<p>Hi ${esc(opts.name)},</p><p>We got a request to reset your password. Click the button below to choose a new one.</p>${emailButton(opts.resetUrl, "Choose a new password", brand.brandColor)}<p style="font-size:14px;color:#6b6b66">This link works once and expires in ${opts.expiresMinutes} minutes. If you didn't ask for this, you can ignore this email; your password won't change.</p>`,
    `${esc(PLATFORM_NAME)} by ${esc(COMPANY_NAME)}`,
  );
  const text = `Hi ${opts.name},\n\nWe got a request to reset your password. Choose a new one here (works once, expires in ${opts.expiresMinutes} minutes):\n${opts.resetUrl}\n\nIf you didn't ask for this, you can ignore this email.\n\n${PLATFORM_NAME} by ${COMPANY_NAME}`;
  return { subject, html, text };
}

export function enquiryEmail(e: { name: string; business?: string | null; email: string; phone?: string | null; message: string }) {
  const rows = [
    ["Name", e.name],
    ["Business", e.business ?? ""],
    ["Email", e.email],
    ["Phone", e.phone ?? ""],
  ];
  const html = `<h2>New enquiry from the website</h2><table>${rows.map(([k, v]) => `<tr><td><b>${k}</b></td><td>${esc(v)}</td></tr>`).join("")}</table><p style="white-space:pre-wrap">${esc(e.message)}</p>`;
  const text = `New enquiry\n\n${rows.map(([k, v]) => `${k}: ${v}`).join("\n")}\n\n${e.message}`;
  return { subject: `New enquiry: ${e.business || e.name}`, html, text };
}

