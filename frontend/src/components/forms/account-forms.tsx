"use client";

import { Download, Loader2, QrCode, ShieldCheck, ShieldOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { CopyButton } from "@/components/copy-button";
import { SubmitButton } from "@/components/submit-button";
import { Alert, Button, Field, FormError, Input } from "@/components/ui";
import {
  changePassword,
  confirmTwoFactor,
  disableTwoFactor,
  regenerateBackupCodes,
  startTwoFactorSetup,
  updateProfile,
  type TwoFactorConfirm,
  type TwoFactorSetup,
} from "@/lib/actions/account";
import type { FormState } from "@/lib/form-state";

function useToast(state: FormState) {
  useEffect(() => {
    if (state.message) toast.success(state.message);
  }, [state]);
}

export function ProfileForm({ name }: { name: string }) {
  const [state, action] = useActionState(updateProfile, {});
  useToast(state);
  return (
    <form action={action} className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <div className="flex-1">
        <Field label="Display name" htmlFor="name" errors={state.fieldErrors?.name}>
          <Input id="name" name="name" defaultValue={name} maxLength={80} required />
        </Field>
      </div>
      <SubmitButton variant="secondary">Save</SubmitButton>
      {state.error && <FormError message={state.error} />}
    </form>
  );
}

export function PasswordForm({ hasPassword }: { hasPassword: boolean }) {
  const [state, action] = useActionState(changePassword, {});
  useToast(state);
  return (
    <form action={action} className="space-y-4">
      <FormError message={state.error} />
      {hasPassword && (
        <Field label="Current password" htmlFor="current" errors={state.fieldErrors?.current}>
          <Input id="current" name="current" type="password" autoComplete="current-password" required />
        </Field>
      )}
      <Field label={hasPassword ? "New password" : "Password"} htmlFor="password" errors={state.fieldErrors?.password} hint="8+ characters with at least one letter and one number.">
        <Input id="password" name="password" type="password" autoComplete="new-password" required />
      </Field>
      <SubmitButton variant="secondary">{hasPassword ? "Change password" : "Set password"}</SubmitButton>
    </form>
  );
}

function BackupCodes({ codes }: { codes: string[] }) {
  const text = codes.join("\n");
  return (
    <div className="space-y-3 rounded-xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/30">
      <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">Save your backup codes now</p>
      <p className="text-xs text-amber-800 dark:text-amber-300">
        Each code works once if you lose your phone. We only show them this one time.
      </p>
      <ul className="grid grid-cols-2 gap-2 font-mono text-sm">
        {codes.map((c) => (
          <li key={c} className="rounded-lg bg-white px-3 py-1.5 text-center dark:bg-zinc-900">{c}</li>
        ))}
      </ul>
      <div className="flex gap-2">
        <CopyButton value={text} label="Copy all" />
        <a
          href={`data:text/plain;charset=utf-8,${encodeURIComponent(`Uptime Monitor backup codes\n\n${text}\n`)}`}
          download="uptime-monitor-backup-codes.txt"
          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-zinc-600 hover:bg-white dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          <Download className="h-3.5 w-3.5" /> Download
        </a>
      </div>
    </div>
  );
}

export function TwoFactorSetupCard({ hasPassword }: { hasPassword: boolean }) {
  const router = useRouter();
  const [saved, setSaved] = useState(false);
  const [setup, setSetup] = useState<TwoFactorSetup | null>(null);
  const [pending, start] = useTransition();
  const [state, action] = useActionState<TwoFactorConfirm, FormData>(confirmTwoFactor, {});

  if (state.backupCodes && saved) {
    return (
      <Alert tone="success" className="animate-slide-up">
        <span className="inline-flex items-center gap-2 font-medium"><ShieldCheck className="h-4 w-4" /> Two-factor authentication is on.</span>{" "}
        {state.backupCodes.length} backup codes left. You&apos;ll be asked for a code next time you sign in.
      </Alert>
    );
  }

  if (state.backupCodes) {
    return (
      <div className="space-y-4">
        <Alert tone="success">
          <span className="inline-flex items-center gap-2 font-medium"><ShieldCheck className="h-4 w-4" /> Two-factor authentication is on.</span>
        </Alert>
        <BackupCodes codes={state.backupCodes} />
        <Button
          type="button"
          onClick={() => {
            // Show the confirmation right away; the refresh then swaps in the full "manage" card.
            setSaved(true);
            router.refresh();
          }}
        >
          I&apos;ve saved my backup codes
        </Button>
      </div>
    );
  }

  if (!setup?.qr) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Add a second step to sign-in: after your password, enter a 6-digit code from an authenticator app
          (Google Authenticator, Microsoft Authenticator, 1Password, Authy…).
        </p>
        {setup?.error && <FormError message={setup.error} />}
        <Button
          type="button"
          disabled={pending || !hasPassword}
          onClick={() => start(async () => setSetup(await startTwoFactorSetup()))}
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <QrCode className="h-4 w-4" />}
          Set up two-factor authentication
        </Button>
        {!hasPassword && <p className="text-xs text-zinc-500">Set a password first — 2FA protects email + password sign-in. (Google/GitHub sign-ins use their own 2FA.)</p>}
      </div>
    );
  }

  return (
    <div className="grid gap-6 animate-slide-up md:grid-cols-[auto_1fr]">
      <img src={setup.qr} alt="QR code for your authenticator app" width={180} height={180} className="rounded-xl border border-zinc-200 bg-white p-2 dark:border-zinc-700" />
      <div className="space-y-4">
        <ol className="list-decimal space-y-1 pl-5 text-sm text-zinc-600 dark:text-zinc-400">
          <li>Open your authenticator app and scan the QR code.</li>
          <li>Can&apos;t scan? Enter this key manually:</li>
        </ol>
        <div className="flex flex-wrap items-center gap-2">
          <code className="break-all rounded-lg bg-zinc-100 px-2 py-1 text-xs dark:bg-zinc-800">{setup.secret}</code>
          <CopyButton value={setup.secret ?? ""} />
        </div>
        <form action={action} className="space-y-3">
          <FormError message={state.error} />
          <Field label="3. Enter the 6-digit code it shows" htmlFor="code" errors={state.fieldErrors?.code}>
            <Input id="code" name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={7} required placeholder="123456" className="max-w-40 font-mono tracking-widest" />
          </Field>
          <SubmitButton pendingText="Verifying…">Turn on 2FA</SubmitButton>
        </form>
      </div>
    </div>
  );
}

