import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@uptime/database";
import bcrypt from "bcryptjs";
import NextAuth, { type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import Resend from "next-auth/providers/resend";

export const authFlags = {
  google: Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET),
  email: Boolean(process.env.RESEND_API_KEY),
  demo: process.env.DEMO_LOGIN_ENABLED === "true",
};

const providers: NextAuthConfig["providers"] = [];

if (authFlags.google) providers.push(Google);

if (authFlags.email) {
  // Passwordless "magic link" sign-in; also how new users sign up without Google.
  providers.push(
    Resend({
      apiKey: process.env.RESEND_API_KEY,
      from: process.env.EMAIL_FROM ?? "Uptime Monitor <onboarding@resend.dev>",
    }),
  );
}

if (authFlags.demo) {
  // Only accounts with a passwordHash (the seeded demo user) can log in this way.
  providers.push(
    Credentials({
      id: "demo",
      name: "Demo account",
      credentials: { email: {}, password: {} },
      async authorize(credentials) {
        const email = String(credentials?.email ?? "").toLowerCase();
        const password = String(credentials?.password ?? "");
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user?.passwordHash) return null;
        const valid = await bcrypt.compare(password, user.passwordHash);
        return valid ? { id: user.id, email: user.email, name: user.name } : null;
      },
    }),
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  // JWT sessions are required by the Credentials provider and keep auth checks DB-free.
  session: { strategy: "jwt" },
  providers,
  pages: { signIn: "/login", verifyRequest: "/login?check-email=1" },
  callbacks: {
    jwt({ token, user }) {
      if (user?.id) token.sub = user.id;
      return token;
    },
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      return session;
    },
  },
});
