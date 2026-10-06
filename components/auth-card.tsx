import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/logo";

/** Centered card used by the login / password pages. */
export function AuthCard({ title, description, children, footer }: { title: string; description?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-8 flex justify-center">
          <Logo className="h-9" priority />
        </Link>
        <div className="rounded-xl border border-line bg-card p-6 shadow-sm">
          <h1 className="text-xl font-semibold">{title}</h1>
          {description && <p className="mt-1 text-sm text-muted">{description}</p>}
          {children}
        </div>
        {footer && <div className="mt-6 text-center text-sm text-muted">{footer}</div>}
      </div>
    </main>
  );
}
