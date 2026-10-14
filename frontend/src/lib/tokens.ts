import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@uptime/database";

export type TokenPurpose = "verify" | "reset";

const TTL_MINUTES: Record<TokenPurpose, number> = { verify: 24 * 60, reset: 30 };

const hash = (raw: string) => createHash("sha256").update(raw).digest("hex");
const identifier = (purpose: TokenPurpose, email: string) => `${purpose}:${email}`;

/**
 * Single-use token for email verification / password reset.
 * Only a SHA-256 hash is stored, so a database leak doesn't leak usable links.
 * Issuing a new token invalidates older ones for the same purpose + email.
 */
export async function issueToken(purpose: TokenPurpose, email: string): Promise<string> {
  const raw = randomBytes(32).toString("base64url");
  await prisma.$transaction([
    prisma.verificationToken.deleteMany({ where: { identifier: identifier(purpose, email) } }),
    prisma.verificationToken.create({
      data: {
        identifier: identifier(purpose, email),
        token: hash(raw),
        expires: new Date(Date.now() + TTL_MINUTES[purpose] * 60_000),
      },
    }),
  ]);
  return raw;
}

/** Atomically consume a token: true only for the first valid, unexpired use. */
export async function consumeToken(purpose: TokenPurpose, email: string, raw: string): Promise<boolean> {
  const { count } = await prisma.verificationToken.deleteMany({
    where: { identifier: identifier(purpose, email), token: hash(raw), expires: { gt: new Date() } },
  });
  return count === 1;
}
