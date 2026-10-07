"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/admin", label: "Clients", exact: false },
  { href: "/admin/usage", label: "Usage", exact: false },
];

export function AdminNav() {
  const pathname = usePathname();
  // "/admin" is also the parent of "/admin/usage", so it only matches itself and client pages.
  const active = (href: string) => (href === "/admin" ? pathname === "/admin" || pathname.startsWith("/admin/clients") : pathname.startsWith(href));
  return (
    <nav aria-label="Admin" className="flex gap-4 text-sm">
      {LINKS.map((l) => (
        <Link key={l.href} href={l.href} aria-current={active(l.href) ? "page" : undefined} className={active(l.href) ? "font-semibold text-brand-strong" : "hover:text-brand-strong"}>
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
