import Link from "next/link";
import { buttonClass, Card, EmptyState, Notice, PageHeader } from "@/components/ui";
import { PLATFORM_NAME, RETENTION_MONTHS } from "@/lib/config";
import { formatDateTime, formatNumber } from "@/lib/dates";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";

export const metadata = { title: "Enquiries" };

const PAGE_SIZE = 25;

export default async function EnquiriesPage({ searchParams }: PageProps<"/admin/enquiries">) {
  // Enquiries hold personal details, so check here as well as in the layout.
  await requireAdmin();

  const { page: p } = await searchParams;
  const page = Math.max(1, Math.floor(Number(p)) || 1);

  const [total, enquiries] = await Promise.all([
    db.enquiry.count(),
    db.enquiry.findMany({ orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const emailTo = process.env.ENQUIRY_TO_EMAIL || process.env.ADMIN_EMAIL;
  const emailOn = !!emailTo && !!process.env.RESEND_API_KEY;

  return (
    <>
      <PageHeader
        title="Enquiries"
        description={`Messages sent through the contact form, newest first. They're deleted automatically after ${RETENTION_MONTHS} months.`}
      />

      <div className="mb-4">
        {emailOn ? (
          <Notice tone="info">New enquiries are also emailed to <strong>{emailTo}</strong>.</Notice>
        ) : (
          <Notice tone="warn">
            New enquiries are <strong>not being emailed</strong> to anyone, so check this page.{" "}
            {!emailTo ? "Set ENQUIRY_TO_EMAIL (or ADMIN_EMAIL)" : "Set RESEND_API_KEY"} in the environment to get an email for each one.
          </Notice>
        )}
      </div>

      {total === 0 ? (
        <EmptyState title="No enquiries yet">They&apos;ll appear here when someone sends the contact form.</EmptyState>
      ) : (
        <>
          <p className="mb-3 text-sm text-muted">
            {formatNumber(total)} {total === 1 ? "enquiry" : "enquiries"}
            {pages > 1 && ` · page ${page} of ${pages}`}
          </p>
          <ul className="space-y-3">
            {enquiries.map((e) => (
              <li key={e.id}>
                <Card className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
                    <div>
                      <h2 className="font-semibold">
                        {e.name}
                        {e.business && <span className="font-normal text-muted"> · {e.business}</span>}
                      </h2>
                      <div className="mt-0.5 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                        <a href={`mailto:${e.email}`} className="text-brand-strong hover:underline">{e.email}</a>
                        {e.phone && <a href={`tel:${e.phone.replace(/[^\d+]/g, "")}`} className="text-brand-strong hover:underline">{e.phone}</a>}
                      </div>
                    </div>
                    <time dateTime={e.createdAt.toISOString()} className="text-sm text-muted">{formatDateTime(e.createdAt)}</time>
                  </div>
                  <p className="mt-3 whitespace-pre-wrap break-words text-sm">{e.message}</p>
                  <div className="mt-4">
                    <a href={`mailto:${e.email}?subject=${encodeURIComponent(`Re: your enquiry to ${PLATFORM_NAME}`)}`} className={buttonClass("secondary")}>
                      Reply by email
                    </a>
                  </div>
                </Card>
              </li>
            ))}
          </ul>

          {pages > 1 && (
            <nav aria-label="Pages" className="mt-6 flex items-center justify-between text-sm">
              {page > 1 ? <Link href={`/admin/enquiries?page=${page - 1}`} className="font-medium text-brand-strong hover:underline">← Newer</Link> : <span />}
              {page < pages ? <Link href={`/admin/enquiries?page=${page + 1}`} className="font-medium text-brand-strong hover:underline">Older →</Link> : <span />}
            </nav>
          )}
        </>
      )}
    </>
  );
}