export function TwoFactorManageCard({ backupCodesLeft }: { backupCodesLeft: number }) {
  const [disableState, disable] = useActionState(disableTwoFactor, {});
  const [regenState, regen] = useActionState<TwoFactorConfirm, FormData>(regenerateBackupCodes, {});
  useToast(disableState);
  useToast(regenState);

  return (
    <div className="space-y-5">
      <Alert tone="success">
        <span className="inline-flex items-center gap-2 font-medium"><ShieldCheck className="h-4 w-4" /> Two-factor authentication is on.</span>{" "}
        {backupCodesLeft} backup code{backupCodesLeft === 1 ? "" : "s"} left.
      </Alert>
      {regenState.backupCodes && <BackupCodes codes={regenState.backupCodes} />}
      <div className="grid gap-4 md:grid-cols-2">
        <form action={regen} className="space-y-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
          <p className="text-sm font-medium">New backup codes</p>
          <FormError message={regenState.error} />
          <Field label="Authenticator code" htmlFor="regen-code" errors={regenState.fieldErrors?.code}>
            <Input id="regen-code" name="code" inputMode="numeric" required placeholder="123456" />
          </Field>
          <SubmitButton variant="secondary">Generate new codes</SubmitButton>
        </form>
        <form action={disable} className="space-y-3 rounded-xl border border-red-200 p-4 dark:border-red-900/60">
          <p className="text-sm font-medium text-red-600">Turn off 2FA</p>
          <FormError message={disableState.error} />
          <Field label="Authenticator or backup code" htmlFor="disable-code" errors={disableState.fieldErrors?.code}>
            <Input id="disable-code" name="code" required placeholder="123456" />
          </Field>
          <SubmitButton variant="danger" confirm="Turn off two-factor authentication? Your account will be less secure.">
            <ShieldOff className="h-4 w-4" /> Turn off
          </SubmitButton>
        </form>
      </div>
    </div>
  );
}
