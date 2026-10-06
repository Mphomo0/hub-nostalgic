import { Notice, PageHeader } from "@/components/ui";
import { db } from "@/lib/db";
import { requireModule } from "@/lib/session";
import { ReviewSettingsForm } from "./review-settings-form";

export const metadata = { title: "Reviews settings" };

export default async function ReviewSettingsPage() {
  const { clientId, isOwner } = await requireModule("reviews");
  const settings = await db.reviewSettings.findUnique({ where: { clientId } });
  return (
    <>
      <PageHeader title="Reviews settings" description="Where customers are sent to review you, and whether they get a reminder." />
      {!isOwner && <div className="mb-4"><Notice>Only the account owner can change settings.</Notice></div>}
      <ReviewSettingsForm defaults={{ googleReviewUrl: settings?.googleReviewUrl ?? "", remindersEnabled: settings?.remindersEnabled ?? true }} disabled={!isOwner} />
    </>
  );
}
