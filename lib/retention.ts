import { RETENTION_MONTHS } from "@/lib/config";
import { db } from "@/lib/db";

/**
 * Deletes customer data older than the retention period (Privacy Policy).
 * - Customers whose most recent review request is older than RETENTION_MONTHS
 *   (or who have none and were created before then) are deleted with all their
 *   requests, feedback and message events.
 * - Opted-out customers keep only a do-not-contact record (no name, no history).
 * - Old enquiries and unlinked message events are removed too.
 */
export async function purgeExpiredData(now = new Date()) {
  const cutoff = new Date(now);
  cutoff.setMonth(cutoff.getMonth() - RETENTION_MONTHS);

  const stale = { createdAt: { lt: cutoff }, reviewRequests: { none: { createdAt: { gte: cutoff } } } };

  const deleted = await db.customer.deleteMany({ where: { ...stale, optedOutAt: null } });
  const oldOptOuts = await db.customer.findMany({ where: { ...stale, optedOutAt: { not: null } }, select: { id: true } });
  await db.reviewRequest.deleteMany({ where: { customerId: { in: oldOptOuts.map((c) => c.id) } } });
  await db.customer.updateMany({ where: { id: { in: oldOptOuts.map((c) => c.id) } }, data: { name: "(expired)" } });
  const enquiries = await db.enquiry.deleteMany({ where: { createdAt: { lt: cutoff } } });
  const events = await db.messageEvent.deleteMany({ where: { reviewRequestId: null, createdAt: { lt: cutoff } } });

  return { customersDeleted: deleted.count, optOutsMinimised: oldOptOuts.length, enquiriesDeleted: enquiries.count, eventsDeleted: events.count };
}
