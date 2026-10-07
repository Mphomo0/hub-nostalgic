"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { cx } from "@/components/ui";

export type NavItem = { href: string; label: string; icon?: ReactNode; exact?: boolean };
export type NavSection = { title?: string; icon?: ReactNode; items: NavItem[] };

/**
 * Sidebar links. The layout builds the sections on the server (from
 * modules/catalog.ts) and passes plain data plus pre-rendered icons, so the
 * module catalog stays out of the client bundle.
 */
export function DashboardNav({ sections }: { sections: NavSection[] }) {
  const pathname = usePathname();

  const isActive = (item: NavItem) => (item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(item.href + "/"));

  return (
    <nav aria-label="Dashboard" className="-mx-1 flex gap-1 overflow-x-auto md:mx-0 md:flex-col md:gap-5">
      {sections.map((section, si) => (
        <div key={section.title ?? si} className="flex gap-1 md:flex-col">
          {section.title && (
            <div className="hidden items-center gap-2 px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-muted md:flex">
              {section.icon}
              {section.title}
            </div>
          )}
          {section.items.map((item) => {
            const active = isActive(item);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cx(
                  "flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm",
                  active ? "bg-brand-soft font-semibold text-brand-strong" : "text-ink hover:bg-black/5",
                )}
              >
                {item.icon}
                {/* On mobile the section title is hidden, so prefix module links with it. */}
                <span>
                  {section.title && section.title !== "Account" && <span className="md:hidden">{section.title}: </span>}
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
