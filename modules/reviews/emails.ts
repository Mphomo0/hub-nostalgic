import { COMPANY_NAME } from "@/lib/config";
import { emailButton, emailLayout, esc, type Brand } from "@/lib/messaging/email-layout";

/** Review request / reminder email, branded with the client's logo and colour. */
export function reviewRequestEmail(opts: {
  brand: Brand;
  customerName: string;
  ratingUrl: string;
  unsubscribeUrl: string;
  isReminder: boolean;
}) {
  const { brand, customerName, ratingUrl, unsubscribeUrl, isReminder } = opts;
  const firstName = customerName.split(" ")[0] || customerName;
  const subject = isReminder
    ? `Quick reminder: how was your experience with ${brand.name}?`
    : `How was your experience with ${brand.name}?`;
  const intro = isReminder
    ? `Just a gentle reminder from ${brand.name}. If you have a moment, we'd really value your rating.`
    : `Thank you for choosing ${brand.name}. We'd love to hear how we did. It takes about 30 seconds.`;

  const html = emailLayout(
    brand,
    `<p>Hi ${esc(firstName)},</p><p>${esc(intro)}</p>${emailButton(ratingUrl, "Rate your experience", brand.brandColor)}<p style="font-size:14px;color:#6b6b66">Or copy this link: <br><a href="${esc(ratingUrl)}" style="color:#6b6b66;word-break:break-all">${esc(ratingUrl)}</a></p>`,
    `You're receiving this because you recently did business with ${esc(brand.name)}. <a href="${esc(unsubscribeUrl)}" style="color:#6b6b66">Unsubscribe</a> and we won't contact you again.<br>Sent on behalf of ${esc(brand.name)} by ${esc(COMPANY_NAME)}.`,
  );
  const text = `Hi ${firstName},\n\n${intro}\n\nRate your experience: ${ratingUrl}\n\nDon't want these messages? Unsubscribe: ${unsubscribeUrl}\n\nSent on behalf of ${brand.name} by ${COMPANY_NAME}.`;
  return { subject, html, text };
}

