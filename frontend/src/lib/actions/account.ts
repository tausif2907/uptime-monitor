"use server";

import { prisma } from "@uptime/database";
import { passwordSchema, PASSWORD_MAX } from "@uptime/shared";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import QRCode from "qrcode";
import { z } from "zod";
import { isDemoEmail } from "@/lib/demo";
import { fromZodError, type FormState } from "@/lib/form-state";
import { consume, retryMessage } from "@/lib/rate-limit";
import { requireUser } from "@/lib/session";
import {
  encryptSecret,
  newBackupCodes,
  newTotpSecret,
  otpauthUri,
  verifySecondFactor,
  verifyTotpCode,
} from "@/lib/two-factor";

const DEMO_LOCKED = "Account settings are locked on the shared demo account. Sign up to use them.";

async function requireRealUser() {
  const user = await requireUser();
  return { user, locked: isDemoEmail(user.email) };
}

async function codeLimit(userId: string) {
  return consume([{ key: `2fa-manage:${userId}`, limit: 10, windowSec: 15 * 60 }]);
}

export async function updateProfile(_prev: FormState, formData: FormData): Promise<FormState> {
  const { user, locked } = await requireRealUser();
  if (locked) return { error: DEMO_LOCKED };
  const name = z.string().trim().min(1, "Enter your name").max(80).safeParse(formData.get("name"));
  if (!name.success) return { fieldErrors: { name: [name.error.issues[0]!.message] } };
  await prisma.user.update({ where: { id: user.id }, data: { name: name.data } });
  revalidatePath("/account");
  return { message: "Profile saved." };
}

export async function changePassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const { user, locked } = await requireRealUser();
  if (locked) return { error: DEMO_LOCKED };
  const limit = await consume([{ key: `pw-change:${user.id}`, limit: 5, windowSec: 15 * 60 }]);
  if (limit.blocked) return { error: retryMessage(limit.retryAfterSec) };

  const parsed = z
    .object({ current: z.string().max(PASSWORD_MAX).optional(), password: passwordSchema })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fromZodError(parsed.error);

  if (user.passwordHash) {
    const ok = await bcrypt.compare(parsed.data.current ?? "", user.passwordHash);
    if (!ok) return { fieldErrors: { current: ["Current password is incorrect."] } };
  }
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await bcrypt.hash(parsed.data.password, 12) },
  });
  revalidatePath("/account");
  return { message: user.passwordHash ? "Password changed." : "Password set — you can now sign in with email and password." };
}

export type TwoFactorSetup = { error?: string; secret?: string; qr?: string };

/** Step 1: create a pending secret and show it as a QR code. Not active until confirmed. */
export async function startTwoFactorSetup(): Promise<TwoFactorSetup> {
  const { user, locked } = await requireRealUser();
  if (locked) return { error: DEMO_LOCKED };
  if (!user.passwordHash) return { error: "Set a password first — two-factor protects password sign-in." };
  if (user.totpEnabledAt) return { error: "Two-factor authentication is already on." };

  const secret = newTotpSecret();
  await prisma.user.update({
    where: { id: user.id },
    data: { totpSecret: encryptSecret(secret), totpEnabledAt: null, totpLastStep: null },
  });
  const qr = await QRCode.toDataURL(otpauthUri(secret, user.email), { margin: 1, width: 220 });
  return { secret, qr };
}

export type TwoFactorConfirm = FormState & { backupCodes?: string[] };

/** Step 2: prove the app is set up by entering a code; returns backup codes ONCE. */
export async function confirmTwoFactor(_prev: TwoFactorConfirm, formData: FormData): Promise<TwoFactorConfirm> {
  const { user, locked } = await requireRealUser();
  if (locked) return { error: DEMO_LOCKED };
  if (!user.totpSecret || user.totpEnabledAt) return { error: "Start the setup again." };
  const limit = await codeLimit(user.id);
  if (limit.blocked) return { error: retryMessage(limit.retryAfterSec) };

  const step = verifyTotpCode(user.totpSecret, String(formData.get("code") ?? ""), null);
  if (step === null) return { fieldErrors: { code: ["That code didn't match. Try the newest code in your app."] } };

  const { codes, hashes } = newBackupCodes();
  await prisma.user.update({
    where: { id: user.id },
    data: { totpEnabledAt: new Date(), totpLastStep: step, backupCodes: hashes },
  });
  // No revalidatePath here: re-rendering the page would swap this card out and hide the
  // backup codes before the user saved them. The client refreshes after "I've saved them".
  return { message: "Two-factor authentication is on.", backupCodes: codes };
}

export async function disableTwoFactor(_prev: FormState, formData: FormData): Promise<FormState> {
  const { user, locked } = await requireRealUser();
  if (locked) return { error: DEMO_LOCKED };
  const limit = await codeLimit(user.id);
  if (limit.blocked) return { error: retryMessage(limit.retryAfterSec) };
  if (!(await verifySecondFactor(user, String(formData.get("code") ?? "")))) {
    return { fieldErrors: { code: ["Enter a current authenticator code or an unused backup code."] } };
  }
  await prisma.user.update({
    where: { id: user.id },
    data: { totpSecret: null, totpEnabledAt: null, totpLastStep: null, backupCodes: [] },
  });
  revalidatePath("/account");
  return { message: "Two-factor authentication is off." };
}

export async function regenerateBackupCodes(_prev: TwoFactorConfirm, formData: FormData): Promise<TwoFactorConfirm> {
  const { user, locked } = await requireRealUser();
  if (locked) return { error: DEMO_LOCKED };
  const limit = await codeLimit(user.id);
  if (limit.blocked) return { error: retryMessage(limit.retryAfterSec) };
  if (!(await verifySecondFactor(user, String(formData.get("code") ?? "")))) {
    return { fieldErrors: { code: ["Enter a current authenticator code."] } };
  }
  const { codes, hashes } = newBackupCodes();
  // Re-read: verifySecondFactor may have consumed a backup code.
  await prisma.user.update({ where: { id: user.id }, data: { backupCodes: hashes } });
  return { message: "New backup codes generated. The old ones no longer work.", backupCodes: codes };
}
