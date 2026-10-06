import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth-card";
import { ResetPasswordForm } from "./reset-password-form";

export const metadata: Metadata = { title: "Choose a new password", robots: { index: false }, referrer: "no-referrer" };

export default async function ResetPasswordPage({ searchParams }: PageProps<"/reset-password">) {
  const { token } = await searchParams;
  const valid = typeof token === "string" && token.length >= 10 && token.length <= 200;

  if (!valid) {
    return (
      <AuthCard
        title="This link isn't valid"
        description="Reset links work once and expire after an hour."
        footer={<Link href="/login" className="font-semibold text-brand-strong underline">Back to log in</Link>}
      >
        <Link href="/forgot-password" className="mt-4 inline-block text-sm font-semibold text-brand-strong underline">Send a new reset link</Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Choose a new password" description="You'll be logged out on all other devices.">
      <ResetPasswordForm token={token} />
    </AuthCard>
  );
}
