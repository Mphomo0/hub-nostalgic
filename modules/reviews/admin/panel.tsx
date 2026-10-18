import { Badge, Button, Card, Table } from "@/components/ui";
import { formatDateTime } from "@/lib/dates";
import { db } from "@/lib/db";
import { disableModuleAction } from "@/app/admin/actions";
import { RequestStatusBadge, Stars } from "@/modules/reviews/components/request-status";
import { reviewsModule } from "@/modules/reviews/module";
import { LocationsManager } from "@/modules/reviews/components/locations-manager";
import { listLocations } from "@/modules/reviews/lib/locations";
import { deleteLocationAdminAction, saveLocationAdminAction } from "./actions";
import { AdminReviewSettingsForm } from "./settings-form";

/** Reviews section on the admin client page: on/off, settings and recent requests. */
export async function ReviewsAdminPanel({ clientId, enabled }: { clientId: string; enabled: boolean }) {
  const [settings, locations, recent] = await Promise.all([
    db.reviewSettings.findUnique({ where: { clientId } }),
    listLocations(clientId),
    enabled
      ? db.reviewRequest.findMany({
          where: { clientId },
          orderBy: { createdAt: "desc" },
          take: 10,
          include: { customer: { select: { name: true } }, location: { select: { name: true } }, sentBy: { select: { name: true } } },
        })
      : Promise.resolve([]),
  ]);
  const Icon = reviewsModule.icon;

  return (
    <Card className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-lg bg-brand-soft text-brand-strong"><Icon className="size-4" aria-hidden="true" /></span>
          <div>
            <h2 className="font-semibold">{reviewsModule.name}</h2>
            <p className="text-xs text-muted">{reviewsModule.tagline}</p>
          </div>
        </div>
        {enabled ? (
          <div className="flex items-center gap-3">
            <Badge tone="good">On</Badge>
            <form action={disableModuleAction}>
              <input type="hidden" name="clientId" value={clientId} />
              <input type="hidden" name="module" value={reviewsModule.key} />
              <Button variant="ghost" className="px-2 py-1 text-sm">Switch off</Button>
            </form>
          </div>
        ) : (
          <Badge>Off</Badge>
        )}
      </div>

      {!enabled && <p className="text-sm text-muted">Add a branch with its Google review link to switch Reviews on. Any previous data is kept.</p>}
      <div>
        <h3 className="mb-2 text-sm font-medium">Branches</h3>
        <LocationsManager
          locations={locations}
          saveAction={saveLocationAdminAction}
          deleteAction={deleteLocationAdminAction}
          hidden={{ clientId, ...(!enabled && locations.length === 0 ? { enable: "1" } : {}) }}
        />
      </div>
      <AdminReviewSettingsForm
        clientId={clientId}
        enabled={enabled}
        canEnable={locations.length > 0}
        defaults={{ remindersEnabled: settings?.remindersEnabled ?? true }}
      />

      {enabled && (
        <div>
          <h3 className="mb-2 text-sm font-medium">Recent requests</h3>
          <Table>
            <thead><tr><th>Customer</th>{locations.length > 1 && <th>Branch</th>}<th>Status</th><th>Rating</th><th>Channel</th><th>Sent by</th><th>Created</th></tr></thead>
            <tbody>
              {recent.length === 0 && <tr><td colSpan={locations.length > 1 ? 7 : 6} className="text-muted">No requests yet.</td></tr>}
              {recent.map((r) => (
                <tr key={r.id}>
                  <td>{r.customer.name}</td>
                  {locations.length > 1 && <td>{r.location?.name ?? "—"}</td>}
                  <td><RequestStatusBadge status={r.status} /></td>
                  <td><Stars rating={r.rating} /></td>
                  <td>{r.channel === "WHATSAPP" ? "WhatsApp" : "Email"}</td>
                  <td>{r.sentBy?.name ?? "—"}</td>
                  <td>{formatDateTime(r.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      )}
    </Card>
  );
}
