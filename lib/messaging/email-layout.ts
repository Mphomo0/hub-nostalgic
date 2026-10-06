import { appUrl } from "@/lib/config";

/**
 * Shared HTML email building blocks (layout, button, escaping) used by the
 * platform's own emails and by every module's emails.
 */

/** Escape text for safe insertion into HTML. */
export function esc(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/** Only allow #rrggbb colours into templates. */
export function safeColor(color: string | null | undefined) {
  return color && /^#[0-9a-fA-F]{6}$/.test(color) ? color : "#1f6f5c";
}

export type Brand = { name: string; brandColor: string; logoUrl: string | null };

export function emailLayout(brand: Brand, body: string, footer: string) {
  const color = safeColor(brand.brandColor);
  const header = brand.logoUrl
    ? `<img src="${esc(brand.logoUrl)}" alt="${esc(brand.name)}" style="max-height:56px;max-width:200px;display:block;margin:0 auto" />`
    : `<div style="font-size:20px;font-weight:700;color:${color};text-align:center">${esc(brand.name)}</div>`;
  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f2;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1c1c1a">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f2;padding:24px 12px">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:12px;overflow:hidden">
<tr><td style="height:6px;background:${color}"></td></tr>
<tr><td style="padding:28px 28px 8px">${header}</td></tr>
<tr><td style="padding:8px 28px 28px;font-size:16px;line-height:1.55">${body}</td></tr>
</table>
<p style="max-width:520px;font-size:12px;line-height:1.5;color:#6b6b66;margin:16px auto 0;text-align:center">${footer}</p>
</td></tr></table></body></html>`;
}

export function emailButton(href: string, label: string, color: string) {
  return `<p style="text-align:center;margin:28px 0"><a href="${esc(href)}" style="background:${safeColor(color)};color:#ffffff;text-decoration:none;padding:14px 26px;border-radius:8px;font-weight:600;display:inline-block">${esc(label)}</a></p>`;
}

export function logoUrlFor(clientId: string, logoUpdatedAt: Date | null | undefined) {
  return logoUpdatedAt ? appUrl(`/api/logo/${clientId}?v=${logoUpdatedAt.getTime()}`) : null;
}
