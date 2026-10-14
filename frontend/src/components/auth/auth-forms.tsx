"use client";

import { Eye, EyeOff, KeyRound, Mail, MailCheck, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useActionState, useState } from "react";
import { SubmitButton } from "@/components/submit-button";
import { Alert, cx, Field, FormError, Input } from "@/components/ui";
import {
  requestPasswordReset,
  resendVerification,
  resetPassword,
  signInWithMagicLink,
  signInWithPassword,
  signUp,
} from "@/lib/actions/auth";
import type { FormState } from "@/lib/form-state";

const initial: FormState = {};

function DevLink({ href }: { href?: string }) {
  if (!href) return null;
  return (
    <Alert tone="warning">
      <p className="font-medium">Development mode — no email provider configured.</p>
      <p className="mt-1">
        The email would contain this link:{" "}
        <a href={href} className="break-all font-medium underline">
          open it
        </a>
      </p>
    </Alert>
  );
}

function PasswordInput({
  id,
  name,
  autoComplete,
  value,
  onChange,
  invalid,
}: {
  id: string;
  name: string;
  autoComplete: string;
  value: string;
  onChange: (v: string) => void;
  invalid?: boolean;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input
        id={id}
        name={name}
        type={show ? "text" : "password"}
        autoComplete={autoComplete}
        required
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={invalid}
        className="pr-10"
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
        aria-label={show ? "Hide password" : "Show password"}
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

/** Rough strength feedback; the server enforces the real policy. */
function strength(pw: string): { score: number; label: string } {
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^a-zA-Z0-9]/.test(pw)) score++;
  const labels = ["Too short", "Weak", "Okay", "Good", "Strong", "Excellent"];
  return { score, label: labels[score]! };
}

function StrengthMeter({ password }: { password: string }) {
  if (!password) return null;
  const { score, label } = strength(password);
  const color = score <= 1 ? "bg-red-500" : score <= 2 ? "bg-amber-500" : score <= 3 ? "bg-lime-500" : "bg-emerald-500";
  return (
    <div className="space-y-1" aria-live="polite">
      <div className="flex gap-1">
        {Array.from({ length: 5 }, (_, i) => (
          <span key={i} className={cx("h-1.5 flex-1 rounded-full transition", i < score ? color : "bg-zinc-200 dark:bg-zinc-800")} />
        ))}
      </div>
      <p className="text-xs text-zinc-500">
        Strength: <span className="font-medium">{label}</span> · 8+ characters with a letter and a number
      </p>
    </div>
  );
}

export function SignInForm() {
  const [state, action] = useActionState(signInWithPassword, initial);
  // Controlled inputs: React resets uncontrolled forms after an action, but on the 2FA step we
  // need to resubmit the same email + password together with the code.
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const needsCode = state.code === "2fa_required" || state.code === "2fa_invalid";

  return (
    <form action={action} className="space-y-4">
      {state.error && !needsCode && <FormError message={state.error} />}
      {state.code === "unverified" && <ResendVerificationInline email={email} />}
      <Field label="Email" htmlFor="email" errors={state.fieldErrors?.email}>
        <Input id="email" name="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
      </Field>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label htmlFor="password" className="text-sm font-medium">Password</label>
          <Link href="/forgot-password" className="text-xs font-medium text-brand-600 hover:underline">Forgot password?</Link>
        </div>
        <PasswordInput id="password" name="password" autoComplete="current-password" value={password} onChange={setPassword} />
      </div>
      {needsCode && (
        <div className="space-y-3 rounded-xl border border-brand-200 bg-brand-50/50 p-4 animate-slide-up dark:border-brand-700/40 dark:bg-brand-600/5">
          <p className="flex items-center gap-2 text-sm font-medium">
            <ShieldCheck className="h-4 w-4 text-brand-600" /> Two-factor authentication
          </p>
          {state.code === "2fa_invalid" && <FormError message={state.error} />}
          <Field label="6-digit code from your authenticator app" htmlFor="code" hint="Lost your phone? Enter one of your backup codes instead.">
            <Input id="code" name="code" inputMode="numeric" autoComplete="one-time-code" autoFocus required placeholder="123 456" />
          </Field>
        </div>
      )}
      <SubmitButton className="w-full" pendingText="Signing in…">
        {needsCode ? "Verify and sign in" : "Sign in"}
      </SubmitButton>
    </form>
  );
}

