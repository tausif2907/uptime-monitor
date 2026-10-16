import { Sparkles } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth, authFlags } from "@/auth";
import { MagicLinkForm, SignInForm } from "@/components/auth/auth-forms";
import { AuthShell, Divider } from "@/components/auth/auth-shell";
import { anyOAuth, OAuthButtons } from "@/components/auth/oauth-buttons";
import { SubmitButton } from "@/components/submit-button";
import { Alert } from "@/components/ui";
import { signInAsDemo } from "@/lib/actions/auth";

export const metadata: Metadata = { title: "Sign in" };

const errorMessages: Record<string, string> = {
  OAuthAccountNotLinked:
    "That email already has an account with a different sign-in method. Sign in the way you did before (e.g. email + password).",
  TwoFactorUsePassword: "Your account uses two-factor authentication — please sign in with your password and code.",
  Verification: "That sign-in link has expired or was already used. Request a new one.",
  AccessDenied: "Sign-in was cancelled or denied.",
  Configuration: "Sign-in is temporarily unavailable. Please try again shortly.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; "check-email"?: string; reset?: string; verified?: string }>;
}) {
  const session = await auth();
  if (session?.user) redirect("/dashboard");
  const params = await searchParams;

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to see how your websites are doing."
      footer={
        <>
          New to Uptime Monitor?{" "}
          <Link href="/signup" className="font-medium text-brand-600 hover:underline">Create a free account</Link>
        </>
      }
    >
      {params["check-email"] && <Alert tone="success">Check your inbox — we sent you a sign-in link.</Alert>}
      {params.reset && <Alert tone="success">Password updated. Sign in with your new password.</Alert>}
      {params.verified && <Alert tone="success">Email verified! You can sign in now.</Alert>}
      {params.error && (
        <Alert tone="error">{errorMessages[params.error] ?? "Sign-in failed. Please try again."}</Alert>
      )}

      <OAuthButtons />
      {authFlags.emailSignup || !anyOAuth() ? (
        <>
          {anyOAuth() && <Divider label="or with email" />}
          <SignInForm />
        </>
      ) : (
        // Email sign-up is paused: keep password sign-in for existing accounts, tucked away.
        <details className="group text-sm">
          <summary className="cursor-pointer list-none text-center text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200">
            Have an email + password account? <span className="font-medium text-brand-600 group-open:hidden">Sign in here</span>
          </summary>
          <div className="mt-4">
            <SignInForm />
          </div>
        </details>
      )}

      {authFlags.magicLink && (
        <>
          <Divider label="or without a password" />
          <MagicLinkForm />
        </>
      )}

      {authFlags.demo && (
        <form action={signInAsDemo} className="border-t border-zinc-200 pt-5 dark:border-zinc-800">
          <SubmitButton variant="dark" className="w-full" pendingText="Opening demo…">
            <Sparkles className="h-4 w-4" /> Just looking? Try the demo account
          </SubmitButton>
        </form>
      )}
    </AuthShell>
  );
}
