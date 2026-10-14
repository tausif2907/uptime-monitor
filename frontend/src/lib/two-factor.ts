import { randomBytes } from "node:crypto";
import { prisma, type User } from "@uptime/database";
import { Secret, TOTP } from "otpauth";
import { decrypt, encrypt, safeEqual, sha256 } from "./crypto";

const ISSUER = "Uptime Monitor";
const PERIOD = 30;

function totpFor(secretBase32: string, label = "account") {
  return new TOTP({
    issuer: ISSUER,
    label,
    algorithm: "SHA1", // what every authenticator app supports
    digits: 6,
    period: PERIOD,
    secret: Secret.fromBase32(secretBase32),
  });
}

export function newTotpSecret(): string {
  return new Secret({ size: 20 }).base32;
}

export function otpauthUri(secretBase32: string, email: string): string {
  return totpFor(secretBase32, email).toString();
}

export const encryptSecret = encrypt;

/**
 * Validate a 6-digit code (±1 step of clock drift). Returns the matched time step, or null.
 * Codes at or before `lastStep` are rejected, so a code seen over someone's shoulder can't be
 * replayed within its 30-second window.
 */
export function verifyTotpCode(encryptedSecret: string, code: string, lastStep: number | null): number | null {
  const token = code.replace(/\s+/g, "");
  if (!/^\d{6}$/.test(token)) return null;
  const delta = totpFor(decrypt(encryptedSecret)).validate({ token, window: 1 });
  if (delta === null) return null;
  const step = Math.floor(Date.now() / 1000 / PERIOD) + delta;
  if (lastStep !== null && step <= lastStep) return null;
  return step;
}

/** Ten one-time backup codes like "k7q2-m9xd". Only their SHA-256 hashes are stored. */
export function newBackupCodes(): { codes: string[]; hashes: string[] } {
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
  const codes = Array.from({ length: 10 }, () => {
    const bytes = randomBytes(8);
    const chars = Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
    return `${chars.slice(0, 4)}-${chars.slice(4, 8)}`;
  });
  return { codes, hashes: codes.map((c) => sha256(c)) };
}

const normaliseBackup = (code: string) => code.trim().toLowerCase().replace(/[^a-z0-9]/g, "").replace(/^(.{4})(.{4})$/, "$1-$2");

/**
 * Check a second factor for a user with 2FA enabled (authenticator code OR backup code) and
 * record its use. Returns false for anything invalid or already used.
 */
export async function verifySecondFactor(user: User, code: string): Promise<boolean> {
  if (!user.totpSecret || !user.totpEnabledAt) return false;

  const step = verifyTotpCode(user.totpSecret, code, user.totpLastStep);
  if (step !== null) {
    // Conditional update: two concurrent logins can't both use the same step.
    const { count } = await prisma.user.updateMany({
      where: { id: user.id, OR: [{ totpLastStep: null }, { totpLastStep: { lt: step } }] },
      data: { totpLastStep: step },
    });
    return count === 1;
  }

  const hashed = sha256(normaliseBackup(code));
  const match = user.backupCodes.find((h) => safeEqual(h, hashed));
  if (!match) return false;
  await prisma.user.update({
    where: { id: user.id },
    data: { backupCodes: user.backupCodes.filter((h) => h !== match) },
  });
  return true;
}
