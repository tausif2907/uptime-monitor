import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth, authFlags } from "@/auth";
import { SubmitButton } from "@/components/submit-button";
import { Card, Input } from "@/components/ui";
import { signInAsDemo, signInWithEmail, signInWithGoogle } from "@/lib/actions/auth";

export const metadata: Metadata = { title: "Sign in" };

const errorMessages: Record<string, string> = {
  CredentialsSignin: "That demo login didn't work — has the database been seeded?",
  OAuthAccountNotLinked: "That email is already linked to another sign-in method.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; "check-email"?: string }>;
}) {
  const session = await auth();
  if (session?.user) redirect("/dashboard");
  const params = await searchParams;
  const noProviders = !authFlags.google && !authFlags.email && !authFlags.demo;

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4 py-12">
      <Link href="/" className="mb-6 text-sm text-zinc-500 hover:underline">
        ← Uptime Monitor
      </Link>
      <Card className="space-y-5">
        <div>
          <h1 className="text-xl font-semibold">Sign in or sign up</h1>
          <p className="mt-1 text-sm text-zinc-500">New here? Signing in creates your account.</p>
        </div>

        {params["check-email"] && (
          <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700 dark:bg-green-950 dark:text-green-300">
            Check your inbox for a sign-in link.
          </p>
        )}
        {params.error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
            {errorMessages[params.error] ?? "Sign-in failed. Please try again."}
          </p>
        )}

        {authFlags.google && (
          <form action={signInWithGoogle}>
            <SubmitButton variant="secondary" className="w-full" pendingText="Redirecting…">
              Continue with Google
            </SubmitButton>
          </form>
        )}

        {authFlags.email && (
          <form action={signInWithEmail} className="space-y-2">
            <label htmlFor="email" className="block text-sm font-medium">
              Email
            </label>
            <Input id="email" name="email" type="email" required placeholder="you@example.com" />
            <SubmitButton className="w-full" pendingText="Sending link…">
              Email me a sign-in link
            </SubmitButton>
          </form>
        )}

        {authFlags.demo && (
          <form action={signInAsDemo} className="border-t border-zinc-200 pt-5 dark:border-zinc-800">
            <SubmitButton variant="secondary" className="w-full" pendingText="Signing in…">
              Try the demo account
            </SubmitButton>
            <p className="mt-2 text-center text-xs text-zinc-500">Shared sandbox — no sign-up needed.</p>
          </form>
        )}

        {noProviders && (
          <p className="text-sm text-zinc-500">
            No sign-in method is configured. Set <code>AUTH_GOOGLE_ID</code>,{" "}
            <code>RESEND_API_KEY</code> or <code>DEMO_LOGIN_ENABLED=true</code> in <code>.env</code>.
          </p>
        )}
      </Card>
    </main>
  );
}
