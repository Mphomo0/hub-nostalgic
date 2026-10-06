import Link from "next/link";
import { ClientStatusBadge } from "@/components/status";
import { ButtonLink, EmptyState, PageHeader, Table } from "@/components/ui";
import { formatDate, monthKey } from "@/lib/dates";
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

  return (
    <>
      <PageHeader title="Clients" description={`${clients.length} client${clients.length === 1 ? "" : "s"}`} actions={<ButtonLink href="/admin/clients/new">New client</ButtonLink>} />
      {clients.length === 0 ? (
        <EmptyState title="No clients yet">Create your first client to send them an invite.</EmptyState>
      ) : (
        <Table>
          <thead>
            <tr>
              <th>Business</th>
              <th>Status</th>
              <th>Logins</th>
              <th>This month (WA / email)</th>
              <th>Cap</th>
              <th>Created</th>
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
