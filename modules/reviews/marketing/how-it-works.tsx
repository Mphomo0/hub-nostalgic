"use client";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useRef } from "react";

gsap.registerPlugin(ScrollTrigger, useGSAP);

/**
 * "How it works": three steps, each with a small scene that animates in 3D
 * space as it scrolls into view (GSAP ScrollTrigger). The text is plain HTML
 * and fully visible without JavaScript; motion is skipped for reduced-motion users.
 */

const STEPS = [
  {
    n: "1",
    title: "You send a request",
    body: "Add a customer after a visit, or upload a CSV of the week’s customers. They get a friendly WhatsApp message, or an email if there’s no phone number.",
  },
  {
    n: "2",
    title: "They rate you in seconds",
    body: "One tap on a star rating, branded with your logo and colours. No app, no login, no forms to fill in.",
  },
  {
    n: "3",
    title: "They're guided to Google",
    body: "Everyone is shown a button to leave a Google review. Anyone who had a bad experience can also message you privately, so you can put it right.",
  },
];

function StepArt({ step }: { step: number }) {
  if (step === 0) {
    return (
      <svg viewBox="0 0 220 160" className="h-full w-full" aria-hidden="true">
        <rect x="70" y="10" width="80" height="140" rx="14" fill="#373a35" />
        <rect x="75" y="16" width="70" height="128" rx="10" fill="#f6f7f3" />
        <g data-anim="bubble">
          <rect x="81" y="40" width="58" height="34" rx="8" fill="#fff" stroke="#e2e5dc" />
          <rect x="87" y="48" width="34" height="5" rx="2.5" fill="#373a35" />
          <rect x="87" y="58" width="44" height="4" rx="2" fill="#b7bab2" />
          <rect x="87" y="65" width="24" height="5" rx="2.5" fill="#44e843" />
        </g>
        <circle data-anim="ping" cx="145" cy="22" r="8" fill="#25d366" />
      </svg>
    );
  }
  if (step === 1) {
    return (
      <svg viewBox="0 0 220 160" className="h-full w-full" aria-hidden="true">
        <rect x="30" y="40" width="160" height="80" rx="16" fill="#fff" stroke="#e2e5dc" />
        {[0, 1, 2, 3, 4].map((i) => (
          <path key={i} data-anim="star" transform={`translate(${46 + i * 27} 66)`} d="M12 1.5l3.1 6.6 7.2.9-5.3 5 1.4 7.1L12 17.6 5.6 21.1 7 14l-5.3-5 7.2-.9z" fill="#f2b51d" />
        ))}
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 220 160" className="h-full w-full" aria-hidden="true">
      <rect data-anim="card" x="30" y="24" width="160" height="112" rx="14" fill="#fff" stroke="#e2e5dc" />
      <circle cx="56" cy="52" r="12" fill="#e2f8e1" />
      <rect x="76" y="44" width="60" height="6" rx="3" fill="#373a35" />
      <rect x="76" y="56" width="40" height="5" rx="2.5" fill="#f2b51d" />
      <rect x="46" y="76" width="128" height="5" rx="2.5" fill="#b7bab2" />
      <rect x="46" y="88" width="104" height="5" rx="2.5" fill="#b7bab2" />
      <rect data-anim="cta" x="46" y="104" width="76" height="20" rx="6" fill="#44e843" />
    </svg>
  );
}

export function HowItWorks() {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.utils.toArray<HTMLElement>("[data-step]").forEach((el, i) => {
          const art = el.querySelector("[data-art]");
          const tl = gsap.timeline({ scrollTrigger: { trigger: el, start: "top 80%", end: "top 35%", scrub: 0.6 } });
          tl.fromTo(art, { rotateY: i % 2 ? 35 : -35, rotateX: 18, z: -120, opacity: 0.2 }, { rotateY: 0, rotateX: 0, z: 0, opacity: 1, ease: "power2.out" });
          if (i === 0) tl.fromTo(el.querySelector('[data-anim="bubble"]'), { y: -30, opacity: 0 }, { y: 0, opacity: 1 }, "<0.2").fromTo(el.querySelector('[data-anim="ping"]'), { scale: 0, transformOrigin: "center" }, { scale: 1 }, "<0.3");
          if (i === 1) tl.fromTo(el.querySelectorAll('[data-anim="star"]'), { scale: 0.2, opacity: 0.15, transformOrigin: "center" }, { scale: 1, opacity: 1, stagger: 0.15 }, "<0.1");
          if (i === 2) tl.fromTo(el.querySelector('[data-anim="cta"]'), { scaleX: 0, transformOrigin: "left center" }, { scaleX: 1 }, "<0.3");
        });
      });
      return () => mm.revert();
    },
    { scope: root },
  );

  return (
    <div ref={root} className="grid gap-6 md:grid-cols-3">
      {STEPS.map((s, i) => (
        <article key={s.n} data-step className="rounded-2xl border border-line bg-card p-6">
          <div className="mb-5 aspect-[11/8] rounded-xl bg-paper [perspective:800px]">
            <div data-art className="h-full w-full [transform-style:preserve-3d]">
              <StepArt step={i} />
            </div>
          </div>
          <div className="flex items-baseline gap-3">
            <span className="font-display text-3xl font-semibold text-brand-strong">{s.n}</span>
            <h3 className="text-lg font-semibold">{s.title}</h3>
          </div>
          <p className="mt-2 text-muted">{s.body}</p>
        </article>
      ))}
    </div>
  );
}