function ResendVerificationInline({ email }: { email: string }) {
  const [state, action] = useActionState(resendVerification, initial);
  return (
    <Alert tone="warning">
      <p>Please verify your email first — check your inbox for our link.</p>
      <form action={action} className="mt-2">
        <input type="hidden" name="email" value={email} />
        <SubmitButton variant="ghost" className="px-0 py-0 text-sm underline" pendingText="Sending…">
          Resend verification email
        </SubmitButton>
      </form>
      {state.message && <p className="mt-2 font-medium">{state.message}</p>}
      {state.error && <p className="mt-2 font-medium text-red-600">{state.error}</p>}
      <DevLink href={state.devLink} />
    </Alert>
  );
}

export function SignUpForm() {
  const [state, action] = useActionState(signUp, initial);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  if (state.message) {
    return (
      <div className="space-y-4 text-center animate-slide-up">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-600/10">
          <MailCheck className="h-7 w-7" />
        </span>
        <h2 className="text-lg font-semibold">Check your inbox</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">{state.message}</p>
        <DevLink href={state.devLink} />
        <p className="text-xs text-zinc-500">Didn&apos;t get it? Check spam, or sign in to resend it.</p>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <FormError message={state.error} />
      <Field label="Your name" htmlFor="name" errors={state.fieldErrors?.name}>
        <Input id="name" name="name" autoComplete="name" required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} placeholder="Tausif Ansari" />
      </Field>
      <Field label="Email" htmlFor="email" errors={state.fieldErrors?.email}>
        <Input id="email" name="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
      </Field>
      <Field label="Password" htmlFor="password" errors={state.fieldErrors?.password}>
        <PasswordInput id="password" name="password" autoComplete="new-password" value={password} onChange={setPassword} invalid={!!state.fieldErrors?.password} />
      </Field>
      <StrengthMeter password={password} />
      <SubmitButton className="w-full" pendingText="Creating account…">
        Create account
      </SubmitButton>
      <p className="text-center text-xs text-zinc-500">We&apos;ll email you a link to verify your address.</p>
    </form>
  );
}

export function MagicLinkForm() {
  const [state, action] = useActionState(signInWithMagicLink, initial);
  if (state.message) {
    return (
      <Alert tone="success" className="animate-slide-up">
        <p className="flex items-center gap-2 font-medium">
          <MailCheck className="h-4 w-4" /> Link sent
        </p>
        <p className="mt-1">{state.message}</p>
      </Alert>
    );
  }
  return (
    <form action={action} className="space-y-3">
      <FormError message={state.error} />
      <Field label="Email me a sign-in link" htmlFor="magic-email" errors={state.fieldErrors?.email}>
        <Input id="magic-email" name="email" type="email" autoComplete="email" required placeholder="you@example.com" />
      </Field>
      <SubmitButton variant="secondary" className="w-full" pendingText="Sending link…">
        <Mail className="h-4 w-4" /> Send magic link
      </SubmitButton>
    </form>
  );
}

export function ForgotPasswordForm() {
  const [state, action] = useActionState(requestPasswordReset, initial);
  if (state.message) {
    return (
      <div className="space-y-4">
        <Alert tone="success">{state.message}</Alert>
        <DevLink href={state.devLink} />
      </div>
    );
  }
  return (
    <form action={action} className="space-y-4">
      <FormError message={state.error} />
      <Field label="Email" htmlFor="email" errors={state.fieldErrors?.email}>
        <Input id="email" name="email" type="email" autoComplete="email" required placeholder="you@example.com" />
      </Field>
      <SubmitButton className="w-full" pendingText="Sending…">
        Send reset link
      </SubmitButton>
    </form>
  );
}

export function ResetPasswordForm({ email, token }: { email: string; token: string }) {
  const [state, action] = useActionState(resetPassword, initial);
  const [password, setPassword] = useState("");
  return (
    <form action={action} className="space-y-4">
      <FormError message={state.error} />
      <input type="hidden" name="email" value={email} />
      <input type="hidden" name="token" value={token} />
      <p className="text-sm text-zinc-500">
        Choosing a new password for <span className="font-medium text-zinc-900 dark:text-zinc-100">{email}</span>
      </p>
      <Field label="New password" htmlFor="password" errors={state.fieldErrors?.password}>
        <PasswordInput id="password" name="password" autoComplete="new-password" value={password} onChange={setPassword} />
      </Field>
      <StrengthMeter password={password} />
      <SubmitButton className="w-full" pendingText="Saving…">
        <KeyRound className="h-4 w-4" /> Save new password
      </SubmitButton>
    </form>
  );
}
