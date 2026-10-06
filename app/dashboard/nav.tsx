"use client";
import { Building2, House, Users, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "@/components/ui";
import { MODULES } from "@/modules/catalog";

type Item = { href: string; label: string; icon?: LucideIcon; exact?: boolean };
type Section = { title?: string; icon?: LucideIcon; items: Item[] };

/**
 * Sidebar: Home, then one section per module the client has switched on
 * (from modules/catalog.ts), then account pages shared by every module.
 */
export function DashboardNav({ enabledModules }: { enabledModules: string[] }) {
  const pathname = usePathname();

  const sections: Section[] = [
    { items: [{ href: "/dashboard", label: "Home", icon: House, exact: true }] },
    ...MODULES.filter((m) => enabledModules.includes(m.key)).map((m) => ({
      title: m.name,
      icon: m.icon,
      items: m.nav.map((n, i) => ({ href: n.href, label: n.label, exact: i === 0 })),
    })),
    {
      title: "Account",
      items: [
        { href: "/dashboard/team", label: "Team", icon: Users },
        { href: "/dashboard/settings", label: "Business profile", icon: Building2 },
      ],
    },
  ];

  const isActive = (item: Item) => (item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(item.href + "/"));

  return (
    <nav aria-label="Dashboard" className="-mx-1 flex gap-1 overflow-x-auto md:mx-0 md:flex-col md:gap-5">
      {sections.map((section, si) => (
        <div key={si} className="flex gap-1 md:flex-col">
          {section.title && (
            <div className="hidden items-center gap-2 px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-muted md:flex">
              {section.icon && <section.icon className="size-3.5" aria-hidden="true" />}
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
                {item.icon && <item.icon className="size-4" aria-hidden="true" />}
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
