"use server";

import { prisma } from "@uptime/database";
import { emailSchema, resetPasswordSchema, signInSchema, signUpSchema } from "@uptime/shared";
import bcrypt from "bcryptjs";
import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { signIn, signOut } from "@/auth";
import { actionEmailHtml, emailConfigured, trySendEmail } from "@/lib/email";
import { fromZodError, type FormState } from "@/lib/form-state";
import { consume, ipLimit, retryMessage } from "@/lib/rate-limit";
import { appUrl, clientIp } from "@/lib/request";
import { consumeToken, issueToken } from "@/lib/tokens";

const BCRYPT_COST = 12;
// Show emailed links in the UI only when no email was actually sent AND we're in local dev
// (or an automated test run explicitly opts in). Never set E2E_SHOW_EMAIL_LINKS in production.
const showLinks = process.env.NODE_ENV !== "production" || process.env.E2E_SHOW_EMAIL_LINKS === "true";

/** In local development without an email provider, hand the link to the UI instead. */
const devLink = (delivered: boolean, url: string) => (!delivered && showLinks ? url : undefined);

const EMAIL_FAILED =
  "We couldn't send the email right now. Please check the address and try again in a few minutes.";

const credentialErrors: Record<string, string> = {
  unverified: "Please verify your email first — we sent you a link when you signed up.",
  rate_limited: "Too many failed attempts. Please wait 15 minutes or reset your password.",
  credentials: "Incorrect email or password.",
  "2fa_required": "Enter the 6-digit code from your authenticator app (or a backup code).",
  "2fa_invalid": "That code didn't work. Check your authenticator app's clock or use a backup code.",
};

// --- Email + password ----------------------------------------------------------------------

export async function signInWithPassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = signInSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fromZodError(parsed.error);
  try {
    await signIn("credentials", { ...parsed.data, redirectTo: "/dashboard" });
    return {};
  } catch (err) {
    if (err instanceof AuthError) {
      const code = (err as AuthError & { code?: string }).code ?? "credentials";
      return { error: credentialErrors[code] ?? credentialErrors.credentials, code };
    }
    throw err; // the success redirect is thrown as an error; let Next handle it
  }
}

