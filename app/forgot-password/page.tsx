import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth-card";
import { ForgotPasswordForm } from "./forgot-password-form";

export const metadata: Metadata = { title: "Forgot password", robots: { index: false } };

export default function ForgotPasswordPage() {
  return (
    <AuthCard
      title="Forgot your password?"
      description="Enter the email you log in with and we'll send you a link to choose a new password."
      footer={<Link href="/login" className="font-semibold text-brand-strong underline">Back to log in</Link>}
    >
      <ForgotPasswordForm />
    </AuthCard>
  );
}
