import { formatDate, formatDateTime } from "@/lib/dates";
import { requireModule } from "@/lib/session";
import { csvRow, customerWhere, displayPhone, parseFilter, STATE_LABELS, summariseCustomer } from "@/modules/reviews/lib/customers";

/** CSV download of the customers on the current tab/search. Scoped to the logged-in client. */
export async function GET(request: Request) {
  const { tdb } = await requireModule("reviews");
  const url = new URL(request.url);
  const filter = parseFilter(url.searchParams.get("filter"));
  const q = url.searchParams.get("q") ?? "";

  const customers = await tdb.customer.findMany({
    where: customerWhere(filter, q),
    orderBy: { createdAt: "desc" },
    take: 20_000,
    select: {
      name: true, phoneE164: true, email: true, optedOutAt: true, createdAt: true,
      reviewRequests: { select: { createdAt: true, sentAt: true, ratedAt: true, rating: true, googleClickedAt: true, status: true } },
    },
  });

  const lines = [
    csvRow(["Name", "Phone", "Email", "Status", "Opted out", "Rating", "Requests sent", "Last sent", "Rated on", "Went to Google on", "Added"]),
    ...customers.map((c) => {
      const s = summariseCustomer(c, c.reviewRequests);
      return csvRow([
        c.name,
        displayPhone(c.phoneE164),
        c.email,
        STATE_LABELS[s.state],
        s.optedOut ? `Yes (${formatDate(c.optedOutAt)})` : "No",
        s.rating,
        c.reviewRequests.filter((r) => r.sentAt).length,
        s.lastSentAt ? formatDateTime(s.lastSentAt) : "",
        s.ratedAt ? formatDateTime(s.ratedAt) : "",
        s.googleAt ? formatDateTime(s.googleAt) : "",
        formatDate(c.createdAt),
      ]);
    }),
  ];

  const stamp = new Date().toISOString().slice(0, 10);
  // BOM so Excel reads the file as UTF-8 (names with accents).
  return new Response("﻿" + lines.join("\r\n") + "\r\n", {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="customers-${filter}-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
