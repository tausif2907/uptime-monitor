"use server";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { signIn, signOut } from "@/auth";

async function withAuthErrors(fn: () => Promise<unknown>) {
  try {
    await fn();
  } catch (err) {
    // signIn() redirects by throwing; only real auth failures are AuthErrors.
    if (err instanceof AuthError) redirect(`/login?error=${err.type}`);
    throw err;
  }
}

export async function signInWithGoogle() {
  await withAuthErrors(() => signIn("google", { redirectTo: "/dashboard" }));
}

export async function signInWithEmail(formData: FormData) {
  await withAuthErrors(() =>
    signIn("resend", { email: String(formData.get("email") ?? ""), redirectTo: "/dashboard" }),
  );
}

/** One-click demo login with the seeded account (credentials come from server env, not the form). */
export async function signInAsDemo() {
  await withAuthErrors(() =>
    signIn("demo", {
      email: process.env.DEMO_EMAIL ?? "demo@uptime.local",
      password: process.env.DEMO_PASSWORD ?? "demo-password",
      redirectTo: "/dashboard",
    }),
  );
}

export async function signOutAction() {
  await signOut({ redirectTo: "/" });
}
