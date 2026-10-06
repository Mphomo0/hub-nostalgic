import { CONSENT_VERSION } from "@/lib/config";
import { REPEAT_CONTACT_DAYS } from "@/modules/reviews/config";
import { reviewsModule } from "@/modules/reviews/module";
import { daysAgo } from "@/lib/dates";
import { db } from "@/lib/db";
import type { Channel, Prisma } from "@/lib/generated/prisma/client";
import { chooseChannel, normaliseRow, type IntakeRow, type SkipReason } from "@/modules/reviews/lib/normalise";
import { newToken } from "@/lib/tokens";
import { usedThisMonth } from "@/lib/messaging/usage";

/**
 * Customer intake and the sending rules from build plan section 6.2.
 *
 * Every row goes through these checks, in order. The first failing check is
 * recorded as the skip reason:
 *   1. Client status is ACTIVE                      → CLIENT_PAUSED
 *      and has the Reviews module switched on       → MODULE_OFF
 *   2. Consent box ticked                           → NO_CONSENT
 *   3. Phone normalises to E.164, email is valid    → INVALID_PHONE / INVALID_EMAIL
 *      (plus a name is required                     → MISSING_NAME)
 *   4. At least one of phone or email               → NO_CONTACT
 *   (same customer twice in one upload              → DUPLICATE_IN_BATCH)
 *   5. Customer has not opted out                   → OPTED_OUT
 *   6. Not contacted in the last 30 days            → RECENTLY_CONTACTED
 *   7. Client is within its monthly cap             → MONTHLY_CAP
 */

export { SKIP_REASONS, normaliseRow, chooseChannel, type SkipReason, type IntakeRow } from "@/modules/reviews/lib/normalise";

export type IntakeResult = {
  consentLogId: string | null;
  queued: { rowIndex: number; requestId: string; channel: Channel }[];
  skipped: { rowIndex: number; name: string; reason: SkipReason }[];
};

export async function processIntake(opts: {
  clientId: string;
  userId: string;
  consent: boolean;
  ip: string | null;
  batchLabel: string;
  rows: IntakeRow[];
  now?: Date;
}): Promise<IntakeResult> {
  const now = opts.now ?? new Date();
  const result: IntakeResult = { consentLogId: null, queued: [], skipped: [] };
  const skipAll = (reason: SkipReason) => {
    opts.rows.forEach((r, rowIndex) => result.skipped.push({ rowIndex, name: (r.name ?? "").trim(), reason }));
    return result;
  };

  // Check 1: client must be active.
  const client = await db.client.findUnique({
    where: { id: opts.clientId },
    select: { status: true, monthlyCap: true, modules: { where: { module: reviewsModule.key }, select: { id: true } } },
  });
  if (!client || client.status !== "ACTIVE") return skipAll("CLIENT_PAUSED");
  if (client.modules.length === 0) return skipAll("MODULE_OFF");

  // Check 2: consent must be confirmed for the batch.
  if (!opts.consent) return skipAll("NO_CONSENT");

  // One transaction per batch. The advisory lock serialises batches for the same
  // client so two people sending at once can't both pass the 30-day / cap checks.
  return db.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${opts.clientId}))`;

      const consent = await tx.consentLog.create({
        data: { clientId: opts.clientId, userId: opts.userId, batchLabel: opts.batchLabel.slice(0, 200), statementVersion: CONSENT_VERSION, ip: opts.ip },
      });
      result.consentLogId = consent.id;

      let used = await usedThisMonth(opts.clientId, now, tx);
      const seen = new Set<string>();
      const since = daysAgo(REPEAT_CONTACT_DAYS, now);

      for (const [rowIndex, row] of opts.rows.entries()) {
        const skip = (reason: SkipReason, name = (row.name ?? "").trim()) => result.skipped.push({ rowIndex, name, reason });

        // Checks 3 + 4
        const n = normaliseRow(row);
        if (!n.ok) {
          skip(n.reason);
          continue;
        }

        // Same person twice in one upload
        const keys = [n.phoneE164 && `p:${n.phoneE164}`, n.email && `e:${n.email}`].filter(Boolean) as string[];
        if (keys.some((k) => seen.has(k))) {
          skip("DUPLICATE_IN_BATCH", n.name);
          continue;
        }
        keys.forEach((k) => seen.add(k));

        // Find any existing customer records matching the phone or email.
        const or: Prisma.CustomerWhereInput[] = [];
        if (n.phoneE164) or.push({ phoneE164: n.phoneE164 });
        if (n.email) or.push({ email: n.email });
        const matches = await tx.customer.findMany({ where: { clientId: opts.clientId, OR: or } });

        // Check 5: opt-outs are permanent and win over everything.
        if (matches.some((m) => m.optedOutAt)) {
          skip("OPTED_OUT", n.name);
          continue;
        }

        // Check 6: no repeat contact within 30 days.
        if (matches.length) {
          const recent = await tx.reviewRequest.count({
            where: { clientId: opts.clientId, customerId: { in: matches.map((m) => m.id) }, createdAt: { gte: since }, status: { not: "FAILED" } },
          });
          if (recent > 0) {
            skip("RECENTLY_CONTACTED", n.name);
            continue;
          }
        }

        // Check 7: monthly cap (counts sent messages + requests still queued).
        if (client.monthlyCap !== null && used >= client.monthlyCap) {
          skip("MONTHLY_CAP", n.name);
          continue;
        }

        // All checks passed: create/update the customer and the request.
        const customer = await upsertCustomer(tx, opts.clientId, n, matches);
        const channel = chooseChannel(customer);
        const request = await tx.reviewRequest.create({
          data: {
            clientId: opts.clientId,
            customerId: customer.id,
            sentByUserId: opts.userId,
            channel,
            token: newToken(),
            status: "QUEUED",
            consentLogId: consent.id,
          },
          select: { id: true },
        });
        used += 1;
        result.queued.push({ rowIndex, requestId: request.id, channel });
      }
      return result;
    },
    { timeout: 120_000, maxWait: 20_000 },
  );
}

type Tx = Prisma.TransactionClient;
type CustomerRow = Awaited<ReturnType<Tx["customer"]["findMany"]>>[number];

/**
 * Reuse an existing customer when the phone or email matches, filling in any
 * missing contact details. Never touches optedOutAt.
 */
async function upsertCustomer(
  tx: Tx,
  clientId: string,
  n: { name: string; phoneE164: string | null; email: string | null },
  matches: CustomerRow[],
) {
  // Prefer the phone match (WhatsApp is the preferred channel).
  const existing = matches.find((m) => n.phoneE164 && m.phoneE164 === n.phoneE164) ?? matches[0];
  if (!existing) {
    return tx.customer.create({ data: { clientId, name: n.name, phoneE164: n.phoneE164, email: n.email } });
  }
  const data: Prisma.CustomerUpdateInput = { name: n.name };
  // Only fill gaps, and only if the value doesn't belong to another customer.
  const otherOwns = (field: "phoneE164" | "email", value: string) => matches.some((m) => m.id !== existing.id && m[field] === value);
  if (!existing.phoneE164 && n.phoneE164 && !otherOwns("phoneE164", n.phoneE164)) data.phoneE164 = n.phoneE164;
  if (!existing.email && n.email && !otherOwns("email", n.email)) data.email = n.email;
  return tx.customer.update({ where: { id: existing.id }, data });
}
