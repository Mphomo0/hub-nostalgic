import { Building2, House, Users } from "lucide-react";
import { PLATFORM_NAME } from "@/lib/config";
import { signOutAction } from "@/lib/auth-actions";
import { getEnabledModules } from "@/lib/modules";
import { requireMember } from "@/lib/session";
import { MODULES } from "@/modules/catalog";
import { DashboardNav, type NavSection } from "./nav";
import { Logo } from "@/components/logo";

export const metadata = { title: { default: "Dashboard", template: `%s · ${PLATFORM_NAME}` }, robots: { index: false } };

export default async function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  const { user, client, clientId } = await requireMember();
  const enabledModules = await getEnabledModules(clientId);
  const icon = "size-4";
  const sections: NavSection[] = [
    { items: [{ href: "/dashboard", label: "Home", icon: <House className={icon} aria-hidden="true" />, exact: true }] },
    ...MODULES.filter((m) => enabledModules.includes(m.key)).map((m) => ({
      title: m.name,
      icon: <m.icon className="size-3.5" aria-hidden="true" />,
      items: m.nav.map((n, i) => ({ href: n.href, label: n.label, exact: i === 0 })),
    })),
    {
      title: "Account",
      items: [
        { href: "/dashboard/team", label: "Team", icon: <Users className={icon} aria-hidden="true" /> },
        { href: "/dashboard/settings", label: "Business profile", icon: <Building2 className={icon} aria-hidden="true" /> },
      ],
    },
  ];

  return (
    <div className="flex min-h-full flex-1 flex-col md:flex-row">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-card focus:px-3 focus:py-2">
        Skip to content
      </a>
      <aside className="border-b border-line bg-card md:sticky md:top-0 md:h-screen md:w-60 md:shrink-0 md:border-r md:border-b-0">
        <div className="flex h-full flex-col gap-4 p-4">
          <div>
            <div className="break-words font-display text-lg font-semibold leading-tight">{client.name}</div>
            <Logo className="mt-1.5 h-3.5" />
          </div>
          <DashboardNav sections={sections} />
          <div className="mt-auto hidden border-t border-line pt-4 text-sm md:block">
            <div className="truncate font-medium">{user.name}</div>
            <div className="truncate text-xs text-muted">{user.email}</div>
            <form action={signOutAction} className="mt-2">
              <button type="submit" className="text-sm text-muted hover:text-ink">Log out</button>
            </form>
          </div>
        </div>
      </aside>
      <div className="min-w-0 flex-1">
        {client.status === "PAUSED" && (
          <div role="status" className="border-b border-[#ecd28d] bg-warn-soft px-4 py-3 text-sm md:px-8">
            <strong>Your account is paused.</strong> You can still log in and view everything, but sending is switched off. Please contact Nostalgic Studio to reactivate.
          </div>
        )}
        <main id="main" className="mx-auto max-w-5xl px-4 py-8 md:px-8">{children}</main>
        <form action={signOutAction} className="px-4 pb-8 md:hidden">
          <button type="submit" className="max-w-full break-all text-left text-sm text-muted hover:text-ink">Log out ({user.email})</button>
        </form>
      </div>
    </div>
  );
}
