import { PageHeader } from "@/components/ui";
import { CONSENT_STATEMENT } from "@/lib/config";
import { CSV_MAX_ROWS } from "@/modules/reviews/config";
import { requireModule } from "@/lib/session";
import { SendForms } from "./send-forms";

export const metadata = { title: "Send requests" };

export default async function SendPage() {
  const { client } = await requireModule("reviews");
  return (
    <>
      <PageHeader
        title="Send review requests"
        description="Customers with a phone number get a WhatsApp message; others get an email. Everyone is asked to rate you, then shown your Google review link."
      />
      <SendForms paused={client.status !== "ACTIVE"} consentStatement={CONSENT_STATEMENT} maxRows={CSV_MAX_ROWS} />
    </>
  );
}
