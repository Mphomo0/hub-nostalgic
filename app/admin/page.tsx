import Link from "next/link";
import { ClientStatusBadge } from "@/components/status";
import { ButtonLink, cx, EmptyState, PageHeader, Table } from "@/components/ui";
import { daysAgo, formatDate, monthKey } from "@/lib/dates";
import { db } from "@/lib/db";

export default async function AdminClientsPage() {
  const month = monthKey();
  const clients = await db.client.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      status: true,
      createdAt: true,
      monthlyCap: true,
      _count: { select: { memberships: true } },
      usageCounters: { where: { month }, select: { whatsappCount: true, emailCount: true } },
    },
  });

  const failed = await db.reviewRequest.groupBy({
    by: ["clientId"],
    where: { status: "FAILED", updatedAt: { gte: daysAgo(1) } },
    _count: { _all: true },
  });
  const failedBy = new Map(failed.map((f) => [f.clientId, f._count._all]));

  return (
    <>
      <PageHeader title="Clients" description={`${clients.length} client${clients.length === 1 ? "" : "s"}`} actions={<ButtonLink href="/admin/clients/new">New client</ButtonLink>} />
      {clients.length === 0 ? (
        <EmptyState title="No clients yet">Create your first client to send them an invite.</EmptyState>
      ) : (
        <Table>
          <thead>
            <tr>
              <th scope="col">Business</th>
              <th scope="col">Status</th>
              <th scope="col">Logins</th>
              <th scope="col">This month (WA / email)</th>
              <th scope="col">Cap</th>
              <th scope="col">Failed (24h)</th>
              <th scope="col">Created</th>
            </tr>
          </thead>
          <tbody>
            {clients.map((c) => {
              const u = c.usageCounters[0];
              return (
                <tr key={c.id}>
                  <td>
                    <Link href={`/admin/clients/${c.id}`} className="font-medium text-brand-strong hover:underline">
                      {c.name}
                    </Link>
                  </td>
                  <td><ClientStatusBadge status={c.status} /></td>
                  <td className="tabular-nums">{c._count.memberships}</td>
                  <td className="tabular-nums">{u ? `${u.whatsappCount} / ${u.emailCount}` : "0 / 0"}</td>
                  <td className="tabular-nums">{c.monthlyCap ?? "—"}</td>
                  <td className={cx("tabular-nums", (failedBy.get(c.id) ?? 0) > 0 && "font-medium text-danger")}>{failedBy.get(c.id) ?? 0}</td>
                  <td>{formatDate(c.createdAt)}</td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}
    </>
  );
}