export async function signUp(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = signUpSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fromZodError(parsed.error);
  const { name, email, password } = parsed.data;

  const limit = await consume([
    { key: `signup:ip:${await clientIp()}`, limit: ipLimit(5), windowSec: 60 * 60 },
    { key: `signup:email:${email}`, limit: 3, windowSec: 60 * 60 },
  ]);
  if (limit.blocked) return { error: retryMessage(limit.retryAfterSec) };

  const existing = await prisma.user.findUnique({ where: { email } });
  const sent: FormState = {
    message: `We sent a verification link to ${email}. Click it to activate your account.`,
  };

  if (existing?.emailVerified) {
    // Don't reveal that the account exists; tell the real owner by email instead.
    const { delivered } = await trySendEmail({
      to: email,
      subject: "You already have an Uptime Monitor account",
      text: `Someone (hopefully you) tried to sign up with this email. You already have an account — sign in at ${appUrl()}/login or reset your password at ${appUrl()}/forgot-password.`,
      html: actionEmailHtml({
        heading: "You already have an account",
        body: "Someone (hopefully you) tried to create a new account with this email address. Just sign in instead — or reset your password if you forgot it.",
        cta: "Sign in",
        url: `${appUrl()}/login`,
      }),
    });
    return { ...sent, devLink: devLink(delivered, `${appUrl()}/login`) };
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
  if (existing) {
    // Unverified account (e.g. sign-up never finished): the newest sign-up replaces it.
    await prisma.user.update({ where: { id: existing.id }, data: { name, passwordHash } });
  } else {
    await prisma.user.create({ data: { name, email, passwordHash } });
  }

  const url = await verificationUrl(email);
  const { delivered, failed } = await sendVerificationEmail(email, url);
  if (failed) return { error: EMAIL_FAILED };
  return { ...sent, devLink: devLink(delivered, url) };
}

async function verificationUrl(email: string) {
  const token = await issueToken("verify", email);
  return `${appUrl()}/verify-email?email=${encodeURIComponent(email)}&token=${token}`;
}

function sendVerificationEmail(email: string, url: string) {
  return trySendEmail({
    to: email,
    subject: "Verify your email for Uptime Monitor",
    text: `Welcome to Uptime Monitor! Verify your email to activate your account:\n${url}\n\nThe link expires in 24 hours.`,
    html: actionEmailHtml({
      heading: "Welcome to Uptime Monitor 👋",
      body: "Confirm your email address to activate your account. The link expires in 24 hours.",
      cta: "Verify email",
      url,
    }),
  });
}

export async function resendVerification(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = emailSchema.safeParse(formData.get("email"));
  if (!email.success) return { error: "Enter a valid email address." };
  const limit = await consume([{ key: `verify:resend:${email.data}`, limit: 3, windowSec: 60 * 60 }]);
  if (limit.blocked) return { error: retryMessage(limit.retryAfterSec) };

  const user = await prisma.user.findUnique({ where: { email: email.data } });
  const message = "If that account is waiting for verification, a new link is on its way.";
  if (!user || user.emailVerified || !user.passwordHash) return { message };
  const url = await verificationUrl(email.data);
  const { delivered, failed } = await sendVerificationEmail(email.data, url);
  if (failed) return { error: EMAIL_FAILED };
  return { message, devLink: devLink(delivered, url) };
}

export async function requestPasswordReset(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = emailSchema.safeParse(formData.get("email"));
  if (!email.success) return { fieldErrors: { email: ["Enter a valid email address."] } };

  const limit = await consume([
    { key: `reset:ip:${await clientIp()}`, limit: ipLimit(10), windowSec: 60 * 60 },
    { key: `reset:email:${email.data}`, limit: 3, windowSec: 60 * 60 },
  ]);
  if (limit.blocked) return { error: retryMessage(limit.retryAfterSec) };

  // Same answer whether or not the account exists (no account enumeration).
  const message = `If an account exists for ${email.data}, we've emailed a link to reset the password. It expires in 30 minutes.`;
  const user = await prisma.user.findUnique({ where: { email: email.data } });
  if (!user) return { message };

  const token = await issueToken("reset", email.data);
  const url = `${appUrl()}/reset-password?email=${encodeURIComponent(email.data)}&token=${token}`;
  const { delivered } = await trySendEmail({
    to: email.data,
    subject: "Reset your Uptime Monitor password",
    text: `Reset your password:\n${url}\n\nThis link expires in 30 minutes. If you didn't ask for this, ignore this email — your password won't change.`,
    html: actionEmailHtml({
      heading: "Reset your password",
      body: "Click the button below to choose a new password. The link expires in 30 minutes and works once.",
      cta: "Choose a new password",
      url,
      footer: "If you didn't ask for this, ignore this email — your password won't change.",
    }),
  });
  return { message, devLink: devLink(delivered, url) };
}

export async function resetPassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = resetPasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fromZodError(parsed.error);
  const { email, token, password } = parsed.data;

  const valid = await consumeToken("reset", email, token);
  if (!valid) return { error: "This reset link is invalid or has expired. Request a new one." };

  await prisma.user.update({
    where: { email },
    // Using the emailed link proves the person owns the address.
    data: { passwordHash: await bcrypt.hash(password, BCRYPT_COST), emailVerified: new Date() },
  });
  redirect("/login?reset=1");
}

// --- One-click providers ------------------------------------------------------------------

async function withAuthErrors(fn: () => Promise<unknown>) {
  try {
    await fn();
  } catch (err) {
    if (err instanceof AuthError) redirect(`/login?error=${err.type}`);
    throw err;
  }
}

export async function signInWithGoogle() {
  await withAuthErrors(() => signIn("google", { redirectTo: "/dashboard" }));
}

export async function signInWithGitHub() {
  await withAuthErrors(() => signIn("github", { redirectTo: "/dashboard" }));
}

export async function signInWithMagicLink(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = emailSchema.safeParse(formData.get("email"));
  if (!email.success) return { fieldErrors: { email: ["Enter a valid email address."] } };
  if (!emailConfigured()) return { error: "Email sign-in links aren't configured on this server." };
  await withAuthErrors(() => signIn("resend", { email: email.data, redirectTo: "/dashboard" }));
  return {};
}

/** One-click demo login with the seeded account (credentials come from server env, not the form). */
export async function signInAsDemo() {
  await withAuthErrors(() =>
    signIn("credentials", {
      email: process.env.DEMO_EMAIL ?? "demo@uptime.local",
      password: process.env.DEMO_PASSWORD ?? "demo-password",
      redirectTo: "/dashboard",
    }),
  );
}

export async function signOutAction() {
  await signOut({ redirectTo: "/" });
}
