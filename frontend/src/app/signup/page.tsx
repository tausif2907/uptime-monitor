import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { SignUpForm } from "@/components/auth/auth-forms";
import { AuthShell, Divider } from "@/components/auth/auth-shell";
import { anyOAuth, OAuthButtons } from "@/components/auth/oauth-buttons";

export const metadata: Metadata = { title: "Create your account" };

export default async function SignUpPage() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  return (
    <AuthShell
      title="Create your free account"
      subtitle="Start monitoring your first website in under a minute."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-brand-600 hover:underline">Sign in</Link>
        </>
      }
    >
      <OAuthButtons verb="Sign up" />
      {anyOAuth() && <Divider label="or with email" />}
      <SignUpForm />
    </AuthShell>
  );
}
