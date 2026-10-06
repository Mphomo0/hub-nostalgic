import type { Metadata } from "next";
import { LegalPage } from "@/components/legal";
import { REPEAT_CONTACT_DAYS } from "@/modules/reviews/config";
import { COMPANY_NAME, CONSENT_STATEMENT, CONSENT_VERSION, PLATFORM_NAME } from "@/lib/config";

export const metadata: Metadata = { title: "Terms" };

// NOTE: have this reviewed by a South African lawyer before launch.
export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" updated="3 October 2026">
      <p>
        These terms apply to businesses that use {PLATFORM_NAME}, a service provided by {COMPANY_NAME}. By logging in you agree to them on behalf of your business.
        Some tools have extra rules, listed under their own heading below.
      </p>

      <h2>The service</h2>
      <p>
        {PLATFORM_NAME} is a set of tools for running your business. {COMPANY_NAME} sets up your account and switches on the tools you&apos;ve agreed to; fees are
        invoiced monthly as agreed with you. We may pause accounts with overdue invoices; you can still log in and view your data while paused.
      </p>

      <h2>Reviews</h2>
      <p>
        Reviews sends review requests to your customers by WhatsApp or email, collects a star rating, shows every customer a link to review you on Google, and
        passes private feedback from customers who rate 1 to 3 stars to you.
      </p>

      <h3 className="mt-6 font-semibold">Consent</h3>
      <p>Each time you send a request or upload a list, you must tick a box confirming the following statement:</p>
      <blockquote>
        <p>&ldquo;{CONSENT_STATEMENT}&rdquo;</p>
        <p className="mt-2 text-xs text-muted">Consent statement version {CONSENT_VERSION}</p>
      </blockquote>
      <p>You must only upload customers who did business with you and agreed to be contacted, and only the details needed to contact them. We record who confirmed consent, when, and from which IP address.</p>

      <h3 className="mt-6 font-semibold">Rules that protect everyone</h3>
      <ul>
        <li>All clients share one WhatsApp number, so complaints against it affect everyone. You may not try to get around our limits.</li>
        <li>A customer is contacted at most once every {REPEAT_CONTACT_DAYS} days by your business, with at most one reminder.</li>
        <li>Opt-outs are permanent and cannot be reversed by re-uploading a customer.</li>
        <li>You may not offer customers rewards for reviews, write reviews yourself, or ask customers to post only positive reviews. We always show every customer the Google link, whatever they rate (Google prohibits &quot;review gating&quot;).</li>
        <li>Messages (from any tool) may be limited by a monthly cap agreed with you.</li>
      </ul>

      <h2>Data protection</h2>
      <p>
        For your customers&apos; information, you are the responsible party and {COMPANY_NAME} is your operator under POPIA. We process it only to provide the service,
        keep it secure, and delete it as set out in our Privacy Policy. You will tell us promptly about any customer request to access or delete their data.
      </p>

      <h3 className="mt-6 font-semibold">Results</h3>
      <p>We can&apos;t guarantee a number of reviews or ratings, and Google decides whether reviews are published. Ratings and feedback collected through {PLATFORM_NAME} are yours.</p>

      <h2>Liability</h2>
      <p>The service is provided as is. To the extent the law allows, our total liability is limited to the fees you paid in the three months before the claim.</p>

      <h2>Ending the service</h2>
      <p>Either party may end the service with one month&apos;s notice. We may suspend accounts that break these terms. After cancellation we delete your customer data on request or within 90 days.</p>

      <h2>Changes</h2>
      <p>We may update these terms and will tell account owners by email before material changes take effect. South African law applies.</p>
    </LegalPage>
  );
}
