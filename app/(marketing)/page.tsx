import { ArrowRight, MessageCircle, Palette, ShieldCheck, Users } from "lucide-react";
import Link from "next/link";
import { appUrl, COMPANY_NAME, PLATFORM_NAME } from "@/lib/config";
import { MODULES } from "@/modules/catalog";

/** Products shown publicly: available modules that have a product page. */
const PRODUCTS = MODULES.filter((m) => m.status === "available" && m.marketing);

const PLATFORM_POINTS = [
  { icon: Users, title: "One login for your team", body: "Owners and staff share one account. Every action is recorded against the person who did it." },
  { icon: Palette, title: "Your brand on everything", body: "Your logo and colours on every message and page your customers see." },
  { icon: MessageCircle, title: "WhatsApp first", body: "Reach customers on the app they actually check, with email as a backup." },
  { icon: ShieldCheck, title: "Respectful by design", body: "Consent, easy opt-out and POPIA-minded data handling built in, not bolted on." },
];

/** Platform home page. Each product links to its own page (e.g. /reviews). */
export default function HomePage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: COMPANY_NAME,
    url: appUrl(),
    brand: { "@type": "Brand", name: PLATFORM_NAME },
    makesOffer: PRODUCTS.map((p) => ({ "@type": "Offer", itemOffered: { "@type": "Service", name: `${PLATFORM_NAME} ${p.name}`, url: appUrl(p.marketing!.href) } })),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />

      {/* Hero */}
      <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 pb-16 pt-12 md:grid-cols-[1.15fr_1fr] md:pt-20">
        <div>
          <p className="mb-4 inline-flex rounded-full border border-line bg-card px-3 py-1 text-sm text-muted">For South African small businesses</p>
          <h1 className="font-display text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
            Simple tools to win and keep more customers.
          </h1>
          <p className="mt-5 max-w-xl text-lg text-muted">
            {PLATFORM_NAME} brings the everyday jobs of running a small business into one place, set up and supported by {COMPANY_NAME}. Start with what you need and add more as you grow.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/contact" className="rounded-xl bg-brand px-6 py-3.5 font-semibold text-brand-ink shadow-sm hover:brightness-110">
              Get started
            </Link>
            <Link href="#products" className="rounded-xl border border-line bg-card px-6 py-3.5 font-semibold hover:bg-paper">
              See the tools
            </Link>
          </div>
        </div>

        {/* Decorative preview of the dashboard: one tile per product, plus a slot for what's next. */}
        <div aria-hidden="true" className="relative mx-auto w-full max-w-md">
          <div className="absolute -inset-6 rounded-[2rem] bg-gradient-to-br from-star/25 to-brand/20 blur-2xl" />
          <div className="relative rounded-2xl border border-line bg-card p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <span className="size-2.5 rounded-full bg-line" />
              <span className="size-2.5 rounded-full bg-line" />
              <span className="size-2.5 rounded-full bg-line" />
              <span className="ml-3 h-2.5 w-28 rounded-full bg-paper" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              {PRODUCTS.map((p) => (
                <div key={p.key} className="rounded-xl bg-brand-soft p-4">
                  <p.icon className="size-5 text-brand-strong" />
                  <div className="mt-3 text-sm font-semibold text-brand-strong">{p.name}</div>
                  <div className="mt-2 h-2 w-16 rounded-full bg-brand/25" />
                  <div className="mt-1.5 h-2 w-10 rounded-full bg-brand/15" />
                </div>
              ))}
              {Array.from({ length: Math.max(0, 4 - PRODUCTS.length) }).map((_, i) => (
                <div key={i} className="rounded-xl border border-dashed border-line p-4">
                  <div className="size-5 rounded-md bg-paper" />
                  <div className="mt-3 h-2.5 w-14 rounded-full bg-paper" />
                  <div className="mt-2 h-2 w-10 rounded-full bg-paper" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Products */}
      <section id="products" className="scroll-mt-20 border-y border-line bg-[#eceee7] py-20">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">The tools</h2>
          <p className="mt-3 max-w-2xl text-muted">Each tool works on its own and shares your team, brand and customer list with the others.</p>
          <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {PRODUCTS.map((p) => (
              <Link key={p.key} href={p.marketing!.href} className="group flex flex-col rounded-2xl border border-line bg-card p-6 transition hover:-translate-y-0.5 hover:shadow-md">
                <span className="grid size-11 place-items-center rounded-xl bg-brand-soft text-brand-strong">
                  <p.icon className="size-5" aria-hidden="true" />
                </span>
                <h3 className="mt-5 text-xl font-semibold">{p.name}</h3>
                <p className="mt-2 flex-1 text-muted">{p.tagline}</p>
                <span className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-brand-strong">
                  Learn more <ArrowRight className="size-4 transition group-hover:translate-x-0.5" aria-hidden="true" />
                </span>
              </Link>
            ))}
            <div className="flex flex-col justify-center rounded-2xl border border-dashed border-line p-6 text-muted">
              <h3 className="font-semibold text-ink">More on the way</h3>
              <p className="mt-2 text-sm">We’re adding more tools to {PLATFORM_NAME}. Tell us what would help your business most.</p>
              <Link href="/contact" className="mt-4 text-sm font-semibold text-brand-strong underline">Tell us what you need</Link>
            </div>
          </div>
        </div>
      </section>

      {/* Why one platform */}
      <section className="mx-auto max-w-6xl px-4 py-20">
        <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">One place, built for how you work</h2>
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {PLATFORM_POINTS.map((pt) => (
            <div key={pt.title}>
              <pt.icon className="size-6 text-brand-strong" aria-hidden="true" />
              <h3 className="mt-3 font-semibold">{pt.title}</h3>
              <p className="mt-1.5 text-sm text-muted">{pt.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-4 pb-24">
        <div className="rounded-3xl bg-ink px-8 py-14 text-center text-paper">
          <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">Let’s set you up</h2>
          <p className="mx-auto mt-3 max-w-xl text-paper/75">Tell us about your business and which tools you’re interested in. We’ll come back with pricing and next steps.</p>
          <Link href="/contact" className="mt-8 inline-block rounded-xl bg-paper px-6 py-3.5 font-semibold text-ink hover:bg-white">
            Contact us for pricing
          </Link>
        </div>
      </section>
    </>
  );
}
