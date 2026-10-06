import type { Metadata } from "next";
import Link from "next/link";
import { HeroVisual } from "@/modules/reviews/marketing/hero-visual";
import { HowItWorks } from "@/modules/reviews/marketing/how-it-works";
import { appUrl, COMPANY_NAME, PLATFORM_NAME } from "@/lib/config";
import { reviewsModule } from "@/modules/reviews/module";

export const metadata: Metadata = {
  title: "Reviews: more Google reviews from happy customers",
  description:
    "Send review requests by WhatsApp or email, let customers rate you in seconds, and guide them to leave a Google review. Built for South African small businesses.",
  alternates: { canonical: "/reviews" },
};

const FAQS = [
  {
    q: "How much does it cost?",
    a: "It's a flat monthly fee, WhatsApp included. Contact us for pricing and we'll set you up.",
  },
  {
    q: "Do my customers need to download anything?",
    a: "No. They get a WhatsApp message or an email with a link. They tap a star rating in their browser and are then shown your Google review link.",
  },
  {
    q: "Do you hide bad reviews?",
    a: "No. Every customer, whatever they rate, is shown the button to review you on Google. Customers who rate 1 to 3 stars can also send you a private message, so you get the chance to fix the problem. Hiding the Google link from unhappy customers is against Google's rules, and we never do it.",
  },
  {
    q: "What if a customer doesn't want messages?",
    a: "Every message includes a way to opt out (reply STOP on WhatsApp, or unsubscribe by email), and opted-out customers are never contacted again. We also never message the same customer more than once in 30 days, and send at most one reminder.",
  },
  {
    q: "Can my staff send requests too?",
    a: "Yes. The account owner can invite staff, and every request is recorded against the person who sent it.",
  },
  {
    q: "How do I add customers?",
    a: "Type in one customer at a time after a visit, or upload a spreadsheet (CSV) with names, phone numbers and emails. We check every row and tell you about any problems before anything is sent.",
  },
];

const AUDIENCE = [
  { title: "Salons, barbers and spas", body: "Ask after every appointment, while the fresh cut still feels good." },
  { title: "Restaurants and cafés", body: "Turn regulars into the reviews that bring in new diners." },
  { title: "Trades and home services", body: "Plumbers, electricians, cleaners: get reviews for work done in people's homes." },
  { title: "Clinics and practices", body: "Dentists, physios and vets building trust before the first visit." },
];

/** Product page for the Reviews module. */
export default function ReviewsProductPage() {
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: PLATFORM_NAME, item: appUrl("/") },
        { "@type": "ListItem", position: 2, name: reviewsModule.name, item: appUrl("/reviews") },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "Service",
      name: `${PLATFORM_NAME} ${reviewsModule.name}`,
      serviceType: "Google review automation",
      provider: { "@type": "Organization", name: COMPANY_NAME },
      areaServed: { "@type": "Country", name: "South Africa" },
      description:
        "Send review requests to customers by WhatsApp or email. Customers rate their experience in seconds and are guided to leave a Google review. Low ratings can also be sent privately to the business.",
      offers: { "@type": "Offer", description: "One flat monthly fee. Contact us for pricing." },
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: FAQS.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
    },
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />

      {/* Hero */}
      <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 pb-16 pt-12 md:grid-cols-[1.1fr_1fr] md:pt-20">
        <div>
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-line bg-card px-3 py-1 text-sm text-muted">
            <span className="text-star" aria-hidden="true">★★★★★</span> {PLATFORM_NAME} {reviewsModule.name}
          </p>
          <h1 className="font-display text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
            Get more Google reviews from your happy customers, automatically.
          </h1>
          <p className="mt-5 max-w-xl text-lg text-muted">
            Send a quick WhatsApp or email after each visit. Customers rate you with one tap, then we guide them to leave a Google review. Unhappy customers can tell you privately, so you can make it right.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/contact?product=reviews" className="rounded-xl bg-brand px-6 py-3.5 font-semibold text-brand-ink shadow-sm hover:brightness-110">
              Get started
            </Link>
            <Link href="#how-it-works" className="rounded-xl border border-line bg-card px-6 py-3.5 font-semibold hover:bg-paper">
              See how it works
            </Link>
          </div>
          <p className="mt-4 text-sm text-muted">Flat monthly fee, WhatsApp included. Contact us for pricing.</p>
        </div>
        <HeroVisual />
      </section>

      {/* How it works */}
      <section id="how-it-works" className="scroll-mt-20 border-y border-line bg-[#eceee7] py-20">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">How it works</h2>
          <p className="mt-3 max-w-2xl text-muted">Three steps: send, rate, review. It takes your customer less than a minute.</p>
          <div className="mt-10">
            <HowItWorks />
          </div>
        </div>
      </section>

      {/* Who it's for */}
      <section className="mx-auto max-w-6xl px-4 py-20">
        <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">Who it&apos;s for</h2>
        <p className="mt-3 max-w-2xl text-muted">
          Any local business where customers search Google before they choose. More recent, genuine reviews help you show up and win the click.
        </p>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {AUDIENCE.map((a) => (
            <div key={a.title} className="rounded-2xl border border-line bg-card p-6">
              <h3 className="font-semibold">{a.title}</h3>
              <p className="mt-2 text-sm text-muted">{a.body}</p>
            </div>
          ))}
        </div>
        <div className="mt-10 grid gap-6 rounded-2xl bg-ink p-8 text-paper md:grid-cols-3">
          <div>
            <h3 className="font-semibold">WhatsApp first</h3>
            <p className="mt-1 text-sm text-paper/70">Customers get your request on the app they actually check, with email as a backup.</p>
          </div>
          <div>
            <h3 className="font-semibold">Your brand</h3>
            <p className="mt-1 text-sm text-paper/70">Your logo and colours on every email and rating page.</p>
          </div>
          <div>
            <h3 className="font-semibold">Respectful by design</h3>
            <p className="mt-1 text-sm text-paper/70">Consent, easy opt-out, one reminder at most, and never more than once a month.</p>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="scroll-mt-20 border-t border-line py-20">
        <div className="mx-auto max-w-3xl px-4">
          <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">Questions</h2>
          <div className="mt-8 divide-y divide-line rounded-2xl border border-line bg-card">
            {FAQS.map((f) => (
              <details key={f.q} className="group px-6 py-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold">
                  {f.q}
                  <span aria-hidden="true" className="text-xl text-muted transition group-open:rotate-45">+</span>
                </summary>
                <p className="mt-3 text-muted">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-4 pb-24">
        <div className="rounded-3xl bg-brand px-8 py-14 text-center text-brand-ink">
          <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">Ready for more five-star reviews?</h2>
          <p className="mx-auto mt-3 max-w-xl text-brand-ink/80">Tell us a little about your business and we&apos;ll get back to you with pricing and next steps.</p>
          <Link href="/contact?product=reviews" className="mt-8 inline-block rounded-xl bg-paper px-6 py-3.5 font-semibold text-ink hover:bg-white">
            Contact us for pricing
          </Link>
        </div>
      </section>
    </>
  );
}
