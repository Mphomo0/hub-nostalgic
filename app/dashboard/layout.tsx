import { PLATFORM_NAME } from "@/lib/config";
import { signOutAction } from "@/lib/auth-actions";
import { getEnabledModules } from "@/lib/modules";
import { requireMember } from "@/lib/session";
import { DashboardNav } from "./nav";
import { Logo } from "@/components/logo";

export const metadata = { title: { default: "Dashboard", template: `%s · ${PLATFORM_NAME}` }, robots: { index: false } };

export default async function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  const { user, client, clientId } = await requireMember();
  const enabledModules = await getEnabledModules(clientId);
  return (
    <div className="flex min-h-full flex-1 flex-col md:flex-row">
      <aside className="border-b border-line bg-card md:sticky md:top-0 md:h-screen md:w-60 md:shrink-0 md:border-r md:border-b-0">
        <div className="flex h-full flex-col gap-4 p-4">
          <div>
            <div className="font-display text-lg font-semibold leading-tight">{client.name}</div>
            <Logo className="mt-1.5 h-3.5" />
          </div>
          <DashboardNav enabledModules={enabledModules} />
          <div className="mt-auto hidden border-t border-line pt-4 text-sm md:block">
            <div className="truncate font-medium">{user.name}</div>
            <div className="truncate text-xs text-muted">{user.email}</div>
            <form action={signOutAction} className="mt-2">
              <button className="text-sm text-muted hover:text-ink">Log out</button>
            </form>
          </div>
        </div>
      </aside>
      <div className="flex-1">
        {client.status === "PAUSED" && (
          <div role="status" className="border-b border-[#ecd28d] bg-warn-soft px-4 py-3 text-sm md:px-8">
            <strong>Your account is paused.</strong> You can still log in and view everything, but sending is switched off. Please contact Nostalgic Studio to reactivate.
          </div>
        )}
        <main className="mx-auto max-w-5xl px-4 py-8 md:px-8">{children}</main>
        <form action={signOutAction} className="px-4 pb-8 md:hidden">
          <button className="text-sm text-muted hover:text-ink">Log out ({user.email})</button>
        </form>
      </div>
    </div>
  );
}
