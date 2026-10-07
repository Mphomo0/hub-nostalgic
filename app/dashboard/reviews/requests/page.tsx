import Link from "next/link";
import { RequestStatusBadge, Stars, STATUS_OPTIONS } from "@/modules/reviews/components/request-status";
import { cx, EmptyState, PageHeader, Table } from "@/components/ui";
import { formatDateTime } from "@/lib/dates";
import type { RequestStatus } from "@/lib/generated/prisma/enums";
import { requireModule } from "@/lib/session";

export const metadata = { title: "Requests" };
const PAGE_SIZE = 50;

export default async function RequestsPage({ searchParams }: PageProps<"/dashboard/reviews/requests">) {
  const { tdb } = await requireModule("reviews");
  const sp = await searchParams;
  const status = STATUS_OPTIONS.find((o) => o.value === sp.status)?.value as RequestStatus | undefined;
  const page = Math.min(10_000, Math.max(1, Math.floor(Number(sp.page)) || 1));

  const where = status ? { status } : {};
  const [total, rows] = await Promise.all([
    tdb.reviewRequest.count({ where }),
    tdb.reviewRequest.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true, status: true, channel: true, rating: true, failureReason: true,
        createdAt: true, sentAt: true, ratedAt: true, googleClickedAt: true, reminderSentAt: true,
        customer: { select: { name: true, optedOutAt: true } },
        sentBy: { select: { name: true } },
      },
    }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const href = (p: { status?: string; page?: number }) => {
    const q = new URLSearchParams();
    if (p.status) q.set("status", p.status);
    if (p.page && p.page > 1) q.set("page", String(p.page));
    const s = q.toString();
    return `/dashboard/reviews/requests${s ? `?${s}` : ""}`;
  };

  return (
    <>
      <PageHeader title="Requests" description={`${total} request${total === 1 ? "" : "s"}`} />
      <nav aria-label="Filter by status" className="mb-4 flex flex-wrap gap-2 text-sm">
        <Link href={href({})} aria-current={!status ? "page" : undefined} className={cx("rounded-full border px-3 py-1", !status ? "border-brand bg-brand-soft text-brand-strong" : "border-line bg-card")}>All</Link>
        {STATUS_OPTIONS.map((o) => (
          <Link key={o.value} href={href({ status: o.value })} aria-current={status === o.value ? "page" : undefined} className={cx("rounded-full border px-3 py-1", status === o.value ? "border-brand bg-brand-soft text-brand-strong" : "border-line bg-card")}>
            {o.label}
          </Link>
        ))}
      </nav>
      {rows.length === 0 ? (
        <EmptyState title="No requests here yet">Send your first review request from the Send requests page.</EmptyState>
      ) : (
        <Table>
          <thead><tr><th scope="col">Customer</th><th scope="col">Status</th><th scope="col">Rating</th><th scope="col">Channel</th><th scope="col">Sent by</th><th scope="col">Sent</th><th scope="col">Rated</th><th scope="col">Reminder</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>
                  {r.customer.name}
                  {r.customer.optedOutAt && <span className="ml-2 text-xs text-danger">opted out</span>}
                </td>
                <td>
                  <RequestStatusBadge status={r.status} />
                  {r.failureReason && <div className="mt-1 max-w-48 text-xs text-muted">{r.failureReason}</div>}
                </td>
                <td><Stars rating={r.rating} /></td>
                <td>{r.channel === "WHATSAPP" ? "WhatsApp" : "Email"}</td>
                <td>{r.sentBy?.name ?? "—"}</td>
                <td className="whitespace-nowrap">{formatDateTime(r.sentAt ?? r.createdAt)}</td>
                <td className="whitespace-nowrap">{formatDateTime(r.ratedAt)}</td>
                <td className="whitespace-nowrap">{formatDateTime(r.reminderSentAt)}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      {pages > 1 && (
        <nav aria-label="Pagination" className="mt-4 flex items-center justify-between text-sm">
          {page > 1 ? <Link href={href({ status, page: page - 1 })} className="font-semibold text-brand-strong">← Newer</Link> : <span />}
          <span className="text-muted">Page {page} of {pages}</span>
          {page < pages ? <Link href={href({ status, page: page + 1 })} className="font-semibold text-brand-strong">Older →</Link> : <span />}
        </nav>
      )}
    </>
  );
}
