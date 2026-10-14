import type { Metadata } from "next";
import Link from "next/link";
import { ResetPasswordForm } from "@/components/auth/auth-forms";
import { AuthShell } from "@/components/auth/auth-shell";
import { Alert } from "@/components/ui";

export const metadata: Metadata = { title: "Choose a new password" };

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; token?: string }>;
}) {
  const { email, token } = await searchParams;

  return (
    <AuthShell
      title="Choose a new password"
      footer={<Link href="/login" className="font-medium text-brand-600 hover:underline">← Back to sign in</Link>}
    >
      {email && token ? (
        <ResetPasswordForm email={email} token={token} />
      ) : (
        <Alert tone="error">
          This reset link is incomplete. <Link href="/forgot-password" className="underline">Request a new one</Link>.
        </Alert>
      )}
    </AuthShell>
  );
}
