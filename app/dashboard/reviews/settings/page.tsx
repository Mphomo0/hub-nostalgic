import { Card, Notice, PageHeader } from "@/components/ui";
import { db } from "@/lib/db";
import { requireModule } from "@/lib/session";
import { LocationsManager } from "@/modules/reviews/components/locations-manager";
import { listLocations } from "@/modules/reviews/lib/locations";
import { ReviewSettingsForm } from "./review-settings-form";
import { deleteLocationAction, saveLocationAction } from "./actions";

export const metadata = { title: "Reviews settings" };

export default async function ReviewSettingsPage() {
  const { clientId, isOwner } = await requireModule("reviews");
  const [settings, locations] = await Promise.all([db.reviewSettings.findUnique({ where: { clientId } }), listLocations(clientId)]);
  return (
    <>
      <PageHeader title="Reviews settings" description="Your branches and their Google review links, and whether customers get a reminder." />
      {!isOwner && <div className="mb-4"><Notice>Only the account owner can change settings.</Notice></div>}
      <div className="max-w-2xl space-y-6">
        <Card className="space-y-3">
          <div>
            <h2 className="font-semibold">Branches</h2>
            <p className="text-sm text-muted">Each branch has its own Google Business Profile. When you send requests you choose the branch, and customers are sent to that branch’s review page.</p>
          </div>
          <LocationsManager locations={locations} saveAction={saveLocationAction} deleteAction={deleteLocationAction} disabled={!isOwner} />
        </Card>
        <ReviewSettingsForm defaults={{ remindersEnabled: settings?.remindersEnabled ?? true }} disabled={!isOwner} />
      </div>
    </>
  );
}
