import { prisma } from "@uptime/database";
import { KeyRound, Link2, ShieldCheck, User } from "lucide-react";
import type { Metadata } from "next";
import {
  PasswordForm,
  ProfileForm,
  TwoFactorManageCard,
  TwoFactorSetupCard,
} from "@/components/forms/account-forms";
import { Alert, Badge, Card, PageHeader } from "@/components/ui";
import { isDemoEmail } from "@/lib/demo";
import { formatDateTime } from "@/lib/format";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Account & security" };

function Section({ icon, title, description, children }: { icon: React.ReactNode; title: string; description?: string; children: React.ReactNode }) {
  return (
    <Card className="p-6">
      <div className="mb-4 flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-600/10 dark:text-brand-400">{icon}</span>
        <div>
          <h2 className="font-semibold">{title}</h2>
          {description && <p className="text-sm text-zinc-500">{description}</p>}
        </div>
      </div>
      {children}
    </Card>
  );
}

export default async function AccountPage() {
  const user = await requireUser();
  const accounts = await prisma.account.findMany({ where: { userId: user.id }, select: { provider: true } });
  const demo = isDemoEmail(user.email);
  const hasPassword = Boolean(user.passwordHash);

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader title="Account & security" description={user.email} />
      {demo && <Alert tone="warning">Account settings are locked on the shared demo account.</Alert>}

      <Section icon={<User className="h-4 w-4" />} title="Profile">
        <ProfileForm name={user.name ?? ""} />
        <p className="mt-3 text-xs text-zinc-500">Member since {formatDateTime(user.createdAt)}</p>
      </Section>

      <Section icon={<Link2 className="h-4 w-4" />} title="Sign-in methods" description="Ways you can sign in to this account.">
        <div className="flex flex-wrap gap-2">
          {hasPassword && <Badge className="px-2.5 py-1">Email + password</Badge>}
          {accounts.map((a) => (
            <Badge key={a.provider} className="px-2.5 py-1 capitalize">
              {a.provider === "resend" ? "Email link" : a.provider}
            </Badge>
          ))}
          {!hasPassword && accounts.length === 0 && <span className="text-sm text-zinc-500">Email sign-in link</span>}
        </div>
      </Section>

      {!demo && (
        <Section icon={<KeyRound className="h-4 w-4" />} title={hasPassword ? "Change password" : "Set a password"} description={hasPassword ? undefined : "Add a password so you can also sign in with email + password (and enable 2FA)."}>
          <PasswordForm hasPassword={hasPassword} />
        </Section>
      )}

      {!demo && (
        <Section icon={<ShieldCheck className="h-4 w-4" />} title="Two-factor authentication (2FA)" description="Protect your account even if your password leaks.">
          {user.totpEnabledAt ? (
            <TwoFactorManageCard backupCodesLeft={user.backupCodes.length} />
          ) : (
            <TwoFactorSetupCard hasPassword={hasPassword} />
          )}
        </Section>
      )}
    </div>
  );
}
