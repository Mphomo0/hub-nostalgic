import type { Metadata } from "next";
import { PLATFORM_NAME } from "@/lib/config";
import { ContactForm } from "./contact-form";

export const metadata: Metadata = {
  title: "Get started",
  description: `Tell us about your business and we'll set you up with ${PLATFORM_NAME}. Contact us for pricing.`,
};

export default async function ContactPage({ searchParams }: PageProps<"/contact">) {
  const { product } = await searchParams;
  const wa = process.env.NEXT_PUBLIC_WHATSAPP_CONTACT?.replace(/\D/g, "");
  return (
    <section className="mx-auto grid max-w-6xl gap-12 px-4 py-16 md:grid-cols-[1fr_1.2fr]">
      <div>
        <h1 className="font-display text-4xl font-semibold tracking-tight">Get started</h1>
        <p className="mt-4 text-lg text-muted">
          Tell us a little about your business and which tools you&apos;re interested in. We&apos;ll reply with pricing and set up your account, usually within one working day.
        </p>
        <ul className="mt-8 space-y-3 text-sm">
          <li><strong>Pricing:</strong> a flat monthly fee for the tools you use. Contact us for pricing.</li>
          <li><strong>Setup:</strong> we create your account, add your branding, switch on your tools and send you a login.</li>
          <li><strong>No contracts to sign online:</strong> we invoice you monthly.</li>
        </ul>
        {wa && (
          <a href={`https://wa.me/${wa}`} className="mt-8 inline-flex items-center gap-2 rounded-xl border border-line bg-card px-5 py-3 font-semibold hover:bg-paper" rel="noopener">
            Prefer WhatsApp? Message us
          </a>
        )}
      </div>
      <ContactForm initialProducts={typeof product === "string" ? [product] : []} />
    </section>
  );
}
