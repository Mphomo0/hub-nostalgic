import type { Metadata } from "next";
import { LegalPage } from "@/components/legal";
import { REPEAT_CONTACT_DAYS } from "@/modules/reviews/config";
import { COMPANY_NAME, PLATFORM_NAME, RETENTION_MONTHS } from "@/lib/config";

export const metadata: Metadata = { title: "Privacy Policy" };

// NOTE: have this reviewed by a South African privacy lawyer before launch.
export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" updated="3 October 2026">
      <p>
        This policy explains how {COMPANY_NAME} (&quot;we&quot;) handles personal information through {PLATFORM_NAME}, in line with the Protection of Personal
        Information Act, 2013 (POPIA). {PLATFORM_NAME} is a set of tools that businesses (&quot;our clients&quot;) use to work with their customers. Today that
        includes <strong>Reviews</strong>, which asks customers for a rating and a Google review. When we add tools, we&apos;ll update this policy to describe what they collect.
      </p>

      <h2>Who is responsible</h2>
      <p>
        For customer information uploaded by a business, that business is the <strong>responsible party</strong> and we are its <strong>operator</strong>: we
        process the information only on the business&apos;s instructions to provide the tools they use. For information about our own clients and website visitors,
        {" "}{COMPANY_NAME} is the responsible party.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li><strong>Customers of our clients:</strong> name, mobile number and/or email address, the rating you give, any private feedback you choose to send, and records of messages sent to you (time, channel, delivery status) and whether you opted out.</li>
        <li><strong>Our clients&apos; staff:</strong> name, email address, a securely hashed password, and a record of the review requests each person sends.</li>
        <li><strong>Website enquiries:</strong> the name, business, email, phone and message you submit.</li>
        <li><strong>Technical data:</strong> IP address (used for security, rate limiting and consent records) and session cookies needed to keep you logged in. We do not use advertising or tracking cookies.</li>
      </ul>

      <h2>Why we use it</h2>
      <ul>
        <li>To provide the tools a business uses, for example (Reviews) to send you one review request and at most one reminder on behalf of a business you dealt with, and to show the business your rating and any private feedback.</li>
        <li>To honour opt-outs and to prevent repeat contact.</li>
        <li>To run, secure and bill for the service.</li>
      </ul>
      <p>We do not sell personal information or use it for advertising.</p>

      <h2>How we limit contact (Reviews)</h2>
      <ul>
        <li>Businesses must confirm, each time they send, that their customers agreed to be contacted. We keep a record of that confirmation.</li>
        <li>A customer is contacted at most once every {REPEAT_CONTACT_DAYS} days by the same business, with at most one reminder.</li>
        <li>Every message includes a way to opt out: reply <strong>STOP</strong> on WhatsApp, or use the unsubscribe link in an email. Opt-outs are permanent for that business.</li>
      </ul>

      <h2>Who we share it with</h2>
      <p>We use these service providers (operators) to run {PLATFORM_NAME}. Some store or process data outside South Africa, under agreements that require adequate protection:</p>
      <ul>
        <li>Vercel (hosting), Neon (database), Resend (email), Meta WhatsApp Business Platform (WhatsApp messages), Inngest (background jobs) and Upstash (rate limiting).</li>
        <li>If you choose to leave a Google review, you do so directly with Google under Google&apos;s own terms.</li>
      </ul>

      <h2>How long we keep it</h2>
      <p>
        Customer records are deleted {RETENTION_MONTHS} months after the last time a business contacted them through {PLATFORM_NAME}. If you opted out, we keep only your phone number or
        email address on a do-not-contact list for that business, so we can keep respecting your choice. Website enquiries are deleted after {RETENTION_MONTHS} months.
        When a business stops using {PLATFORM_NAME}, we delete its customer data on request or within 90 days.
      </p>

      <h2>Your rights</h2>
      <p>
        You may ask to see, correct or delete your personal information, or object to its processing. Contact the business that messaged you, or contact us via the
        contact page and we&apos;ll help. You may also complain to the Information Regulator (South Africa) at inforegulator.org.za.
      </p>

      <h2>Security</h2>
      <p>Data is encrypted in transit, passwords are hashed, invite links are single-use and stored hashed, and each business can only access its own data.</p>

      <h2>Contact</h2>
      <p>Questions about this policy: use our contact page and mark your message &quot;Privacy&quot;.</p>
    </LegalPage>
  );
}
