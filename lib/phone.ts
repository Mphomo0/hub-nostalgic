import { parsePhoneNumberFromString } from "libphonenumber-js/max";

/**
 * Normalise a phone number to E.164 (e.g. "+27821234567").
 * Numbers without a country code are treated as South African.
 * Returns null if the number is not a valid mobile/fixed number.
 */
export function normalisePhone(input: string | null | undefined): string | null {
  const raw = (input ?? "").trim();
  if (!raw) return null;
  // "0027..." is a common way of writing +27
  const cleaned = raw.replace(/^00/, "+");
  const parsed = parsePhoneNumberFromString(cleaned, "ZA");
  if (!parsed || !parsed.isValid()) return null;
  return parsed.number;
}
