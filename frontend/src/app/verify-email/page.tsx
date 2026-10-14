import { CheckCircle2, XCircle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@uptime/database";
import { emailSchema } from "@uptime/shared";
import { AuthShell } from "@/components/auth/auth-shell";
import { buttonClass } from "@/components/ui";
import { consumeToken } from "@/lib/tokens";

export const metadata: Metadata = { title: "Verify email" };
export const dynamic = "force-dynamic";

async function verify(rawEmail?: string, token?: string): Promise<boolean> {
  const email = emailSchema.safeParse(rawEmail);
  if (!email.success || !token || token.length > 200) return false;
  if (!(await consumeToken("verify", email.data, token))) return false;
  await prisma.user.updateMany({
    where: { email: email.data, emailVerified: null },
    data: { emailVerified: new Date() },
  });
  return true;
}

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; token?: string }>;
}) {
  const { email, token } = await searchParams;
  const ok = await verify(email, token);

  return (
    <AuthShell title={ok ? "You're all set!" : "Link not valid"}>
      <div className="space-y-4 text-center">
        {ok ? (
          <>
            <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-500" />
            <p className="text-zinc-600 dark:text-zinc-400">Your email is verified. Sign in to add your first monitor.</p>
            <Link href="/login?verified=1" className={buttonClass("primary", "w-full")}>Continue to sign in</Link>
          </>
        ) : (
          <>
            <XCircle className="mx-auto h-14 w-14 text-red-500" />
            <p className="text-zinc-600 dark:text-zinc-400">
              This verification link has expired or was already used. Try signing in — you can request a new link from there.
            </p>
            <Link href="/login" className={buttonClass("secondary", "w-full")}>Go to sign in</Link>
          </>
        )}
      </div>
    </AuthShell>
  );
}
