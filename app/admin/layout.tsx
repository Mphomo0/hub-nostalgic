import Link from "next/link";
import { PLATFORM_NAME } from "@/lib/config";
import { signOutAction } from "@/lib/auth-actions";
import { requireAdmin } from "@/lib/session";
import { Logo } from "@/components/logo";

export const metadata = { title: { default: "Admin", template: `%s · Admin · ${PLATFORM_NAME}` }, robots: { index: false } };

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const user = await requireAdmin();
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-b border-line bg-card">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Link href="/admin" className="flex items-center gap-1">
            <Logo className="h-6" /> <span className="ml-1 rounded bg-ink px-1.5 py-0.5 font-sans text-xs text-white">Admin</span>
          </Link>
          <nav className="flex gap-4 text-sm">
            <Link href="/admin" className="hover:text-brand-strong">Clients</Link>
            <Link href="/admin/usage" className="hover:text-brand-strong">Usage</Link>
          </nav>
          <div className="ml-auto flex items-center gap-3 text-sm text-muted">
            <span className="hidden sm:inline">{user.email}</span>
            <form action={signOutAction}>
              <button className="font-medium text-ink hover:text-brand-strong">Log out</button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
    </div>
  );
}
