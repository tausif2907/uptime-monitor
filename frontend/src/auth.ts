import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@uptime/database";
import { emailSchema, signInSchema } from "@uptime/shared";
import bcrypt from "bcryptjs";
import NextAuth, { CredentialsSignin, type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import Resend from "next-auth/providers/resend";
import { actionEmailHtml, sendEmail } from "@/lib/email";
import { consume, isBlocked, loginLimits, reset } from "@/lib/rate-limit";
import { ipFromHeaders } from "@/lib/request";
import { verifySecondFactor } from "@/lib/two-factor";

// --- Production safety: refuse to run with a missing or placeholder secret -------------------
const secret = process.env.AUTH_SECRET ?? "";
if (
  process.env.NODE_ENV === "production" &&
  process.env.NEXT_PHASE !== "phase-production-build" &&
  (secret.length < 32 || secret.startsWith("replace-me"))
) {
  throw new Error("AUTH_SECRET must be a random string of 32+ characters (run: npx auth secret)");
}

// The demo account is public by design, but never with the well-known default password in
// production (that would let anyone log in through the credentials endpoint with it forever).
const DEFAULT_DEMO_PASSWORD = "demo-password";
const demoPasswordOk =
  process.env.NODE_ENV !== "production" ||
  (!!process.env.DEMO_PASSWORD && process.env.DEMO_PASSWORD !== DEFAULT_DEMO_PASSWORD);
if (process.env.DEMO_LOGIN_ENABLED === "true" && !demoPasswordOk) {
  console.warn("[auth] Demo login disabled: set DEMO_PASSWORD to a non-default value in production.");
}

export const authFlags = {
  google: Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET),
  github: Boolean(process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET),
  magicLink: Boolean(process.env.RESEND_API_KEY),
  demo: process.env.DEMO_LOGIN_ENABLED === "true" && demoPasswordOk,
};

/** Thrown when the password is right but the email isn't verified yet. */
class EmailNotVerified extends CredentialsSignin {
  code = "unverified";
}
class TooManyAttempts extends CredentialsSignin {
  code = "rate_limited";
}
class TwoFactorRequired extends CredentialsSignin {
  code = "2fa_required";
}
class TwoFactorInvalid extends CredentialsSignin {
  code = "2fa_invalid";
}

// A real bcrypt hash compared against when the user doesn't exist, so "no such account" and
// "wrong password" take the same time (no account enumeration via response timing).
const DUMMY_HASH = "$2a$12$mirUkJsiYr9xny6/s0EfsumHoOy6LcErgGNj8KsKBzQj6.PYflTLu";

const providers: NextAuthConfig["providers"] = [
  Credentials({
    id: "credentials",
    name: "Email and password",
    credentials: { email: {}, password: {} },
    async authorize(credentials, request) {
      const parsed = signInSchema.safeParse(credentials);
      if (!parsed.success) return null;
      const { email, password } = parsed.data;

      const limits = loginLimits(email, ipFromHeaders(request.headers));
      if (await isBlocked(limits)) throw new TooManyAttempts();

      const user = await prisma.user.findUnique({ where: { email } });
      const valid = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
      if (!user?.passwordHash || !valid) {
        await consume(limits); // only failures count towards the lockout
        return null;
      }
      if (!user.emailVerified) throw new EmailNotVerified();

      if (user.totpEnabledAt) {
        const code = parsed.data.code;
        if (!code) throw new TwoFactorRequired(); // password was right: ask for the second factor
        if (!(await verifySecondFactor(user, code))) {
          await consume(limits);
          throw new TwoFactorInvalid();
        }
      }

      await reset([`login:email:${email}`]);
      return { id: user.id, email: user.email, name: user.name, image: user.image };
    },
  }),
];

if (authFlags.google) {
  // Google only returns verified addresses, so linking to an existing account by email is safe
  // (an unverified password account with that email is neutralised in callbacks.signIn below).
  providers.push(Google({ allowDangerousEmailAccountLinking: true }));
}

if (authFlags.github) providers.push(GitHub);

if (authFlags.magicLink) {
  providers.push(
    Resend({
      apiKey: process.env.RESEND_API_KEY,
      from: process.env.EMAIL_FROM ?? "Uptime Monitor <onboarding@resend.dev>",
      maxAge: 15 * 60,
      // Normalise exactly like sign-up does (NFKC + lower-case + ASCII only).
      normalizeIdentifier: (identifier) => emailSchema.parse(identifier),
      async sendVerificationRequest({ identifier, url }) {
        const { blocked } = await consume([{ key: `magic:${identifier}`, limit: 3, windowSec: 15 * 60 }]);
        if (blocked) throw new Error("Too many sign-in emails requested");
        await sendEmail({
          to: identifier,
          subject: "Your Uptime Monitor sign-in link",
          text: `Sign in to Uptime Monitor:\n${url}\n\nThis link expires in 15 minutes. If you didn't request it, ignore this email.`,
          html: actionEmailHtml({
            heading: "Sign in to Uptime Monitor",
            body: "Click the button below to sign in. The link expires in 15 minutes and can only be used once.",
            cta: "Sign in",
            url,
          }),
        });
      },
    }),
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  // JWT sessions are required by the Credentials provider and keep auth checks DB-free.
  session: { strategy: "jwt", maxAge: 14 * 24 * 60 * 60 },
  providers,
  pages: { signIn: "/login", verifyRequest: "/login?check-email=1", error: "/login" },
  callbacks: {
    async signIn({ user, account, email }) {
      // Magic links would skip the authenticator code; accounts with 2FA must use their password.
      if (account?.provider === "resend" && user.email) {
        const existing = await prisma.user.findUnique({ where: { email: user.email.toLowerCase() } });
        if (existing?.totpEnabledAt) return "/login?error=TwoFactorUsePassword";
      }
      // An email someone signed up with but never verified could belong to somebody else.
      // When the real owner proves ownership (Google, magic link, ...), drop that password so
      // the person who created it can't get in ("pre-account-takeover" protection).
      if (account && account.provider !== "credentials" && !email?.verificationRequest && user.email) {
        await prisma.user.updateMany({
          where: { email: user.email.toLowerCase(), emailVerified: null, passwordHash: { not: null } },
          data: { passwordHash: null },
        });
      }
      return true;
    },
    jwt({ token, user }) {
      if (user?.id) token.sub = user.id;
      return token;
    },
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      return session;
    },
  },
  events: {
    // Accounts created through Google/GitHub have a provider-verified email.
    async linkAccount({ user }) {
      if (user.id) {
        await prisma.user.updateMany({
          where: { id: user.id, emailVerified: null },
          data: { emailVerified: new Date() },
        });
      }
    },
  },
});
