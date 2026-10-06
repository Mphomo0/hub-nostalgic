import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { LoginForm } from "./login-form";
import { Logo } from "@/components/logo";

export const metadata: Metadata = { title: "Log in", robots: { index: false } };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const session = await getSession();
  const { error } = await searchParams;
  if (session && error !== "no-client") redirect(session.user.isPlatformAdmin ? "/admin" : "/dashboard");

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-8 flex justify-center">
          <Logo className="h-9" priority />
        </Link>
        <div className="rounded-xl border border-line bg-card p-6 shadow-sm">
          <h1 className="text-xl font-semibold">Log in</h1>
          <p className="mt-1 text-sm text-muted">Use the email and password from your invite.</p>
          {error === "no-client" && (
            <p className="mt-4 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">Your login isn&apos;t linked to a business yet. Please contact Nostalgic Studio.</p>
          )}
          <LoginForm />
        </div>
        <p className="mt-6 text-center text-sm text-muted">
          <Link href="/forgot-password" className="font-semibold text-brand-strong underline">Forgot your password?</Link>
        </p>
      </div>
    </main>
  );
}
