import Link from "next/link";
import { COMPANY_NAME, PLATFORM_NAME } from "@/lib/config";
import { MODULES } from "@/modules/catalog";
import { Logo } from "@/components/logo";

/** Product pages in the header/footer come from the module catalog. */
const PRODUCTS = MODULES.filter((m) => m.status === "available" && m.marketing);

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-card focus:px-3 focus:py-2">
        Skip to content
      </a>
      <header className="sticky top-0 z-40 border-b border-line/70 bg-paper/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:gap-6">
          <Link href="/" className="shrink-0">
            <Logo className="h-6 sm:h-7" priority />
          </Link>
          <nav aria-label="Main" className="ml-auto flex items-center gap-1 text-sm sm:gap-4">
            {PRODUCTS.map((p) => (
              <Link key={p.key} href={p.marketing!.href} className="hidden rounded px-2 py-1 hover:text-brand-strong sm:inline">
                {p.name}
              </Link>
            ))}
            <Link href="/contact" className="hidden rounded px-2 py-1 hover:text-brand-strong sm:inline">Contact</Link>
            <Link href="/login" className="whitespace-nowrap rounded px-2 py-1 hover:text-brand-strong">Log in</Link>
            <Link href="/contact" className="whitespace-nowrap rounded-lg bg-ink px-3 py-2 font-semibold text-paper hover:bg-brand hover:text-brand-ink">Get started</Link>
          </nav>
        </div>
      </header>
      <main id="main" className="flex-1">{children}</main>
      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-8 text-sm text-muted">
          <span>© {new Date().getFullYear()} {COMPANY_NAME}. {PLATFORM_NAME} is a service by {COMPANY_NAME}.</span>
          <nav aria-label="Products" className="flex gap-4 sm:ml-auto">
            {PRODUCTS.map((p) => (
              <Link key={p.key} href={p.marketing!.href} className="hover:text-ink">{p.name}</Link>
            ))}
          </nav>
          <nav aria-label="Legal" className="flex gap-4">
            <Link href="/privacy" className="hover:text-ink">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-ink">Terms</Link>
            <Link href="/contact" className="hover:text-ink">Contact</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
